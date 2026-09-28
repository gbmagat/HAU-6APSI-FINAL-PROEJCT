import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentSession, type AppSession } from "@/lib/session";

export function apiError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function apiSession(request: NextRequest): Promise<
  { session: AppSession; error?: never } | { session?: never; error: NextResponse }
> {
  const origin = request.headers.get("origin");
  if (origin !== request.nextUrl.origin) {
    return { error: apiError("This request could not be verified. Reload and try again.", 403) };
  }
  const session = await getCurrentSession();
  if (!session) return { error: apiError("Please sign in again before saving.", 401) };
  return { session };
}
