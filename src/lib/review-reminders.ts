import "server-only";

import { getPool } from "@/lib/db";
import { reviewReminderEmail } from "@/lib/emails";
import { sendMail } from "@/lib/mailer";

// Give the other member a moment: if they review right away together, no email is needed.
const DELAY_MS = 15 * 60 * 1000;

type WaitingVisit = {
  id: string;
  space_id: string;
  author_name: string;
  place_name: string;
  place_slug: string;
  visited_on: string;
};

type Recipient = { email: string; display_name: string };

/**
 * Email the member whose review is still missing on a visit their partner logged. Each visit is
 * claimed by stamping review_reminder_sent_at first, so it is emailed about at most once.
 */
export async function sendReviewReminders(now = new Date()): Promise<{ visits: number; sent: number; failed: number }> {
  const pool = getPool();
  const claimedAt = now.toISOString();
  const due = await pool.query<WaitingVisit>(
    `with claimed as (
       update visits v set review_reminder_sent_at = $1
        where v.review_reminder_sent_at is null and v.created_at <= $2
          and exists (
            select 1 from space_members m
             where m.space_id = v.space_id and m.user_id <> v.author_id
               and not exists (select 1 from reviews r where r.visit_id = v.id and r.author_id = m.user_id)
          )
       returning v.id, v.space_id, v.author_id, v.place_id, v.visited_on
     )
     select c.id, c.space_id, u.display_name as author_name, p.name as place_name, p.slug as place_slug,
            to_char(c.visited_on, 'YYYY-MM-DD') as visited_on
       from claimed c
       join app_users u on u.id = c.author_id
       join places p on p.space_id = c.space_id and p.id = c.place_id`,
    [claimedAt, new Date(now.getTime() - DELAY_MS).toISOString()],
  );

  let sent = 0;
  let failed = 0;
  for (const visit of due.rows) {
    // Only the member who still owes a review, and only if they want these emails.
    const recipients = await pool.query<Recipient>(
      `select u.email, u.display_name from space_members m
         join app_users u on u.id = m.user_id
         join visits v on v.id = $2 and v.space_id = m.space_id
         left join member_settings s on s.user_id = m.user_id
        where m.space_id = $1 and m.user_id <> v.author_id and coalesce(s.review_reminders, true)
          and not exists (select 1 from reviews r where r.visit_id = v.id and r.author_id = m.user_id)`,
      [visit.space_id, visit.id],
    );
    let delivered = 0;
    for (const recipient of recipients.rows) {
      const email = reviewReminderEmail({
        memberName: recipient.display_name,
        authorName: visit.author_name,
        place: { name: visit.place_name, slug: visit.place_slug },
        visitedOn: visit.visited_on,
        appUrl: process.env.APP_URL,
      });
      try {
        await sendMail({ to: recipient.email, ...email });
        delivered += 1;
        sent += 1;
      } catch (error) {
        failed += 1;
        console.error(`Review reminder for ${visit.id} could not be sent:`, error instanceof Error ? error.message : error);
      }
    }
    // Nothing got through: release the claim so the next run tries again.
    if (recipients.rows.length && !delivered) {
      await pool.query(`update visits set review_reminder_sent_at = null where id = $1 and review_reminder_sent_at = $2`, [visit.id, claimedAt]);
    }
  }
  return { visits: due.rows.length, sent, failed };
}
