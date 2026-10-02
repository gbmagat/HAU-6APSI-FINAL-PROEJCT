import { dijkstra, type Graph } from "@/lib/dijkstra";
import { distanceKm, type LatLng } from "@/lib/geo";

/** The subset of an Overpass API JSON response this app reads. */
export type OverpassElement =
  | { type: "node"; id: number; lat: number; lon: number }
  | { type: "way"; id: number; nodes: number[]; tags?: Record<string, string> };

export type RoadGraph = { nodes: Map<number, LatLng>; edges: Graph };

export type Route = { distanceKm: number; path: LatLng[]; visited: number };

function addEdge(edges: Graph, from: number, to: number, weight: number) {
  const list = edges.get(from);
  if (list) list.push({ to, weight });
  else edges.set(from, [{ to, weight }]);
}

/** Each road point is a node; each stretch between consecutive points is an edge weighted by its length in km. */
export function buildRoadGraph(elements: OverpassElement[], { respectOneway = true } = {}): RoadGraph {
  const nodes = new Map<number, LatLng>();
  for (const element of elements) {
    if (element.type === "node") nodes.set(element.id, { latitude: element.lat, longitude: element.lon });
  }
  const edges: Graph = new Map();
  for (const element of elements) {
    if (element.type !== "way") continue;
    const oneway = respectOneway ? element.tags?.oneway : undefined;
    const forwardOnly = oneway === "yes" || oneway === "1" || oneway === "true" || element.tags?.junction === "roundabout";
    const backwardOnly = oneway === "-1";
    for (let index = 1; index < element.nodes.length; index += 1) {
      const a = element.nodes[index - 1];
      const b = element.nodes[index];
      const from = nodes.get(a);
      const to = nodes.get(b);
      if (!from || !to) continue;
      const weight = distanceKm(from, to);
      if (!backwardOnly) addEdge(edges, a, b, weight);
      if (!forwardOnly) addEdge(edges, b, a, weight);
    }
  }
  return { nodes, edges };
}

/** The road point closest to a location, among points that have roads leaving or arriving. */
export function nearestNode(graph: RoadGraph, point: LatLng): number | null {
  let best: { id: number; km: number } | null = null;
  for (const [id, node] of graph.nodes) {
    if (!graph.edges.has(id)) continue;
    const km = distanceKm(point, node);
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
