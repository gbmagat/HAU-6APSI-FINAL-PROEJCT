import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { apiError, apiSession } from "@/lib/api-session";
import { getPool } from "@/lib/db";
import { newPlaceSchema, placeInitials, slugify, uniqueSlug } from "@/lib/place-input";

const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: NextRequest) {
  try {
    const auth = await apiSession(request);
    if (auth.error) return auth.error;
    const parsed = newPlaceSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return apiError("Check the place details and try again.", 400);
    const place = parsed.data;
    const { spaceId } = auth.session;
    const client = await getPool().connect();
    try {
      await client.query("begin");
      // The same name within about 50 metres is the place we already saved.
      const existing = await client.query<{ id: string; slug: string }>(
        `select id, slug from places
          where space_id = $1 and lower(name) = lower($2)
            and abs(latitude - $3) < 0.0005 and abs(longitude - $4) < 0.0005
          limit 1`,
        [spaceId, place.name, place.latitude, place.longitude],
      );
      if (existing.rows[0]) {
        await client.query("rollback");
        return NextResponse.json({ error: "This place is already saved.", ...existing.rows[0] }, { status: 409, headers });
      }
      const base = slugify(place.name) || "place";
      const taken = await client.query<{ slug: string }>(
        "select slug from places where space_id = $1 and (slug = $2 or slug like $3)",
        [spaceId, base, `${base}-%`],
      );
      const slug = uniqueSlug(base, taken.rows.map((row) => row.slug));
      const id = `place-${randomUUID()}`;
      await client.query(
        `insert into places (id, space_id, slug, name, category, address, city, country, latitude, longitude, initials, status)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [id, spaceId, slug, place.name, place.category, place.address, place.city, place.country,
          place.latitude, place.longitude, placeInitials(place.name), place.status],
      );
      await client.query("commit");
      return NextResponse.json({ id, slug }, { status: 201, headers });
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch {
    return apiError("This place could not be saved. Please try again.", 503);
  }
}
