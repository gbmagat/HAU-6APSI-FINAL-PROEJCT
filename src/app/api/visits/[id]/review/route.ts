import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiSession } from "@/lib/api-session";
import { getPool } from "@/lib/db";
import { submitReviewSchema } from "@/lib/visit-form";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await apiSession(request);
    if (auth.error) return auth.error;
    const { id } = await params;
    const parsed = submitReviewSchema.safeParse(await request.json().catch(() => null));
    if (!z.uuid().safeParse(id).success || !parsed.success) return apiError("Check your rating and reflection.", 400);
    const { rows } = await getPool().query<{ visit_id: string }>(
      `insert into reviews (space_id, visit_id, author_id, overall, reflection, would_visit_again)
       select v.space_id, v.id, $2, $3, $4, $5
         from visits v where v.id = $1 and v.space_id = $6
       on conflict (visit_id, author_id) do nothing
       returning visit_id`,
      [id, auth.session.userId, parsed.data.rating, parsed.data.reflection, parsed.data.revisit, auth.session.spaceId],
    );
    if (!rows[0]) return apiError("This experience was not found or you have already reviewed it.", 409);
    return NextResponse.json({ id }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return apiError("Your review could not be saved. Please try again.", 503);
  }
}
