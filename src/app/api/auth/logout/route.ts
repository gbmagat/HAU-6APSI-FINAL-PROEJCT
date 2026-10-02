import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/origin";
import { revokeSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Request not allowed." }, { status: 403 });
  }
  try {
    await revokeSession();
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Sign-out failed. Please try again." }, { status: 503 });
  }
}
