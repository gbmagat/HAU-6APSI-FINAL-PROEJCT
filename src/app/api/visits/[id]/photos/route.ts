import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { apiError, apiSession } from "@/lib/api-session";
import { getPool } from "@/lib/db";
import { deletePhotoFiles, detectPhotoType, MAX_PHOTO_BYTES, savePhotoFile } from "@/lib/photo-storage";

const fieldsSchema = z.object({
  alt: z.string().trim().max(240),
  width: z.coerce.number().int().min(1).max(20000),
  height: z.coerce.number().int().min(1).max(20000),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await apiSession(request);
    if (auth.error) return auth.error;
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return apiError("This experience was not found.", 404);
    if (Number(request.headers.get("content-length")) > MAX_PHOTO_BYTES + 64 * 1024) {
      return apiError("Choose a photo smaller than 8 MB.", 413);
    }
    const form = await request.formData().catch(() => null);
    const file = form?.get("photo");
    if (!form || !(file instanceof File) || file.size === 0) return apiError("Choose a photo to upload.", 400);
    if (file.size > MAX_PHOTO_BYTES) return apiError("Choose a photo smaller than 8 MB.", 413);
    const fields = fieldsSchema.safeParse({ alt: form.get("alt") ?? "", width: form.get("width"), height: form.get("height") });
    if (!fields.success) return apiError("Check the photo description and size.", 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = detectPhotoType(bytes);
    if (!type) return apiError("Use a JPEG, PNG, or WebP image.", 400);

    const { spaceId, userId } = auth.session;
    const pool = getPool();
    // Only the author adds the photo to their own experience, and each experience keeps one.
    const visit = await pool.query<{ photos: number }>(
      `select (select count(*)::integer from visit_photos p where p.visit_id = v.id) as photos
         from visits v where v.id = $1 and v.space_id = $2 and v.author_id = $3`,
      [id, spaceId, userId],
    );
    if (!visit.rows[0]) return apiError("This experience was not found or is not yours.", 404);
    if (visit.rows[0].photos > 0) return apiError("This experience already has a photo.", 409);

    const key = await savePhotoFile(bytes, type);
    try {
      const { rows } = await pool.query<{ id: string }>(
        `insert into visit_photos (space_id, visit_id, storage_key, alt_text, content_type, byte_size, width, height)
         values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
        [spaceId, id, key, fields.data.alt, type, bytes.length, fields.data.width, fields.data.height],
      );
      return NextResponse.json({ id: rows[0].id }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
      await deletePhotoFiles([key]);
      throw error;
    }
  } catch {
    return apiError("The photo could not be saved. Please try again.", 503);
  }
}
