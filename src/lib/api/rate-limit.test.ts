import { beforeEach, describe, expect, it } from "vitest";
import { rateLimit, resetRateLimits } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(resetRateLimits);

  it("allows up to the limit then blocks with a retry hint", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) expect(rateLimit("u", 3, 60_000, t + i).ok).toBe(true);
    const blocked = rateLimit("u", 3, 60_000, t + 10);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("recovers after the window and isolates keys", () => {
    const t = 5_000_000;
    for (let i = 0; i < 2; i++) rateLimit("a", 2, 1000, t);
    expect(rateLimit("a", 2, 1000, t + 10).ok).toBe(false);
    expect(rateLimit("b", 2, 1000, t + 10).ok).toBe(true);
    expect(rateLimit("a", 2, 1000, t + 1500).ok).toBe(true);
  });
});
