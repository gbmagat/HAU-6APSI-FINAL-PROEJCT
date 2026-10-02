import { describe, expect, it } from "vitest";

import { dijkstra, type Graph } from "@/lib/dijkstra";

/** Builds an undirected graph from [from, to, weight] triples. */
function graphOf(edges: [number, number, number][], directed = false): Graph {
  const graph: Graph = new Map();
  const add = (from: number, to: number, weight: number) => graph.set(from, [...(graph.get(from) ?? []), { to, weight }]);
  for (const [from, to, weight] of edges) {
    add(from, to, weight);
    if (!directed) add(to, from, weight);
  }
  return graph;
}

describe("dijkstra", () => {
  // The classic six-node example: the cheapest route from 1 to 5 is 1 → 3 → 6 → 5, total 20.
  const classic = graphOf([[1, 2, 7], [1, 3, 9], [1, 6, 14], [2, 3, 10], [2, 4, 15], [3, 4, 11], [3, 6, 2], [4, 5, 6], [5, 6, 9]]);

  it("finds the shortest path, not the one with the fewest steps", () => {
    expect(dijkstra(classic, 1, 5)).toMatchObject({ distance: 20, path: [1, 3, 6, 5] });
    expect(dijkstra(classic, 1, 4)).toMatchObject({ distance: 20, path: [1, 3, 4] });
  });

  it("returns a zero-length path when start and goal are the same", () => {
    expect(dijkstra(classic, 3, 3)).toMatchObject({ distance: 0, path: [3] });
  });

  it("respects one-way edges and reports unreachable goals", () => {
    const oneWay = graphOf([[1, 2, 1], [2, 3, 1]], true);
    expect(dijkstra(oneWay, 1, 3)?.distance).toBe(2);
    expect(dijkstra(oneWay, 3, 1)).toBeNull();
    expect(dijkstra(classic, 1, 99)).toBeNull();
  });

  it("refuses negative weights, which break its guarantee", () => {
    expect(() => dijkstra(graphOf([[1, 2, -1]]), 1, 2)).toThrow(RangeError);
  });

  it("stays fast on a large grid", () => {
    const size = 120;
    const edges: [number, number, number][] = [];
    for (let row = 0; row < size; row += 1) {
      for (let column = 0; column < size; column += 1) {
        const id = row * size + column;
        if (column + 1 < size) edges.push([id, id + 1, 1]);
        if (row + 1 < size) edges.push([id, id + size, 1]);
      }
    }
    const started = performance.now();
    const result = dijkstra(graphOf(edges), 0, size * size - 1);
    expect(result?.distance).toBe((size - 1) * 2);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
