import { NextRequest, NextResponse } from "next/server";
import { apiError, apiSession } from "@/lib/api-session";
import { getPool } from "@/lib/db";
import { publishVisitSchema } from "@/lib/visit-form";

type ExistingVisit = {
  id: string;
  place_id: string;
  visited_on: string;
  title: string;
  exhibition: string;
  story: string;
  overall: number;
  reflection: string;
  would_visit_again: string;
};

export async function POST(request: NextRequest) {
  try {
    const auth = await apiSession(request);
    if (auth.error) return auth.error;
    const parsed = publishVisitSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError(parsed.error.issues[0].message, 400);
    const input = parsed.data;
    const { userId, spaceId } = auth.session;
    const client = await getPool().connect();
    try {
      await client.query("begin");
      const inserted = await client.query<{ id: string }>(
        `insert into visits (space_id, place_id, author_id, visited_on, title, exhibition, story, idempotency_key)
         select $1, p.id, $2, $3, $4, $5, $6, $7 from places p
          where p.space_id = $1 and p.id = $8
         on conflict (author_id, idempotency_key) do nothing
         returning id`,
        [spaceId, userId, input.visitedOn, input.title, input.exhibition, input.story, input.idempotencyKey, input.placeId],
      );
      const id = inserted.rows[0]?.id;
      if (!id) {
        const existing = await client.query<ExistingVisit>(
          `select v.id, v.place_id, to_char(v.visited_on, 'YYYY-MM-DD') as visited_on,
                  v.title, v.exhibition, v.story, r.overall, r.reflection, r.would_visit_again
             from visits v join reviews r on r.visit_id = v.id and r.author_id = v.author_id
            where v.author_id = $1 and v.idempotency_key = $2`,
          [userId, input.idempotencyKey],
        );
        const row = existing.rows[0];
        await client.query("commit");
        if (!row) return apiError("Choose a place that belongs to Our Places.", 404);
        if (row.place_id !== input.placeId || row.visited_on !== input.visitedOn ||
            row.title !== input.title || row.exhibition !== input.exhibition || row.story !== input.story ||
            row.overall !== input.rating || row.reflection !== input.reflection || row.would_visit_again !== input.revisit) {
          return apiError("This draft was already used for a different experience. Start a new draft.", 409);
        }
        return NextResponse.json({ id: row.id }, { headers: { "Cache-Control": "private, no-store" } });
      }
      await client.query(
        `insert into reviews (space_id, visit_id, author_id, overall, reflection, would_visit_again)
         values ($1, $2, $3, $4, $5, $6)`,
        [spaceId, id, userId, input.rating, input.reflection, input.revisit],
      );
      // The visit happened, so any plan for this place and its reminder are done.
      await client.query(
        `update places set status = 'visited', planned_for = null, planned_time = null, plan_note = '',
                plan_reminder = 'none', remind_at = null, reminder_sent_at = null
          where space_id = $1 and id = $2`,
        [spaceId, input.placeId],
      );
      await client.query("commit");
      return NextResponse.json({ id }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  } catch {
    return apiError("Your experience could not be saved. Your draft is still here; please try again.", 503);
  }
}
