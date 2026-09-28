import { NextRequest, NextResponse } from "next/server";
import { revokeSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Request not allowed." }, { status: 403 });
  }
  try {
    await revokeSession();
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Sign-out failed. Please try again." }, { status: 503 });
  }
}
