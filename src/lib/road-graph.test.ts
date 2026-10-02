import { describe, expect, it } from "vitest";

import { distanceKm } from "@/lib/geo";
import { buildRoadGraph, nearestNode, routeBetween, type OverpassElement } from "@/lib/road-graph";

// A small street grid, about 110 m between points:
//   1 ── 2 ── 3
//   │         │
//   4 ── 5 ── 6        (way 30, from 3 down to 6, is one-way southbound)
const node = (id: number, lat: number, lon: number): OverpassElement => ({ type: "node", id, lat, lon });
const grid: OverpassElement[] = [
  node(1, 14.001, 121.000), node(2, 14.001, 121.001), node(3, 14.001, 121.002),
  node(4, 14.000, 121.000), node(5, 14.000, 121.001), node(6, 14.000, 121.002),
  { type: "way", id: 10, nodes: [1, 2, 3], tags: { highway: "residential" } },
  { type: "way", id: 20, nodes: [4, 5, 6], tags: { highway: "residential" } },
  { type: "way", id: 30, nodes: [3, 6], tags: { highway: "residential", oneway: "yes" } },
  { type: "way", id: 40, nodes: [1, 4], tags: { highway: "residential" } },
];

describe("road graph", () => {
  it("turns roads into weighted edges, one-way streets in one direction only", () => {
    const graph = buildRoadGraph(grid);
    expect(graph.edges.get(3)?.map((edge) => edge.to)).toEqual(expect.arrayContaining([2, 6]));
    expect(graph.edges.get(6)?.map((edge) => edge.to)).toEqual([5]);
    const weight = graph.edges.get(1)!.find((edge) => edge.to === 2)!.weight;
    expect(weight).toBeCloseTo(distanceKm({ latitude: 14.001, longitude: 121.0 }, { latitude: 14.001, longitude: 121.001 }), 9);
  });

  it("snaps a location to the nearest road point", () => {
    expect(nearestNode(buildRoadGraph(grid), { latitude: 14.0011, longitude: 121.0021 })).toBe(3);
  });

  it("routes along the roads, taking the one-way street only with its direction", () => {
    const graph = buildRoadGraph(grid);
    const down = routeBetween(graph, { latitude: 14.001, longitude: 121.002 }, { latitude: 14.0, longitude: 121.002 });
    expect(down?.path).toHaveLength(4); // pin, 3, 6, place: straight down the one-way street
    const up = routeBetween(graph, { latitude: 14.0, longitude: 121.002 }, { latitude: 14.001, longitude: 121.002 });
    expect(up?.path).toHaveLength(8); // pin, 6, 5, 4, 1, 2, 3, place: around the block
    expect(up!.distanceKm).toBeGreaterThan(down!.distanceKm * 3);
  });

  it("includes the short walks from the pin to the road and from the road to the place", () => {
    const route = routeBetween(buildRoadGraph(grid), { latitude: 14.0015, longitude: 121.0 }, { latitude: 14.001, longitude: 121.001 });
    expect(route!.distanceKm).toBeGreaterThan(distanceKm({ latitude: 14.001, longitude: 121.0 }, { latitude: 14.001, longitude: 121.001 }));
  });
});
