import { NextRequest, NextResponse } from "next/server";

import { fromNominatim, type NominatimResult, type PlaceSearchResult } from "@/lib/place-search";
import { getCurrentSession } from "@/lib/session";

// OpenStreetMap's Nominatim policy: identify the app, at most one request per second, cache results.
// https://operations.osmfoundation.org/policies/nominatim/
const USER_AGENT = "OurPlaces/0.1 (private two-person app; https://github.com/gbmagat/HAU-6APSI-FINAL-PROEJCT)";
const MIN_INTERVAL_MS = 1100;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_LIMIT = 200;
const headers = { "Cache-Control": "private, no-store" };

const cache = new Map<string, { at: number; results: PlaceSearchResult[] }>();
let nextSlot = 0;

function json(body: object, status = 200) {
  return NextResponse.json(body, { status, headers });
}

async function waitForSlot() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_INTERVAL_MS;
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
}

export async function GET(request: NextRequest) {
  // Members only once a database is set up; the development preview has no accounts.
  if (process.env.DATABASE_URL) {
    try {
      if (!await getCurrentSession()) return json({ error: "Please sign in." }, 401);
    } catch {
      return json({ error: "Our Places is temporarily unavailable." }, 503);
    }
  } else if (process.env.NODE_ENV === "production") {
    return json({ error: "Place search is not set up yet." }, 503);
  }

  const query = request.nextUrl.searchParams.get("q")?.trim().replace(/\s+/g, " ") ?? "";
  if (query.length < 2 || query.length > 200) return json({ error: "Type at least two characters." }, 400);
  const key = query.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return json({ results: cached.results });

  try {
    await waitForSlot();
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.search = new URLSearchParams({ q: query, format: "jsonv2", addressdetails: "1", limit: "6" }).toString();
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return json({ error: "Place search is unavailable right now. Try again in a moment." }, 502);
    const raw = await response.json() as NominatimResult[];
    const results = raw.map(fromNominatim).filter((result): result is PlaceSearchResult => result !== null);
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
    cache.set(key, { at: Date.now(), results });
    return json({ results });
  } catch {
    return json({ error: "Place search is unavailable right now. Try again in a moment." }, 502);
  }
}
