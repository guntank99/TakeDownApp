import { describe, expect, it } from "vitest";
import type { NetEdge, NetNode, NetworkGraph, Provenance } from "@/types";
import { analyzeNetwork } from "./analyze";
import { buildNetwork } from "./build";
import { forceLayout } from "./layout";
import {
  betweennessCentrality,
  degreeCentrality,
  density,
  detectCommunities,
} from "./metrics";

const node = (id: string, type: NetNode["type"] = "account"): NetNode => ({ id, type, label: id });
const edge = (s: string, t: string): NetEdge => ({ id: `${s}-${t}`, source: s, target: t, type: "interaction", weight: 1 });
const graph = (ids: string[], pairs: [string, string][]): NetworkGraph => ({
  nodes: ids.map((i) => node(i)),
  edges: pairs.map(([s, t]) => edge(s, t)),
});

describe("centrality", () => {
  it("path a-b-c: the middle node has betweenness 1", () => {
    const g = graph(["a", "b", "c"], [["a", "b"], ["b", "c"]]);
    const b = betweennessCentrality(g);
    expect(b.get("b")).toBeCloseTo(1);
    expect(b.get("a")).toBe(0);
  });

  it("star: centre has degree centrality 1 and all the betweenness", () => {
    const g = graph(["h", "1", "2", "3", "4"], [["h", "1"], ["h", "2"], ["h", "3"], ["h", "4"]]);
    expect(degreeCentrality(g).get("h")).toBe(1);
    expect(betweennessCentrality(g).get("h")).toBeCloseTo(1);
    expect(betweennessCentrality(g).get("1")).toBe(0);
  });

  it("merges opposite edges when computing degree", () => {
    const g = graph(["a", "b"], [["a", "b"], ["b", "a"]]);
    expect(degreeCentrality(g).get("a")).toBe(1);
  });
});

describe("density", () => {
  it("triangle = 1, path of 3 = 2/3, edgeless = 0", () => {
    expect(density(graph(["a", "b", "c"], [["a", "b"], ["b", "c"], ["a", "c"]]))).toBeCloseTo(1);
    expect(density(graph(["a", "b", "c"], [["a", "b"], ["b", "c"]]))).toBeCloseTo(2 / 3);
    expect(density(graph(["a", "b"], []))).toBe(0);
  });
});

describe("detectCommunities", () => {
  const g = graph(
    ["a1", "a2", "a3", "b1", "b2", "b3"],
    [["a1", "a2"], ["a2", "a3"], ["a1", "a3"], ["b1", "b2"], ["b2", "b3"], ["b1", "b3"], ["a3", "b1"]],
  );
  it("finds two triangles joined by a bridge", () => {
    const c = detectCommunities(g);
    expect(c.get("a1")).toBe(c.get("a2"));
    expect(c.get("b1")).toBe(c.get("b3"));
    expect(c.get("a1")).not.toBe(c.get("b1"));
  });
  it("is deterministic", () => {
    expect([...detectCommunities(g)]).toEqual([...detectCommunities(g)]);
  });
});

describe("analyzeNetwork", () => {
  const g = graph(
    ["h", "1", "2", "3", "4", "x", "y"],
    [["h", "1"], ["h", "2"], ["h", "3"], ["h", "4"], ["x", "y"]],
  );
  it("only uses neutral role wording", () => {
    const a = analyzeNetwork(g);
    const roles = new Set(Object.values(a.roles));
    for (const r of roles) expect(["Akun Sangat Terhubung", "Potensi Hub Jaringan"]).toContain(r);
    expect(a.roles["h"]).toBeDefined();
    expect(JSON.stringify(a.roles)).not.toMatch(/mastermind|leader|controller|culprit|dalang|otak|pemimpin|pengendali/i);
  });
  it("summarises only clusters of 3+ nodes that contain an account", () => {
    const a = analyzeNetwork(g);
    expect(a.clusters.map((c) => c.nodeCount)).toEqual([5]);
    expect(a.clusters[0].name).toBe("Cluster A");
  });
  it("layout is deterministic and finite", () => {
    const comm = detectCommunities(g);
    const p1 = forceLayout(g, comm);
    const p2 = forceLayout(g, comm);
    expect(p1).toEqual(p2);
    for (const p of Object.values(p1)) expect(Number.isFinite(p.x + p.y)).toBe(true);
  });
});

describe("buildNetwork", () => {
  const prov: Provenance = { source: "t", collectionMethod: "simulated", collectedAt: "2026-01-01T00:00:00Z", isMock: true };
  const acct = (id: string, handle: string) => ({
    id, handle, platform: "x" as const, displayName: handle, createdAt: "2020-01-01T00:00:00Z", followers: 1, following: 1,
    verified: false, postsPerDay: 1, profileCompleteness: 90, contentRepetition: 0, activitySpike: false, provenance: prov,
  });
  const post = (id: string, authorId: string, extra: object = {}) => ({
    id, authorId, platform: "x" as const, url: "u", text: "t", mediaType: "text" as const, hashtags: [], mentions: [],
    issueId: null, claimId: null, createdAt: "2026-01-01T00:00:00Z", likes: 0, comments: 0, shares: 0, views: 0,
    status: "new" as const, provenance: prov, ...extra,
  });

  it("derives mention, reply, hashtag and topic edges and accumulates weight", () => {
    const g = buildNetwork({
      accounts: [acct("A", "@a"), acct("B", "@b")],
      posts: [post("P1", "A", { mentions: ["@b"], hashtags: ["#Tag"] }), post("P2", "B")],
      comments: [
        { id: "C1", postId: "P1", authorId: "B", text: "x", createdAt: "", provenance: prov },
        { id: "C2", postId: "P1", authorId: "B", text: "y", createdAt: "", provenance: prov },
      ],
      issues: [{ id: "I1", title: "Topic", hashtag: "#Tag", platforms: ["x"], volume: 1, growth: 0, series: [], status: "active", firstDetectedAt: "", lastUpdatedAt: "", provenance: prov }],
      interactions: [{ id: "N1", type: "share", sourceAccountId: "B", targetAccountId: "A", postId: "P1", createdAt: "", provenance: prov }],
    });
    const byType = (t: string) => g.edges.filter((e) => e.type === t);
    expect(byType("mention")).toHaveLength(1);
    expect(byType("reply")[0].weight).toBe(2);
    expect(byType("hashtag")).toHaveLength(2); // A→#Tag and #Tag→topic
    expect(byType("share")).toHaveLength(1);
    expect(g.nodes.some((n) => n.type === "post" && n.id === "post:P1")).toBe(true);
    // every edge endpoint exists
    const ids = new Set(g.nodes.map((n) => n.id));
    for (const e of g.edges) expect(ids.has(e.source) && ids.has(e.target)).toBe(true);
  });
});
