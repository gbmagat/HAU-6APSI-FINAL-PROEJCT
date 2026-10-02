import { NextRequest, NextResponse } from "next/server";

import { distanceKm } from "@/lib/geo";
import { overpassRoads } from "@/lib/overpass";
import { buildRoadGraph, routeBetween, type Route } from "@/lib/road-graph";
import { getCurrentSession } from "@/lib/session";

const MAX_ROUTE_KM = 10;
const PADDING_DEGREES = 0.012; // about 1.3 km of extra road around both ends
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_LIMIT = 100;
const headers = { "Cache-Control": "private, no-store" };

type RouteBody = { distanceKm: number; straightKm: number; path: [number, number][]; visited: number; roadPoints: number };
const cache = new Map<string, { at: number; body: RouteBody }>();

function json(body: object, status = 200) {
  return NextResponse.json(body, { status, headers });
}

function coordinate(value: string | null, limit: number): number | null {
  if (value === null || value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

/** The shortest road route between two points, found with Dijkstra's algorithm over OpenStreetMap roads. */
export async function GET(request: NextRequest) {
  if (process.env.DATABASE_URL) {
    try {
      if (!await getCurrentSession()) return json({ error: "Please sign in." }, 401);
    } catch {
      return json({ error: "Our Places is temporarily unavailable." }, 503);
    }
  } else if (process.env.NODE_ENV === "production") {
    return json({ error: "Routes are not set up yet." }, 503);
  }

  const params = request.nextUrl.searchParams;
  const fromLat = coordinate(params.get("fromLat"), 90);
  const fromLng = coordinate(params.get("fromLng"), 180);
  const toLat = coordinate(params.get("toLat"), 90);
  const toLng = coordinate(params.get("toLng"), 180);
  if (fromLat === null || fromLng === null || toLat === null || toLng === null) {
    return json({ error: "Both ends of the route need coordinates." }, 400);
  }
  const from = { latitude: fromLat, longitude: fromLng };
  const to = { latitude: toLat, longitude: toLng };
  const straightKm = distanceKm(from, to);
  if (straightKm > MAX_ROUTE_KM) {
    return json({ error: `Routes in the app cover up to ${MAX_ROUTE_KM} km. Use directions for longer trips.`, straightKm }, 422);
  }

  const key = [fromLat, fromLng, toLat, toLng].map((value) => value.toFixed(4)).join(",");
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return json(cached.body);

  try {
    const elements = await overpassRoads(
      Math.min(fromLat, toLat) - PADDING_DEGREES, Math.min(fromLng, toLng) - PADDING_DEGREES,
      Math.max(fromLat, toLat) + PADDING_DEGREES, Math.max(fromLng, toLng) + PADDING_DEGREES,
    );
    const graph = buildRoadGraph(elements);
    // One-way streets cut off at the edge of the box can strand a route; then fall back to ignoring direction.
    let route: Route | null = routeBetween(graph, from, to);
    if (!route) route = routeBetween(buildRoadGraph(elements, { respectOneway: false }), from, to);
    if (!route) return json({ error: "No road connection was found between these points.", straightKm }, 404);
    const body: RouteBody = {
      distanceKm: route.distanceKm,
      straightKm,
      path: route.path.map((point) => [point.latitude, point.longitude]),
      visited: route.visited,
      roadPoints: graph.nodes.size,
    };
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
    cache.set(key, { at: Date.now(), body });
    return json(body);
  } catch {
    return json({ error: "Road data is unavailable right now. Try again in a moment.", straightKm }, 502);
  }
}
