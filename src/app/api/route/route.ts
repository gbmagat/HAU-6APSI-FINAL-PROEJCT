import { NextRequest, NextResponse } from "next/server";

import { distanceKm, type LatLng } from "@/lib/geo";
import type { Box } from "@/lib/overpass";
import { buildRoadGraph, routeBetween, type Route } from "@/lib/road-graph";
import { loadRoads } from "@/lib/road-tiles";
import { getCurrentSession } from "@/lib/session";

const MAX_ROUTE_KM = 40;
const ALL_ROADS_KM = 10; // up to here every road counts; longer trips use main roads between the two ends
const PADDING_DEGREES = 0.012; // about 1.3 km of extra road around the trip
const END_DEGREES = 0.015; // every road within about 1.6 km of each end
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_LIMIT = 100;
const headers = { "Cache-Control": "private, no-store" };

type RouteBody = {
  distanceKm: number;
  straightKm: number;
  path: [number, number][];
  visited: number;
  roadPoints: number;
  network: "all" | "main";
};
const cache = new Map<string, { at: number; body: RouteBody }>();

function json(body: object, status = 200) {
  return NextResponse.json(body, { status, headers });
}

function coordinate(value: string | null, limit: number): number | null {
  if (value === null || value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

function around(points: LatLng[], padding: number): Box {
  return {
    south: Math.min(...points.map((point) => point.latitude)) - padding,
    west: Math.min(...points.map((point) => point.longitude)) - padding,
    north: Math.max(...points.map((point) => point.latitude)) + padding,
    east: Math.max(...points.map((point) => point.longitude)) + padding,
  };
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
    return json({ error: `In-app routes cover up to ${MAX_ROUTE_KM} km. Use Directions for longer trips.`, straightKm }, 422);
  }

  const key = [fromLat, fromLng, toLat, toLng].map((value) => value.toFixed(4)).join(",");
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return json(cached.body);

  const network = straightKm <= ALL_ROADS_KM ? "all" : "main";
  const trip = around([from, to], PADDING_DEGREES);
  let roads;
  try {
    ({ roads } = await loadRoads(network === "all"
      ? [{ layer: "all", box: trip }]
      : [{ layer: "main", box: trip }, { layer: "all", box: around([from], END_DEGREES) }, { layer: "all", box: around([to], END_DEGREES) }]));
  } catch {
    return json({ error: "Road data is unavailable right now. Try again in a moment.", straightKm }, 502);
  }

  const graph = buildRoadGraph(roads);
  // One-way streets cut off at the edge of the area can strand a route; then fall back to ignoring direction.
  let route: Route | null = routeBetween(graph, from, to);
  if (!route) route = routeBetween(buildRoadGraph(roads, { respectOneway: false }), from, to);
  if (!route) return json({ error: "No road connection was found between these points.", straightKm }, 404);
  const body: RouteBody = {
    distanceKm: route.distanceKm,
    straightKm,
    path: route.path.map((point) => [point.latitude, point.longitude]),
    visited: route.visited,
    roadPoints: graph.nodes.size,
    network,
  };
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), body });
  return json(body);
}
