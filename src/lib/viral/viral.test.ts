import { describe, expect, it } from "vitest";
import { engagementOf, viralScores } from "./score";

const NOW = Date.parse("2026-09-17T12:00:00Z");
const post = (id: string, likes: number, comments: number, shares: number, hoursAgo: number) => ({
  id, likes, comments, shares, createdAt: new Date(NOW - hoursAgo * 3_600_000).toISOString(),
});

describe("viral score", () => {
  it("weights shares and comments above likes", () => {
    expect(engagementOf({ likes: 10, comments: 10, shares: 10 })).toBe(60);
    expect(engagementOf({ likes: 30, comments: 0, shares: 0 })).toBe(30);
  });

  it("ranks by speed of engagement, not just totals", () => {
    const s = viralScores([post("fast", 1000, 100, 100, 2), post("big-but-old", 3000, 300, 300, 200), post("quiet", 5, 0, 0, 5)], NOW);
    expect(s.get("fast")!.score).toBe(100);
    expect(s.get("fast")!.score).toBeGreaterThan(s.get("big-but-old")!.score);
    expect(s.get("big-but-old")!.score).toBeGreaterThan(s.get("quiet")!.score);
  });

  it("stays within 0–100 and handles empty input and brand-new posts", () => {
    expect(viralScores([], NOW).size).toBe(0);
    const s = viralScores([post("now", 50, 5, 5, 0), post("zero", 0, 0, 0, 3)], NOW);
    for (const v of s.values()) {
      expect(v.score).toBeGreaterThanOrEqual(0);
      expect(v.score).toBeLessThanOrEqual(100);
    }
    expect(s.get("zero")!.score).toBe(0);
  });
});
