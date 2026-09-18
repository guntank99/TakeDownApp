import type { NetworkGraph } from "@/types";

/** Small stable string hash → 0..1, so the layout is reproducible. */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 100000) / 100000;
}

/**
 * Deterministic Fruchterman–Reingold layout. Nodes start near a per-community
 * anchor on a circle, so communities stay visually grouped.
 */
export function forceLayout(
  g: NetworkGraph,
  communities: Map<string, number>,
  { width = 2000, height = 1300, iterations = 200, gravity = 0.02 } = {},
): Record<string, { x: number; y: number }> {
  const n = g.nodes.length;
  if (n === 0) return {};
  const k = Math.sqrt((width * height) / n) * 0.9;
  const groups = Math.max(1, new Set(communities.values()).size);

  const pos = new Map<string, { x: number; y: number }>();
  for (const node of g.nodes) {
    const c = communities.get(node.id) ?? 0;
    const angle = (2 * Math.PI * c) / groups;
    pos.set(node.id, {
      x: width / 2 + Math.cos(angle) * width * 0.3 + (hash01(node.id + "x") - 0.5) * k * 2,
      y: height / 2 + Math.sin(angle) * height * 0.3 + (hash01(node.id + "y") - 0.5) * k * 2,
    });
  }

  const ids = g.nodes.map((x) => x.id);
  let temp = width / 8;
  for (let it = 0; it < iterations; it++) {
    const disp = new Map(ids.map((id) => [id, { x: 0, y: 0 }]));

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = pos.get(ids[i])!;
        const b = pos.get(ids[j])!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d = Math.hypot(dx, dy);
        if (d < 0.01) {
          // coincident nodes: push apart in a deterministic direction
          dx = hash01(ids[i]) - 0.5;
          dy = hash01(ids[j]) - 0.5;
          d = 0.5;
        }
        const f = (k * k) / d;
        const da = disp.get(ids[i])!;
        const db = disp.get(ids[j])!;
        da.x += (dx / d) * f;
        da.y += (dy / d) * f;
        db.x -= (dx / d) * f;
        db.y -= (dy / d) * f;
      }
    }

    for (const e of g.edges) {
      const a = pos.get(e.source);
      const b = pos.get(e.target);
      if (!a || !b) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d = Math.max(Math.hypot(dx, dy), 0.01);
      const f = (d * d) / k;
      const da = disp.get(e.source)!;
      const db = disp.get(e.target)!;
      da.x -= (dx / d) * f;
      da.y -= (dy / d) * f;
      db.x += (dx / d) * f;
      db.y += (dy / d) * f;
    }

    for (const id of ids) {
      const p = pos.get(id)!;
      const dv = disp.get(id)!;
      // weak gravity keeps disconnected nodes from drifting away
      dv.x += (width / 2 - p.x) * gravity;
      dv.y += (height / 2 - p.y) * gravity;
      const d = Math.max(Math.hypot(dv.x, dv.y), 0.01);
      const step = Math.min(d, temp);
      p.x += (dv.x / d) * step;
      p.y += (dv.y / d) * step;
    }
    temp *= 0.96;
  }

  compressOutliers(pos);

  const out: Record<string, { x: number; y: number }> = {};
  for (const [id, p] of pos) out[id] = { x: Math.round(p.x), y: Math.round(p.y) };
  return out;
}

/**
 * Pulls far-flung nodes (typically leaf hashtags) closer to the centre while
 * keeping their direction. Otherwise a few outliers force the viewer to zoom
 * out so far that the dense core becomes unreadable.
 */
function compressOutliers(pos: Map<string, { x: number; y: number }>, percentile = 0.85, factor = 0.3) {
  const pts = [...pos.values()];
  if (pts.length < 10) return;
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const radii = pts.map((p) => Math.hypot(p.x - cx, p.y - cy)).sort((a, b) => a - b);
  const limit = radii[Math.floor(radii.length * percentile)];
  for (const p of pts) {
    const r = Math.hypot(p.x - cx, p.y - cy);
    if (r <= limit || r === 0) continue;
    const scaled = limit + (r - limit) * factor;
    p.x = cx + ((p.x - cx) / r) * scaled;
    p.y = cy + ((p.y - cy) / r) * scaled;
  }
}
