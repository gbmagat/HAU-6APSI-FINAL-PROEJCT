import "server-only";

import { USER_AGENT } from "@/lib/nominatim";
import type { OverpassElement } from "@/lib/road-graph";

export type Box = { south: number; west: number; north: number; east: number };

// Main roads carry long trips; every drivable road (service lanes included, so malls and parks stay connected)
// is fetched only where a trip starts and ends, or across the whole area for short trips.
const MAIN_ROADS = "motorway|trunk|primary|secondary|tertiary|unclassified"
  + "|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link";
export const ROAD_TYPES = {
  main: MAIN_ROADS,
  all: `${MAIN_ROADS}|residential|living_street|service`,
} as const;
export type RoadLayer = keyof typeof ROAD_TYPES;

// The public Overpass API asks for gentle use; this server sends one query at a time, two seconds apart,
// and backs off when the API says it is busy.
const MIN_INTERVAL_MS = 2000;
const RETRY_DELAYS_MS = [5000, 10000];
let nextSlot = 0;

async function waitForSlot(extraMs = 0) {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now) + extraMs;
  nextSlot = now + wait + MIN_INTERVAL_MS;
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
}

/** Every road of one layer (with its one-way tags) inside any of the boxes, and every point on those roads. */
export async function overpassRoads(layer: RoadLayer, boxes: Box[]): Promise<OverpassElement[]> {
  const ways = boxes.map((box) => {
    const bbox = [box.south, box.west, box.north, box.east].map((value) => value.toFixed(5)).join(",");
    return `way["highway"~"^(${ROAD_TYPES[layer]})$"](${bbox});`;
  }).join("");
  const query = `[out:json][timeout:45];(${ways})->.roads;.roads out body;node(w.roads);out skel qt;`;
  for (let attempt = 0; ; attempt += 1) {
    await waitForSlot(attempt ? RETRY_DELAYS_MS[attempt - 1] : 0);
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(50000),
    });
    const busy = response.status === 429 || response.status === 502 || response.status === 503 || response.status === 504;
    if (busy && attempt < RETRY_DELAYS_MS.length) continue;
    if (!response.ok) throw new Error(`Overpass answered ${response.status}`);
    const data = await response.json() as { elements?: OverpassElement[] };
    return data.elements ?? [];
  }
}
