import "server-only";

import { getPool } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { reminderEmail } from "@/lib/plans";
import { todayInManila } from "@/lib/visit-form";

type DuePlan = {
  id: string;
  space_id: string;
  slug: string;
  name: string;
  address: string;
  city: string;
  planned_for: string;
  planned_time: string | null;
  plan_note: string;
};

type Recipient = { email: string; display_name: string };

/**
 * Email the members of every space whose plan reminder is due. Each plan is claimed by stamping
 * reminder_sent_at first, so two servers (or two runs) never send the same reminder twice.
 */
export async function sendDueReminders(now = new Date()): Promise<{ plans: number; sent: number; failed: number }> {
  const pool = getPool();
  const today = todayInManila(now);
  const due = await pool.query<DuePlan>(
    `update places set reminder_sent_at = $1
      where remind_at <= $1 and reminder_sent_at is null and status = 'planned' and planned_for >= $2::date
    returning id, space_id, slug, name, address, city, to_char(planned_for, 'YYYY-MM-DD') as planned_for,
              to_char(planned_time, 'HH24:MI') as planned_time, plan_note`,
    [now.toISOString(), today],
  );

  let sent = 0;
  let failed = 0;
  for (const plan of due.rows) {
    const recipients = await pool.query<Recipient>(
      `select u.email, u.display_name from space_members m
         join app_users u on u.id = m.user_id
         left join member_settings s on s.user_id = m.user_id
        where m.space_id = $1 and coalesce(s.plan_reminders, true)
        order by m.role`,
      [plan.space_id],
    );
    let delivered = 0;
    for (const recipient of recipients.rows) {
      const email = reminderEmail({
        memberName: recipient.display_name,
        place: plan,
        plan: { date: plan.planned_for, time: plan.planned_time ?? undefined, note: plan.plan_note || undefined },
        appUrl: process.env.APP_URL,
        today,
      });
      try {
        await sendMail({ to: recipient.email, ...email });
        delivered += 1;
        sent += 1;
      } catch (error) {
        failed += 1;
        console.error(`Plan reminder for ${plan.id} could not be sent:`, error instanceof Error ? error.message : error);
      }
    }
    // Nothing got through: release the claim so the next run tries again.
    if (recipients.rows.length && !delivered) {
      await pool.query(`update places set reminder_sent_at = null where id = $1 and reminder_sent_at = $2`, [plan.id, now.toISOString()]);
    }
  }
  return { plans: due.rows.length, sent, failed };
}
