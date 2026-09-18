import type {
  ClusterSummary,
  NetworkAnalysis,
  NetworkGraph,
  NetworkRole,
  NodeMetrics,
  Sentiment,
} from "@/types";
import {
  betweennessCentrality,
  degreeCentrality,
  degrees,
  density,
  detectCommunities,
} from "./metrics";
import { forceLayout } from "./layout";

export interface AccountContentInfo {
  sentiment: Sentiment;
  issueTitle: string | null;
}

const CLUSTER_NAMES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** value at or above the given percentile (0–1) of `values` */
function percentileThreshold(values: number[], p: number): number {
  if (values.length === 0) return Infinity;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

const top = <T,>(counts: Map<T, number>, n: number): T[] =>
  [...counts].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);

/**
 * Full network analysis. Roles use neutral wording only: a highly central
 * account is a "Highly Connected Account" or "Potential Network Hub" — the
 * data shows connections, not intent or control.
 */
export function analyzeNetwork(
  graph: NetworkGraph,
  accountContent: Map<string, AccountContentInfo[]> = new Map(),
): NetworkAnalysis {
  const deg = degrees(graph);
  const degC = degreeCentrality(graph);
  const btw = betweennessCentrality(graph);
  const comm = detectCommunities(graph);

  const metrics: Record<string, NodeMetrics> = {};
  for (const n of graph.nodes) {
    metrics[n.id] = {
      id: n.id,
      degree: deg.get(n.id) ?? 0,
      degreeCentrality: degC.get(n.id) ?? 0,
      betweenness: btw.get(n.id) ?? 0,
      community: comm.get(n.id) ?? 0,
    };
  }

  // Roles: only account nodes, top decile of degree / betweenness.
  const accounts = graph.nodes.filter((n) => n.type === "account");
  const degThreshold = percentileThreshold(accounts.map((a) => metrics[a.id].degreeCentrality), 0.9);
  const btwThreshold = percentileThreshold(accounts.map((a) => metrics[a.id].betweenness), 0.9);
  const roles: Record<string, NetworkRole> = {};
  for (const a of accounts) {
    const m = metrics[a.id];
    if (m.betweenness > 0 && m.betweenness >= btwThreshold) roles[a.id] = "Potential Network Hub";
    else if (m.degree > 0 && m.degreeCentrality >= degThreshold) roles[a.id] = "Highly Connected Account";
  }

  // Clusters: communities with at least three nodes, at least one of them an account.
  const byCluster = new Map<number, typeof graph.nodes>();
  for (const n of graph.nodes) {
    byCluster.set(metrics[n.id].community, [...(byCluster.get(metrics[n.id].community) ?? []), n]);
  }
  const clusters: ClusterSummary[] = [];
  for (const [index, members] of [...byCluster].sort((a, b) => a[0] - b[0])) {
    if (members.length < 3 || !members.some((m) => m.type === "account")) continue;
    const topics = new Map<string, number>();
    const tags = new Map<string, number>();
    const platforms: ClusterSummary["platforms"] = {};
    const sentiment: Record<Sentiment, number> = { positive: 0, neutral: 0, negative: 0 };
    for (const m of members) {
      if (m.type === "hashtag") tags.set(m.label, deg.get(m.id) ?? 0);
      if (m.type === "topic") topics.set(m.label, deg.get(m.id) ?? 0);
      if (m.type === "account") {
        if (m.platform) platforms[m.platform] = (platforms[m.platform] ?? 0) + 1;
        for (const c of accountContent.get(m.id) ?? []) {
          sentiment[c.sentiment]++;
          if (c.issueTitle) topics.set(c.issueTitle, (topics.get(c.issueTitle) ?? 0) + 1);
        }
      }
    }
    clusters.push({
      index,
      name: `Cluster ${CLUSTER_NAMES[clusters.length] ?? clusters.length + 1}`,
      nodeCount: members.length,
      dominantTopic: top(topics, 1)[0] ?? null,
      dominantHashtags: top(tags, 3),
      sentiment,
      platforms,
      importantNodes: [...members]
        .sort((a, b) => metrics[b.id].degree - metrics[a.id].degree)
        .slice(0, 3)
        .map((m) => ({ id: m.id, label: m.label, degree: metrics[m.id].degree })),
    });
  }

  return {
    graph,
    metrics,
    density: density(graph),
    clusters,
    roles,
    positions: forceLayout(graph, comm),
  };
}
