import { NextRequest, NextResponse } from "next/server";

import { nominatimSearch, wikipediaSummary } from "@/lib/nominatim";
import { aboutFromNominatim, nearestMatch, parseWikipediaTag, type PlaceAbout } from "@/lib/place-about";
import { getCurrentSession } from "@/lib/session";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_LIMIT = 200;
const headers = { "Cache-Control": "private, no-store" };
const cache = new Map<string, { at: number; about: PlaceAbout }>();

function json(body: object, status = 200) {
  return NextResponse.json(body, { status, headers });
}

/** Public details for a saved place: website, phone, and hours from OpenStreetMap, and a Wikipedia summary. */
export async function GET(request: NextRequest) {
  if (process.env.DATABASE_URL) {
    try {
      if (!await getCurrentSession()) return json({ error: "Please sign in." }, 401);
    } catch {
      return json({ error: "Our Places is temporarily unavailable." }, 503);
    }
  } else if (process.env.NODE_ENV === "production") {
    return json({ error: "Place details are not set up yet." }, 503);
  }

  const params = request.nextUrl.searchParams;
  const name = params.get("name")?.trim().slice(0, 160) ?? "";
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  if (!name || !params.has("lat") || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return json({ error: "A place name and coordinates are required." }, 400);
  }
  const key = `${name.toLowerCase()}@${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return json({ about: cached.about });

  try {
    // Look only within about a kilometre of the saved pin, so a same-named place elsewhere never matches.
    const results = await nominatimSearch({
      q: name,
      viewbox: [lng - 0.01, lat + 0.01, lng + 0.01, lat - 0.01].join(","),
      bounded: "1",
      extratags: "1",
      limit: "5",
    });
    const match = nearestMatch(results, lat, lng);
    let about: PlaceAbout = {};
    if (match) {
      const { wikipediaTag, ...details } = aboutFromNominatim(match);
      about = details;
      const wiki = parseWikipediaTag(wikipediaTag);
      if (wiki) about.wikipedia = await wikipediaSummary(wiki.lang, wiki.title).catch(() => null) ?? undefined;
    }
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
    cache.set(key, { at: Date.now(), about });
    return json({ about });
  } catch {
    return json({ error: "Place details are unavailable right now." }, 502);
  }
}
