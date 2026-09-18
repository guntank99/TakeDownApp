/**
 * Small in-memory sliding-window limiter. Good enough to blunt abuse of a
 * single server instance; on serverless each instance has its own memory, so
 * production should move this to a shared store (e.g. Redis/Upstash).
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs = 60_000, now = Date.now()) {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return { ok: false as const, retryAfter: Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000)) };
  }
  recent.push(now);
  hits.set(key, recent);
  // opportunistic cleanup so the map cannot grow without bound
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  return { ok: true as const, remaining: limit - recent.length };
}

/** Test helper. */
export function resetRateLimits() {
  hits.clear();
}
