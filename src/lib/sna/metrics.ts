import type { NetworkGraph } from "@/types";

/** Undirected, weighted adjacency. Parallel/opposite edges are merged. */
export function adjacency(g: NetworkGraph): Map<string, Map<string, number>> {
  const adj = new Map<string, Map<string, number>>();
  for (const n of g.nodes) adj.set(n.id, new Map());
  for (const e of g.edges) {
    const a = adj.get(e.source);
    const b = adj.get(e.target);
    if (!a || !b || e.source === e.target) continue;
    a.set(e.target, (a.get(e.target) ?? 0) + e.weight);
    b.set(e.source, (b.get(e.source) ?? 0) + e.weight);
  }
  return adj;
}

/** Number of distinct neighbours. */
export function degrees(g: NetworkGraph): Map<string, number> {
  const out = new Map<string, number>();
  for (const [id, nbrs] of adjacency(g)) out.set(id, nbrs.size);
  return out;
}

/** degree / (n - 1), in 0–1. */
export function degreeCentrality(g: NetworkGraph): Map<string, number> {
  const n = g.nodes.length;
  const out = new Map<string, number>();
  for (const [id, d] of degrees(g)) out.set(id, n > 1 ? d / (n - 1) : 0);
  return out;
}

/** Brandes' algorithm, unweighted, undirected, normalised to 0–1. */
export function betweennessCentrality(g: NetworkGraph): Map<string, number> {
  const adj = adjacency(g);
  const ids = [...adj.keys()];
  const cb = new Map(ids.map((i) => [i, 0]));

  for (const s of ids) {
    const stack: string[] = [];
    const pred = new Map<string, string[]>(ids.map((i) => [i, []]));
    const sigma = new Map(ids.map((i) => [i, 0]));
    const dist = new Map(ids.map((i) => [i, -1]));
    sigma.set(s, 1);
    dist.set(s, 0);
    const queue = [s];
    for (let qi = 0; qi < queue.length; qi++) {
      const v = queue[qi];
      stack.push(v);
      for (const w of adj.get(v)!.keys()) {
        if (dist.get(w)! < 0) {
          queue.push(w);
          dist.set(w, dist.get(v)! + 1);
        }
        if (dist.get(w) === dist.get(v)! + 1) {
          sigma.set(w, sigma.get(w)! + sigma.get(v)!);
          pred.get(w)!.push(v);
        }
      }
    }
    const delta = new Map(ids.map((i) => [i, 0]));
    while (stack.length) {
      const w = stack.pop()!;
      for (const v of pred.get(w)!) {
        delta.set(v, delta.get(v)! + (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!));
      }
      if (w !== s) cb.set(w, cb.get(w)! + delta.get(w)!);
    }
  }

  // Each undirected pair was counted twice; normalise by (n-1)(n-2)/2.
  const n = ids.length;
  const norm = n > 2 ? (n - 1) * (n - 2) : 1;
  for (const [id, v] of cb) cb.set(id, v / norm);
  return cb;
}

/** Share of possible undirected edges that exist. */
export function density(g: NetworkGraph): number {
  const n = g.nodes.length;
  if (n < 2) return 0;
  let edges = 0;
  for (const nbrs of adjacency(g).values()) edges += nbrs.size;
  return edges / (n * (n - 1)); // (sum of degrees / 2) / (n(n-1)/2)
}

/**
 * Deterministic community detection: modularity-based local moving (the first
 * phase of the Louvain method). Returns node id → community index, where
 * index 0 is the largest community.
 */
export function detectCommunities(g: NetworkGraph, maxIterations = 30): Map<string, number> {
  const adj = adjacency(g);
  const ids = [...adj.keys()].sort();
  const strength = new Map<string, number>(); // weighted degree k_i
  let twoM = 0;
  for (const id of ids) {
    let k = 0;
    for (const w of adj.get(id)!.values()) k += w;
    strength.set(id, k);
    twoM += k;
  }

  const community = new Map(ids.map((id, i) => [id, i]));
  const total = new Map(ids.map((id, i) => [i, strength.get(id)!])); // Σ k over community

  if (twoM > 0) {
    for (let iter = 0; iter < maxIterations; iter++) {
      let moved = false;
      for (const id of ids) {
        const ki = strength.get(id)!;
        if (ki === 0) continue;
        const own = community.get(id)!;
        total.set(own, total.get(own)! - ki);

        const toCommunity = new Map<number, number>();
        for (const [nbr, w] of adj.get(id)!) {
          const c = community.get(nbr)!;
          toCommunity.set(c, (toCommunity.get(c) ?? 0) + w);
        }
        const gain = (c: number) => (toCommunity.get(c) ?? 0) - (total.get(c)! * ki) / twoM;

        let best = own;
        let bestGain = gain(own);
        for (const c of [...toCommunity.keys()].sort((a, b) => a - b)) {
          const gc = gain(c);
          if (gc > bestGain + 1e-12) {
            best = c;
            bestGain = gc;
          }
        }
        total.set(best, total.get(best)! + ki);
        if (best !== own) {
          community.set(id, best);
          moved = true;
        }
      }
      if (!moved) break;
    }
  }

  const sizes = new Map<number, number>();
  for (const c of community.values()) sizes.set(c, (sizes.get(c) ?? 0) + 1);
  const order = [...sizes].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([c]) => c);
  const index = new Map(order.map((c, i) => [c, i]));
  return new Map(ids.map((id) => [id, index.get(community.get(id)!)!]));
}
