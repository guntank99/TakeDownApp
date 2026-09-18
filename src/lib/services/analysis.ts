import "server-only";

import claimsJson from "@/data/mock-claims.json";
import {
  authenticityConcern,
  authenticitySignals,
  behaviorPoints,
  impersonationIndicator,
  accountAgeDays,
} from "@/lib/analysis/account";
import { analyzeComment } from "@/lib/analysis/comments";
import { coordinationPoints, findCoordinatedGroups, type CoordinationInfo } from "@/lib/analysis/coordination";
import { analyzeContent } from "@/lib/analysis/indicators";
import { getProvider } from "@/lib/providers";
import { calculateRisk, contentRiskPoints } from "@/lib/risk/score";
import { analyzeNetwork, type AccountContentInfo } from "@/lib/sna/analyze";
import { buildNetwork } from "@/lib/sna/build";
import { adjacency } from "@/lib/sna/metrics";
import { matchPolicy } from "@/lib/toc/match";
import { listPolicyRules } from "@/lib/toc/rules";
import type {
  Account,
  AccountAnalysis,
  Claim,
  Comment,
  CommentAnalysis,
  ContentAnalysis,
  Issue,
  NetworkAnalysis,
  Post,
  PostAnalysis,
  Provenance,
} from "@/types";

export interface AnalysisContext {
  source: { label: string; isMock: boolean };
  /** Reference time for age calculations: the newest observed post. */
  now: number;
  posts: Post[];
  accounts: Account[];
  comments: Comment[];
  issues: Issue[];
  claims: Claim[];
  postById: Map<string, Post>;
  accountById: Map<string, Account>;
  postAnalysis: Map<string, PostAnalysis>;
  accountAnalysis: Map<string, AccountAnalysis>;
  commentAnalysis: Map<string, CommentAnalysis>;
  coordination: Map<string, CoordinationInfo>;
  network: NetworkAnalysis;
}

const mockProvenance: Provenance = {
  source: "mock-dataset",
  collectionMethod: "simulated",
  collectedAt: "2026-09-18T00:00:00Z",
  isMock: true,
};

async function build(): Promise<AnalysisContext> {
  const provider = getProvider();
  const [posts, accounts, comments, issues, interactions] = await Promise.all([
    provider.searchPosts(""),
    provider.listAccounts(),
    provider.listComments(),
    provider.getTrendingTopics(),
    provider.getInteractions(),
  ]);
  const rules = listPolicyRules();
  const postById = new Map(posts.map((p) => [p.id, p]));
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const now = posts.reduce((m, p) => Math.max(m, Date.parse(p.createdAt)), 0) || Date.now();

  // 1. content analysis + coordination
  const content = new Map<string, ContentAnalysis>(posts.map((p) => [p.id, analyzeContent(p.text)]));
  const coordination = findCoordinatedGroups(posts);

  // 2. network
  const graph = buildNetwork({ accounts, posts, comments, issues, interactions });
  const issueById = new Map(issues.map((i) => [i.id, i]));
  const accountContent = new Map<string, AccountContentInfo[]>();
  for (const p of posts) {
    accountContent.set(p.authorId, [
      ...(accountContent.get(p.authorId) ?? []),
      { sentiment: content.get(p.id)!.sentiment.sentiment, issueTitle: p.issueId ? (issueById.get(p.issueId)?.title ?? null) : null },
    ]);
  }
  const network = analyzeNetwork(graph, accountContent);
  const adj = adjacency(graph);

  // 3. account-level analysis
  const postsByAccount = new Map<string, Post[]>();
  for (const p of posts) postsByAccount.set(p.authorId, [...(postsByAccount.get(p.authorId) ?? []), p]);
  const maxDegC = Math.max(1e-9, ...accounts.map((a) => network.metrics[a.id]?.degreeCentrality ?? 0));
  const contentPoints = (postId: string) => contentRiskPoints(content.get(postId)!);
  const accountMaxContent = new Map<string, number>(
    accounts.map((a) => [a.id, Math.max(0, ...(postsByAccount.get(a.id) ?? []).map((p) => contentPoints(p.id)))]),
  );

  const accountAnalysis = new Map<string, AccountAnalysis>();
  for (const a of accounts) {
    const own = postsByAccount.get(a.id) ?? [];
    const avgEngagement = own.length ? own.reduce((s, p) => s + p.likes + p.shares + p.comments, 0) / own.length : 0;
    const coordAccounts = Math.max(0, ...own.map((p) => coordination.get(p.id)?.accounts ?? 0));
    const neighbors = [...(adj.get(a.id)?.keys() ?? [])].map((id) => accountById.get(id)).filter((x): x is Account => Boolean(x));
    const youngNeighbors = neighbors.filter((n) => accountAgeDays(n, now) < 90).length;

    const signals = authenticitySignals(a, { now, avgEngagementPerPost: avgEngagement, coordinationAccounts: coordAccounts, youngNeighbors });
    const concern = authenticityConcern(signals);

    const contents = own.map((p) => contentPoints(p.id));
    const contentRisk = contents.length ? 0.6 * Math.max(...contents) + 0.4 * (contents.reduce((s, x) => s + x, 0) / contents.length) : 0;
    const flaggedNeighborRatio = neighbors.length ? neighbors.filter((n) => (accountMaxContent.get(n.id) ?? 0) >= 20).length / neighbors.length : 0;
    const degNorm = (network.metrics[a.id]?.degreeCentrality ?? 0) / maxDegC;
    const networkRisk = 20 * flaggedNeighborRatio * (0.5 + 0.5 * degNorm);

    const factors = signals.filter((s) => s.flagged).map((s) => `${s.label}: ${s.value}`);
    accountAnalysis.set(a.id, {
      accountId: a.id,
      signals,
      authenticityConcern: concern,
      authenticityLabel: concern >= 50 ? "Berpotensi Tidak Autentik" : "Tidak ada kekhawatiran autentisitas yang kuat",
      risk: calculateRisk(
        { content: contentRisk, behavior: behaviorPoints(signals), network: networkRisk, coordination: coordinationPoints(coordAccounts) },
        factors,
      ),
      degreeCentrality: network.metrics[a.id]?.degreeCentrality ?? 0,
      networkRole: network.roles[a.id] ?? null,
      impersonation: impersonationIndicator(a, now),
    });
  }

  // 4. post-level analysis
  const postAnalysis = new Map<string, PostAnalysis>();
  for (const p of posts) {
    const c = content.get(p.id)!;
    const author = accountAnalysis.get(p.authorId);
    const coord = coordination.get(p.id);
    const authorRisk = author?.risk.components;
    const factors = [
      ...c.flagged.map((k) => c.indicators[k].label),
      ...(coord ? [`Teks hampir identik diposting oleh ${coord.accounts} akun`] : []),
      ...(author?.authenticityLabel === "Berpotensi Tidak Autentik" ? ["Penulis menunjukkan perilaku yang berpotensi tidak autentik"] : []),
    ];
    postAnalysis.set(p.id, {
      postId: p.id,
      content: c,
      coordinationGroupSize: coord?.accounts ?? 0,
      risk: calculateRisk(
        {
          content: contentRiskPoints(c),
          behavior: authorRisk?.behavior ?? 0,
          network: authorRisk?.network ?? 0,
          coordination: coordinationPoints(coord?.accounts ?? 0),
        },
        factors,
      ),
      policyMatches: matchPolicy({ platform: p.platform, content: c, coordinationAccounts: coord?.accounts }, rules),
    });
  }

  const commentAnalysis = new Map<string, CommentAnalysis>(comments.map((c) => [c.id, analyzeComment(c)]));
  const claims: Claim[] = provider.isMock
    ? (claimsJson as unknown as Omit<Claim, "provenance">[]).map((c) => ({ ...c, provenance: mockProvenance }))
    : [];

  return {
    source: { label: provider.label, isMock: provider.isMock },
    now, posts, accounts, comments, issues, claims, postById, accountById,
    postAnalysis, accountAnalysis, commentAnalysis, coordination, network,
  };
}

const TTL_MS = 60_000;
const g = globalThis as unknown as { __sentinelAnalysis?: { at: number; key: string; value: Promise<AnalysisContext> } };

/** Builds (and caches) the full analysis for the active provider. */
export function getAnalysisContext(): Promise<AnalysisContext> {
  const provider = getProvider();
  const cached = g.__sentinelAnalysis;
  const fresh = cached && cached.key === provider.id && (provider.isMock || Date.now() - cached.at < TTL_MS);
  if (fresh) return cached.value;
  const value = build();
  g.__sentinelAnalysis = { at: Date.now(), key: provider.id, value };
  value.catch(() => {
    if (g.__sentinelAnalysis?.value === value) g.__sentinelAnalysis = undefined;
  });
  return value;
}
