import "server-only";

import { USER_AGENT } from "@/lib/nominatim";
import type { OverpassElement } from "@/lib/road-graph";

// Drivable roads, including service roads so malls and parks with access lanes stay connected.
const ROAD_TYPES = "motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service"
  + "|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link";

// The public Overpass API asks for gentle use; this server sends one query at a time, two seconds apart.
const MIN_INTERVAL_MS = 2000;
let nextSlot = 0;

async function waitForSlot() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_INTERVAL_MS;
  if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
}

/** Every road (with its one-way tags) and every point on those roads inside the box. */
export async function overpassRoads(south: number, west: number, north: number, east: number): Promise<OverpassElement[]> {
  await waitForSlot();
  const box = [south, west, north, east].map((value) => value.toFixed(5)).join(",");
  const query = `[out:json][timeout:25];way["highway"~"^(${ROAD_TYPES})$"](${box})->.roads;.roads out body;node(w.roads);out skel qt;`;
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Overpass answered ${response.status}`);
  const data = await response.json() as { elements?: OverpassElement[] };
  return data.elements ?? [];
}
