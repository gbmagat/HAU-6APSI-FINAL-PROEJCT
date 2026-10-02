/** A directed graph: each node id maps to the edges leaving it. */
export type Graph = Map<number, { to: number; weight: number }[]>;

export type ShortestPath = { distance: number; path: number[]; visited: number };

/** A binary min-heap of [priority, node] pairs, so each step takes the closest unsettled node in O(log n). */
class MinHeap {
  private items: [number, number][] = [];

  get size() {
    return this.items.length;
  }

  push(item: [number, number]) {
    const items = this.items;
    items.push(item);
    let child = items.length - 1;
    while (child > 0) {
      const parent = (child - 1) >> 1;
      if (items[parent][0] <= items[child][0]) break;
      [items[parent], items[child]] = [items[child], items[parent]];
      child = parent;
    }
  }

  pop(): [number, number] | undefined {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length && last) {
      items[0] = last;
      let parent = 0;
      for (;;) {
        const left = parent * 2 + 1;
        const right = left + 1;
        let smallest = parent;
        if (left < items.length && items[left][0] < items[smallest][0]) smallest = left;
        if (right < items.length && items[right][0] < items[smallest][0]) smallest = right;
        if (smallest === parent) break;
        [items[parent], items[smallest]] = [items[smallest], items[parent]];
        parent = smallest;
      }
    }
    return top;
  }
}

/**
 * Dijkstra's algorithm: repeatedly settle the unsettled node with the smallest known distance,
 * then relax its outgoing edges. With non-negative weights, a node's distance is final once settled.
 * Returns null when the target cannot be reached.
 */
export function dijkstra(graph: Graph, source: number, target: number): ShortestPath | null {
  const distance = new Map<number, number>([[source, 0]]);
  const previous = new Map<number, number>();
  const settled = new Set<number>();
  const queue = new MinHeap();
  queue.push([0, source]);

  while (queue.size) {
    const [known, node] = queue.pop()!;
    if (settled.has(node)) continue; // a stale entry from before a shorter path was found
    settled.add(node);
    if (node === target) break;
    for (const { to, weight } of graph.get(node) ?? []) {
      if (weight < 0) throw new RangeError("Dijkstra's algorithm needs non-negative edge weights.");
      const candidate = known + weight;
      if (candidate < (distance.get(to) ?? Infinity)) {
        distance.set(to, candidate);
        previous.set(to, node);
        queue.push([candidate, to]);
      }
    }
  }

  if (!settled.has(target)) return null;
  const path = [target];
  while (path[0] !== source) path.unshift(previous.get(path[0])!);
  return { distance: distance.get(target)!, path, visited: settled.size };
}
