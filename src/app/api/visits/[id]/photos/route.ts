import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { apiError, apiSession } from "@/lib/api-session";
import { getPool } from "@/lib/db";
import { deletePhotoFiles, detectPhotoType, MAX_PHOTO_BYTES, savePhotoFile } from "@/lib/photo-storage";
import { MAX_VISIT_PHOTOS } from "@/lib/visit-form";

const fieldsSchema = z.object({
  alt: z.string().trim().max(240),
  width: z.coerce.number().int().min(1).max(20000),
  height: z.coerce.number().int().min(1).max(20000),
  // Where this photo sits in the experience, counting from 0. It makes a retried upload safe.
  position: z.coerce.number().int().min(0).max(MAX_VISIT_PHOTOS - 1),
});

const headers = { "Cache-Control": "private, no-store" };

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
    const fields = fieldsSchema.safeParse({
      alt: form.get("alt") ?? "",
      width: form.get("width"),
      height: form.get("height"),
      position: form.get("position") ?? 0,
    });
    if (!fields.success) return apiError("Check the photo description and size.", 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = detectPhotoType(bytes);
    if (!type) return apiError("Use a JPEG, PNG, or WebP image.", 400);

    const { spaceId, userId } = auth.session;
    const { position } = fields.data;
    const client = await getPool().connect();
    let key: string | null = null;
    try {
      await client.query("begin");
      // Only the author adds photos to their own experience. Locking the experience keeps two uploads
      // from both taking the same place in the order.
      const visit = await client.query(
        `select id from visits where id = $1 and space_id = $2 and author_id = $3 for update`,
        [id, spaceId, userId],
      );
      if (!visit.rows[0]) {
        await client.query("rollback");
        return apiError("This experience was not found or is not yours.", 404);
      }
      const existing = await client.query<{ id: string }>(
        `select id from visit_photos where visit_id = $1 order by created_at, id`,
        [id],
      );
      // A retry of a photo that already arrived gets the saved photo back instead of a copy.
      if (position < existing.rows.length) {
        await client.query("rollback");
        return NextResponse.json({ id: existing.rows[position].id }, { status: 200, headers });
      }
      if (existing.rows.length >= MAX_VISIT_PHOTOS) {
        await client.query("rollback");
        return apiError(`An experience keeps up to ${MAX_VISIT_PHOTOS} photos.`, 409);
      }
      if (position > existing.rows.length) {
        await client.query("rollback");
        return apiError("Upload the photos in order.", 409);
      }

      key = await savePhotoFile(bytes, type);
      const { rows } = await client.query<{ id: string }>(
        `insert into visit_photos (space_id, visit_id, storage_key, alt_text, content_type, byte_size, width, height, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, clock_timestamp()) returning id`,
        [spaceId, id, key, fields.data.alt, type, bytes.length, fields.data.width, fields.data.height],
      );
      await client.query("commit");
      return NextResponse.json({ id: rows[0].id }, { status: 201, headers });
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      if (key) await deletePhotoFiles([key]);
      throw error;
    } finally {
      client.release();
    }
  } catch {
    return apiError("The photo could not be saved. Please try again.", 503);
  }
}
