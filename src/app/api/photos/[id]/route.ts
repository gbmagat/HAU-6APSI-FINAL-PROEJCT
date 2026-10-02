import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getPool } from "@/lib/db";
import { readPhotoFile } from "@/lib/photo-storage";
import { getCurrentSession } from "@/lib/session";

/** Private photos are served only to members of the space that owns them. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const notFound = () => NextResponse.json({ error: "Photo not found." }, { status: 404 });
  try {
    const session = await getCurrentSession();
    if (!session) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return notFound();
    const { rows } = await getPool().query<{ storage_key: string; content_type: string }>(
      "select storage_key, content_type from visit_photos where id = $1 and space_id = $2",
      [id, session.spaceId],
    );
    if (!rows[0]) return notFound();
    const bytes = await readPhotoFile(rows[0].storage_key);
    if (!bytes) return notFound();
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": rows[0].content_type,
        "Content-Length": String(bytes.length),
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Our Places is temporarily unavailable." }, { status: 503 });
  }
}
