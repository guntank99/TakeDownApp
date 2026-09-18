import { describe, expect, it } from "vitest";
import type { IndicatorKey } from "@/types";
import { getAnalysisContext } from "./analysis";

/** Integration check: the engine + dataset behave as designed end-to-end. */
describe("analysis context on the mock dataset", () => {
  it("covers every record and stays within score bounds", async () => {
    const ctx = await getAnalysisContext();
    expect(ctx.posts).toHaveLength(100);
    expect(ctx.accounts).toHaveLength(50);
    expect(ctx.comments).toHaveLength(500);
    expect(ctx.issues).toHaveLength(20);
    expect(ctx.source.isMock).toBe(true);
    for (const a of ctx.postAnalysis.values()) {
      expect(a.risk.score).toBeGreaterThanOrEqual(0);
      expect(a.risk.score).toBeLessThanOrEqual(100);
      const c = a.risk.components;
      expect(c.content + c.behavior + c.network + c.coordination).toBe(a.risk.score);
    }
    expect(ctx.postAnalysis.size).toBe(100);
    expect(ctx.accountAnalysis.size).toBe(50);
    expect(ctx.commentAnalysis.size).toBe(500);
  });

  it("flags the planted scenarios for human review, and leaves benign posts alone", async () => {
    const ctx = await getAnalysisContext();
    const flaggedBy = (key: IndicatorKey) =>
      [...ctx.postAnalysis.values()].filter((a) => a.content.flagged.includes(key)).length;
    expect(flaggedBy("hate_speech")).toBeGreaterThanOrEqual(6);
    expect(flaggedBy("misinformation")).toBeGreaterThanOrEqual(10);
    expect(flaggedBy("spam")).toBeGreaterThanOrEqual(3);
    expect(flaggedBy("impersonation")).toBeGreaterThanOrEqual(3);
    const flagged = [...ctx.postAnalysis.values()].filter((a) => a.content.status === "NEEDS_HUMAN_REVIEW");
    expect(flagged.length).toBeLessThan(ctx.posts.length / 2);
    const benign = ctx.posts.filter((p) => !p.claimId && ctx.postAnalysis.get(p.id)!.content.flagged.length === 0);
    expect(benign.length).toBeGreaterThan(50);
  });

  it("finds coordinated amplification and hedges account labels", async () => {
    const ctx = await getAnalysisContext();
    expect(ctx.coordination.size).toBeGreaterThanOrEqual(10);
    const labels = new Set([...ctx.accountAnalysis.values()].map((a) => a.authenticityLabel));
    expect([...labels].every((l) => l === "Potentially Inauthentic" || l === "No strong authenticity concerns")).toBe(true);
    const inauthentic = [...ctx.accountAnalysis.values()].filter((a) => a.authenticityLabel === "Potentially Inauthentic");
    expect(inauthentic.length).toBeGreaterThanOrEqual(6);
  });

  it("builds a connected network with neutral role labels", async () => {
    const ctx = await getAnalysisContext();
    expect(ctx.network.graph.nodes.length).toBeGreaterThan(100);
    expect(ctx.network.clusters.length).toBeGreaterThanOrEqual(3);
    for (const role of Object.values(ctx.network.roles)) {
      expect(["Highly Connected Account", "Potential Network Hub"]).toContain(role);
    }
    for (const pos of Object.values(ctx.network.positions)) expect(Number.isFinite(pos.x + pos.y)).toBe(true);
  });

  it("only attaches policy matches that need review", async () => {
    const ctx = await getAnalysisContext();
    const matches = [...ctx.postAnalysis.values()].flatMap((a) => a.policyMatches);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((m) => m.status === "NEEDS_REVIEW")).toBe(true);
    expect(matches.some((m) => !m.ruleVerified)).toBe(true); // unverified X/TikTok/Reddit rules stay flagged
  });
});
