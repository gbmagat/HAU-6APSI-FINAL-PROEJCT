import { dijkstra, type Graph } from "@/lib/dijkstra";
import { distanceKm, type LatLng } from "@/lib/geo";

/** The subset of an Overpass API JSON response this app reads. */
export type OverpassElement =
  | { type: "node"; id: number; lat: number; lon: number }
  | { type: "way"; id: number; nodes: number[]; tags?: Record<string, string> };

/** A road as a list of point ids; oneway 1 runs in list order only, -1 against it, 0 both ways. */
export type RoadWay = { id: number; nodes: number[]; oneway: -1 | 0 | 1 };

/** Road points and roads, keyed by OpenStreetMap id so overlapping downloads merge cleanly. */
export type RoadData = { nodes: Map<number, LatLng>; ways: Map<number, RoadWay> };

export type RoadGraph = { nodes: Map<number, LatLng>; edges: Graph };

export type Route = { distanceKm: number; path: LatLng[]; visited: number };

export function onewayOf(tags?: Record<string, string>): RoadWay["oneway"] {
  const oneway = tags?.oneway;
  if (oneway === "-1") return -1;
  if (oneway === "yes" || oneway === "1" || oneway === "true" || tags?.junction === "roundabout") return 1;
  return 0;
}

export function roadDataFrom(elements: OverpassElement[]): RoadData {
  const roads: RoadData = { nodes: new Map(), ways: new Map() };
  for (const element of elements) {
    if (element.type === "node") roads.nodes.set(element.id, { latitude: element.lat, longitude: element.lon });
    else roads.ways.set(element.id, { id: element.id, nodes: element.nodes, oneway: onewayOf(element.tags) });
  }
  return roads;
}

export function mergeRoadData(parts: RoadData[]): RoadData {
  const roads: RoadData = { nodes: new Map(), ways: new Map() };
  for (const part of parts) {
    for (const [id, node] of part.nodes) roads.nodes.set(id, node);
    for (const [id, way] of part.ways) roads.ways.set(id, way);
  }
  return roads;
}

function addEdge(edges: Graph, from: number, to: number, weight: number) {
  const list = edges.get(from);
  if (list) list.push({ to, weight });
  else edges.set(from, [{ to, weight }]);
}

/** Each road point is a node; each stretch between consecutive points is an edge weighted by its length in km. */
export function buildRoadGraph(roads: RoadData, { respectOneway = true } = {}): RoadGraph {
  const edges: Graph = new Map();
  for (const way of roads.ways.values()) {
    const oneway = respectOneway ? way.oneway : 0;
    for (let index = 1; index < way.nodes.length; index += 1) {
      const a = way.nodes[index - 1];
      const b = way.nodes[index];
      const from = roads.nodes.get(a);
      const to = roads.nodes.get(b);
      if (!from || !to) continue;
      const weight = distanceKm(from, to);
      if (oneway !== -1) addEdge(edges, a, b, weight);
      if (oneway !== 1) addEdge(edges, b, a, weight);
    }
  }
  return { nodes: roads.nodes, edges };
}

const cores = new WeakMap<RoadGraph, Set<number>>();

/** The points on the largest connected stretch of road, so a pin never snaps to an isolated driveway. */
function connectedCore(graph: RoadGraph): Set<number> {
  const known = cores.get(graph);
  if (known) return known;
  const neighbours = new Map<number, number[]>();
  const link = (a: number, b: number) => {
    const list = neighbours.get(a);
    if (list) list.push(b);
    else neighbours.set(a, [b]);
  };
  for (const [from, list] of graph.edges) {
    for (const { to } of list) {
      link(from, to);
      link(to, from);
    }
  }
  const seen = new Set<number>();
  let core = new Set<number>();
  for (const start of neighbours.keys()) {
    if (seen.has(start)) continue;
    const component = new Set<number>([start]);
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      for (const next of neighbours.get(stack.pop()!) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        component.add(next);
        stack.push(next);
      }
    }
    if (component.size > core.size) core = component;
  }
  cores.set(graph, core);
  return core;
}

/** The road point closest to a location, on the main connected road network. */
export function nearestNode(graph: RoadGraph, point: LatLng): number | null {
  let best: { id: number; km: number } | null = null;
  for (const id of connectedCore(graph)) {
    const km = distanceKm(point, graph.nodes.get(id)!);
    if (!best || km < best.km) best = { id, km };
  }
  return best?.id ?? null;
}

/**
 * Snap both ends to the nearest road, run Dijkstra between them, and add the short walks
 * from the pin to the road and from the road to the place.
 */
export function routeBetween(graph: RoadGraph, from: LatLng, to: LatLng): Route | null {
  const start = nearestNode(graph, from);
  const goal = nearestNode(graph, to);
  if (start === null || goal === null) return null;
  const result = dijkstra(graph.edges, start, goal);
  if (!result) return null;
  const roadPath = result.path.map((id) => graph.nodes.get(id)!);
  const snapKm = distanceKm(from, roadPath[0]) + distanceKm(roadPath[roadPath.length - 1], to);
  return { distanceKm: result.distance + snapKm, path: [from, ...roadPath, to], visited: result.visited };
}
