import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { loadServerState } from "@/lib/state-server";

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }
    const state = await loadServerState(session.spaceId, session.userId);
    return NextResponse.json(state, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Our Places is temporarily unavailable." }, { status: 503 });
  }
}
