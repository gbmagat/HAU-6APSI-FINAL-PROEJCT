import "server-only";

import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { overpassRoads, type Box, type RoadLayer } from "@/lib/overpass";
import { mergeRoadData, roadDataFrom, type RoadData, type RoadWay } from "@/lib/road-graph";

// Roads are downloaded once per map tile and kept on disk, so later routes in the same area
// need no download at all. Main-road tiles are larger because they hold far fewer roads.
const TILE_DEGREES: Record<RoadLayer, number> = { all: 0.02, main: 0.05 };
const TILE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MEMORY_LIMIT = 400;

type Tile = { layer: RoadLayer; x: number; y: number; key: string };

export function roadCacheDirectory(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.env.ROAD_CACHE_DIR || path.join(process.cwd(), "storage", "roads"));
}

export function tilesFor(layer: RoadLayer, box: Box): Tile[] {
  const size = TILE_DEGREES[layer];
  const tiles: Tile[] = [];
  for (let y = Math.floor(box.south / size); y <= Math.floor(box.north / size); y += 1) {
    for (let x = Math.floor(box.west / size); x <= Math.floor(box.east / size); x += 1) {
      tiles.push({ layer, x, y, key: `${layer}_${x}_${y}` });
    }
  }
  return tiles;
}

function tileBox({ layer, x, y }: Tile): Box {
  const size = TILE_DEGREES[layer];
  return { south: y * size, west: x * size, north: (y + 1) * size, east: (x + 1) * size };
}

/** Neighbouring missing tiles in a row become one box, so a single query asks for all of them. */
function rowRuns(tiles: Tile[]): Box[] {
  const sorted = [...tiles].sort((a, b) => a.y - b.y || a.x - b.x);
  const boxes: Box[] = [];
  let run: { first: Tile; last: Tile } | null = null;
  for (const tile of sorted) {
    if (run && tile.y === run.last.y && tile.x === run.last.x + 1) {
      run.last = tile;
      continue;
    }
    if (run) boxes.push({ ...tileBox(run.first), east: tileBox(run.last).east });
    run = { first: tile, last: tile };
  }
  if (run) boxes.push({ ...tileBox(run.first), east: tileBox(run.last).east });
  return boxes;
}

function encode(roads: RoadData): string {
  const nodes: number[] = [];
  for (const [id, node] of roads.nodes) nodes.push(id, node.latitude, node.longitude);
  return JSON.stringify({ v: 1, nodes, ways: [...roads.ways.values()].map((way) => [way.id, way.oneway, ...way.nodes]) });
}

function decode(text: string): RoadData {
  const data = JSON.parse(text) as { v: number; nodes: number[]; ways: number[][] };
  const roads: RoadData = { nodes: new Map(), ways: new Map() };
  for (let index = 0; index + 2 < data.nodes.length; index += 3) {
    roads.nodes.set(data.nodes[index], { latitude: data.nodes[index + 1], longitude: data.nodes[index + 2] });
  }
  for (const [id, oneway, ...nodes] of data.ways) roads.ways.set(id, { id, oneway: oneway as RoadWay["oneway"], nodes });
  return roads;
}

/** Each road goes into every tile that holds one of its points, together with all of its points. */
function splitIntoTiles(roads: RoadData, tiles: Tile[]): Map<string, RoadData> {
  const byKey = new Map(tiles.map((tile) => [tile.key, { nodes: new Map(), ways: new Map() } as RoadData]));
  const layer = tiles[0]?.layer;
  if (!layer) return byKey;
  const size = TILE_DEGREES[layer];
  for (const way of roads.ways.values()) {
    const keys = new Set<string>();
    for (const id of way.nodes) {
      const node = roads.nodes.get(id);
      if (node) keys.add(`${layer}_${Math.floor(node.longitude / size)}_${Math.floor(node.latitude / size)}`);
    }
    for (const key of keys) {
      const tile = byKey.get(key);
      if (!tile) continue;
      tile.ways.set(way.id, way);
      for (const id of way.nodes) {
        const node = roads.nodes.get(id);
        if (node) tile.nodes.set(id, node);
      }
    }
  }
  return byKey;
}

const memory = new Map<string, RoadData>();

function remember(key: string, roads: RoadData) {
  memory.delete(key);
  memory.set(key, roads);
  if (memory.size > MEMORY_LIMIT) memory.delete(memory.keys().next().value as string);
}

async function readTile(key: string): Promise<RoadData | null> {
  const cached = memory.get(key);
  if (cached) {
    remember(key, cached);
    return cached;
  }
  const file = path.join(roadCacheDirectory(), `${key}.json`);
  try {
    if (Date.now() - (await stat(file)).mtimeMs > TILE_TTL_MS) return null;
    const roads = decode(await readFile(file, "utf8"));
    remember(key, roads);
    return roads;
  } catch {
    return null;
  }
}

async function writeTile(key: string, roads: RoadData) {
  remember(key, roads);
  try {
    const directory = roadCacheDirectory();
    await mkdir(directory, { recursive: true });
    const file = path.join(directory, `${key}.json`);
    const temporary = `${file}.${process.pid}.tmp`;
    await writeFile(temporary, encode(roads));
    await rename(temporary, file);
  } catch (error) {
    // The memory copy still serves this process; the disk copy is only a convenience.
    console.error("Road cache write failed:", error instanceof Error ? error.message : error);
  }
}

// One download at a time: a second request for the same area waits and then finds the tiles cached.
let queue: Promise<unknown> = Promise.resolve();

async function loadLayer(layer: RoadLayer, tiles: Tile[]): Promise<{ roads: RoadData[]; downloaded: number }> {
  const found = await Promise.all(tiles.map(async (tile) => ({ tile, roads: await readTile(tile.key) })));
  const missing = found.filter((entry) => !entry.roads).map((entry) => entry.tile);
  if (!missing.length) return { roads: found.map((entry) => entry.roads!), downloaded: 0 };

  const task = queue.then(async () => {
    const stillMissing: Tile[] = [];
    for (const tile of missing) if (!await readTile(tile.key)) stillMissing.push(tile);
    if (!stillMissing.length) return;
    const split = splitIntoTiles(roadDataFrom(await overpassRoads(layer, rowRuns(stillMissing))), stillMissing);
    for (const [key, roads] of split) await writeTile(key, roads);
  });
  queue = task.catch(() => undefined);
  await task;
  const roads = await Promise.all(tiles.map(async (tile) => (await readTile(tile.key)) ?? { nodes: new Map(), ways: new Map() }));
  return { roads, downloaded: missing.length };
}

/** The roads for every requested layer and area, downloading only the tiles not already saved. */
export async function loadRoads(requests: { layer: RoadLayer; box: Box }[]): Promise<{ roads: RoadData; downloaded: number }> {
  const byLayer = new Map<RoadLayer, Map<string, Tile>>();
  for (const { layer, box } of requests) {
    const tiles = byLayer.get(layer) ?? new Map<string, Tile>();
    for (const tile of tilesFor(layer, box)) tiles.set(tile.key, tile);
    byLayer.set(layer, tiles);
  }
  const parts: RoadData[] = [];
  let downloaded = 0;
  for (const [layer, tiles] of byLayer) {
    const result = await loadLayer(layer, [...tiles.values()]);
    parts.push(...result.roads);
    downloaded += result.downloaded;
  }
  return { roads: mergeRoadData(parts), downloaded };
}
