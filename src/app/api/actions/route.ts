import { type PoolClient } from "pg";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getPool } from "@/lib/db";
import { isSameOriginRequest } from "@/lib/origin";
import { deletePhotoFiles } from "@/lib/photo-storage";
import { planInputSchema, reminderTime } from "@/lib/plans";
import { getCurrentSession } from "@/lib/session";

const placeId = z.string().trim().min(1).max(80);
const postId = z.uuid();
const settings = z.strictObject({
  reviewReminders: z.boolean().optional(),
  locationEnabled: z.boolean().optional(),
  planReminders: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0);

const actionSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("toggleFavorite"), placeId }),
  z.strictObject({ action: z.literal("setPlaceStatus"), placeId, status: z.enum(["want-to-visit", "planned", "visited"]) }),
  z.strictObject({ action: z.literal("savePlan"), placeId, plan: planInputSchema }),
  z.strictObject({ action: z.literal("addComment"), postId, body: z.string().trim().min(1).max(240) }),
  z.strictObject({ action: z.literal("toggleReaction"), postId }),
  z.strictObject({ action: z.literal("saveMemberName"), name: z.string().trim().min(1).max(80) }),
  z.strictObject({ action: z.literal("updateSettings"), settings }),
  z.strictObject({ action: z.literal("deletePost"), postId }),
]);

class ActionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function response(body: { ok: true } | { error: string }, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

async function transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest) {
  try {
    // Browser writes must come from this site, including behind the HTTPS proxy.
    if (!isSameOriginRequest(request)) {
      return response({ error: "This request could not be verified." }, 403);
    }
    const session = await getCurrentSession();
    if (!session) return response({ error: "Please sign in to save changes." }, 401);
    if (Number(request.headers.get("content-length")) > 16_384) {
      return response({ error: "This request is too large." }, 413);
    }
    const raw = await request.text();
    if (raw.length > 16_384) return response({ error: "This request is too large." }, 413);
    const parsed = actionSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return response({ error: "Check the action fields and try again." }, 400);

    const { spaceId, userId } = session;
    const action = parsed.data;
    switch (action.action) {
      case "toggleFavorite": {
        await transaction(async (client) => {
          const place = await client.query(
            `select p.id from places p where p.space_id = $1 and p.id = $3
               and exists (select 1 from space_members m where m.space_id = $1 and m.user_id = $2)
             for update`,
            [spaceId, userId, action.placeId],
          );
          if (!place.rowCount) throw new ActionError("This place was not found.", 404);
          const removed = await client.query(
            `delete from member_favorites
              where space_id = $1 and user_id = $2 and place_id = $3 returning place_id`,
            [spaceId, userId, action.placeId],
          );
          if (!removed.rowCount) {
            await client.query(
              `insert into member_favorites (space_id, user_id, place_id)
               values ($1, $2, $3)`,
              [spaceId, userId, action.placeId],
            );
          }
        });
        break;
      }
      case "setPlaceStatus": {
        // Leaving "planned" drops the plan and its reminder.
        const result = await getPool().query(
          `update places p set status = $4,
                  planned_for = case when $4 = 'planned' then planned_for end,
                  planned_time = case when $4 = 'planned' then planned_time end,
                  plan_note = case when $4 = 'planned' then plan_note else '' end,
                  plan_reminder = case when $4 = 'planned' then plan_reminder else 'none' end,
                  remind_at = case when $4 = 'planned' then remind_at end,
                  reminder_sent_at = case when $4 = 'planned' then reminder_sent_at end
            where p.space_id = $1 and p.id = $3
              and exists (select 1 from space_members m where m.space_id = $1 and m.user_id = $2)
          returning p.id`,
          [spaceId, userId, action.placeId, action.status],
        );
        if (!result.rowCount) throw new ActionError("This place was not found.", 404);
        break;
      }
      case "savePlan": {
        const { date, time, note, reminder } = action.plan;
        const remindAt = reminderTime(date, time || undefined, reminder);
        // Saving the same date, time, and reminder again keeps a reminder that was already sent from going out twice.
        const result = await getPool().query(
          `update places p set status = 'planned', planned_for = $4::date, planned_time = $5::time,
                  plan_note = $6, plan_reminder = $7, remind_at = $8::timestamptz,
                  reminder_sent_at = case
                    when p.planned_for is not distinct from $4::date and p.planned_time is not distinct from $5::time
                     and p.plan_reminder = $7 then p.reminder_sent_at
                  end
            where p.space_id = $1 and p.id = $3
              and exists (select 1 from space_members m where m.space_id = $1 and m.user_id = $2)
          returning p.id`,
          [spaceId, userId, action.placeId, date, time || null, note, reminder, remindAt?.toISOString() ?? null],
        );
        if (!result.rowCount) throw new ActionError("This place was not found.", 404);
        break;
      }
      case "addComment": {
        const result = await getPool().query(
          `insert into comments (space_id, visit_id, author_id, body)
           select $1, v.id, $2, $4 from visits v
            where v.space_id = $1 and v.id = $3
              and exists (select 1 from space_members m where m.space_id = $1 and m.user_id = $2)
           returning id`,
          [spaceId, userId, action.postId, action.body],
        );
        if (!result.rowCount) throw new ActionError("This experience was not found.", 404);
        break;
      }
      case "toggleReaction": {
        await transaction(async (client) => {
          const visit = await client.query(
            `select v.id from visits v where v.space_id = $1 and v.id = $3
               and exists (select 1 from space_members m where m.space_id = $1 and m.user_id = $2)
             for update`,
            [spaceId, userId, action.postId],
          );
          if (!visit.rowCount) throw new ActionError("This experience was not found.", 404);
          const removed = await client.query(
            `delete from reactions
              where space_id = $1 and author_id = $2 and visit_id = $3 returning visit_id`,
            [spaceId, userId, action.postId],
          );
          if (!removed.rowCount) {
            await client.query(
              `insert into reactions (space_id, visit_id, author_id, type)
               values ($1, $3, $2, 'love')`,
              [spaceId, userId, action.postId],
            );
          }
        });
        break;
      }
      case "saveMemberName": {
        const result = await getPool().query(
          `update app_users u set display_name = $3
            where u.id = $2
              and exists (select 1 from space_members m where m.space_id = $1 and m.user_id = $2)
          returning u.id`,
          [spaceId, userId, action.name],
        );
        if (!result.rowCount) throw new ActionError("Your account was not found.", 404);
        break;
      }
      case "updateSettings": {
        const result = await getPool().query(
          `insert into member_settings (space_id, user_id, review_reminders, location_enabled, plan_reminders)
           select $1, $2, coalesce($3, true), coalesce($4, false), coalesce($5, true)
             from space_members m where m.space_id = $1 and m.user_id = $2
           on conflict (user_id) do update set
             review_reminders = coalesce($3, member_settings.review_reminders),
             location_enabled = coalesce($4, member_settings.location_enabled),
             plan_reminders = coalesce($5, member_settings.plan_reminders)
           where member_settings.space_id = $1
           returning user_id`,
          [spaceId, userId, action.settings.reviewReminders ?? null, action.settings.locationEnabled ?? null, action.settings.planReminders ?? null],
        );
        if (!result.rowCount) throw new ActionError("Your settings could not be found.", 404);
        break;
      }
      case "deletePost": {
        const photoKeys = await transaction(async (client) => {
          const visit = await client.query<{ place_id: string }>(
            `select place_id from visits where space_id = $1 and author_id = $2 and id = $3 for update`,
            [spaceId, userId, action.postId],
          );
          if (!visit.rowCount) throw new ActionError("This experience was not found or is not yours to delete.", 404);
          const photos = await client.query<{ storage_key: string }>(
            `select storage_key from visit_photos where space_id = $1 and visit_id = $2`,
            [spaceId, action.postId],
          );
          const placeId = visit.rows[0].place_id;
          // Lock the place so a concurrent new visit cannot race the final-visit check.
          await client.query(
            `select id from places where space_id = $1 and id = $2 for update`,
            [spaceId, placeId],
          );
          await client.query(
            `delete from visits where space_id = $1 and author_id = $2 and id = $3`,
            [spaceId, userId, action.postId],
          );
          await client.query(
            `update places p set status = 'want-to-visit', planned_for = null
              where p.space_id = $1 and p.id = $3 and p.status = 'visited'
                and exists (select 1 from space_members m where m.space_id = $1 and m.user_id = $2)
                and not exists (select 1 from visits v where v.space_id = $1 and v.place_id = p.id)`,
            [spaceId, userId, placeId],
          );
          return photos.rows.map((row) => row.storage_key);
        });
        await deletePhotoFiles(photoKeys);
        break;
      }
    }
    return response({ ok: true });
  } catch (error) {
    if (error instanceof SyntaxError) return response({ error: "Send valid JSON." }, 400);
    if (error instanceof ActionError) return response({ error: error.message }, error.status);
    return response({ error: "This change could not be saved. Please try again." }, 503);
  }
}
