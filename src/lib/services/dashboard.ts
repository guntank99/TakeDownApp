import "server-only";

import { INDICATOR_LABELS } from "@/lib/analysis/indicators";
import { getRiskLevel } from "@/lib/risk/level";
import { PLATFORM_LABEL, PLATFORMS } from "@/lib/utils/platforms";
import type { Platform, RiskLevel } from "@/types";
import { getAnalysisContext } from "./analysis";
import { listCases } from "./cases";
import { listReports } from "./reports";

export interface DashboardSummary {
  dataSource: { label: string; isMock: boolean };
  totalPosts: number;
  postsNeedingReview: number;
  totalAccounts: number;
  activeIssues: number;
  trackedIssues: number;
  highRiskAccounts: number;
  potentialViolations: number;
  totalCases: number;
  openCases: number;
  totalReports: number;
  submittedReports: number;
  mentionsOverTime: { date: string; posts: number; comments: number }[];
  platformDistribution: { platform: Platform; label: string; count: number }[];
  sentiment: { name: "Positive" | "Neutral" | "Negative"; value: number }[];
  riskDistribution: { level: RiskLevel; count: number }[];
  violationCategories: { label: string; count: number }[];
  trendingIssues: { title: string; volume: number; growth: number }[];
  networkGrowth: { date: string; accounts: number }[];
}

const day = (iso: string) => iso.slice(0, 10);

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const ctx = await getAnalysisContext();
  const [cases, reports] = [listCases(), await listReports()];

  // last 14 days ending at the newest observed activity
  const end = new Date(ctx.now);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - (13 - i)));
    return d.toISOString().slice(0, 10);
  });
  const bucket = (dates: string[]) => days.map((d) => dates.filter((x) => day(x) === d).length);
  const postSeries = bucket(ctx.posts.map((p) => p.createdAt));
  const commentSeries = bucket(ctx.comments.map((c) => c.createdAt));

  // first day each account appears (post or comment) → cumulative growth
  const firstSeen = new Map<string, string>();
  for (const item of [...ctx.posts, ...ctx.comments]) {
    const d = day(item.createdAt);
    const prev = firstSeen.get(item.authorId);
    if (!prev || d < prev) firstSeen.set(item.authorId, d);
  }
  const networkGrowth = days.map((d) => ({
    date: d,
    accounts: [...firstSeen.values()].filter((f) => f <= d).length,
  }));

  const analyses = [...ctx.postAnalysis.values()];
  const violationCounts = new Map<string, number>();
  for (const a of analyses) for (const k of a.content.flagged) {
    violationCounts.set(INDICATOR_LABELS[k], (violationCounts.get(INDICATOR_LABELS[k]) ?? 0) + 1);
  }
  const coordinated = analyses.filter((a) => a.coordinationGroupSize >= 3).length;
  if (coordinated) violationCounts.set("Coordinated Posting Indicator", coordinated);

  const levels: RiskLevel[] = ["low", "medium", "high", "critical"];
  const sentimentCount = { positive: 0, neutral: 0, negative: 0 };
  for (const a of analyses) sentimentCount[a.content.sentiment.sentiment]++;

  return {
    dataSource: ctx.source,
    totalPosts: ctx.posts.length,
    postsNeedingReview: ctx.posts.filter((p) => p.status === "needs_review").length,
    totalAccounts: ctx.accounts.length,
    activeIssues: ctx.issues.filter((i) => i.status === "active").length,
    trackedIssues: ctx.issues.length,
    highRiskAccounts: [...ctx.accountAnalysis.values()].filter((a) => a.risk.score >= 50).length,
    potentialViolations: analyses.filter((a) => a.policyMatches.length > 0).length,
    totalCases: cases.length,
    openCases: cases.filter((c) => c.status !== "CLOSED").length,
    totalReports: reports.length,
    submittedReports: reports.filter((r) => r.status === "submitted").length,
    mentionsOverTime: days.map((date, i) => ({ date, posts: postSeries[i], comments: commentSeries[i] })),
    platformDistribution: PLATFORMS.map((p) => ({ platform: p, label: PLATFORM_LABEL[p], count: ctx.posts.filter((x) => x.platform === p).length }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count),
    sentiment: [
      { name: "Positive", value: sentimentCount.positive },
      { name: "Neutral", value: sentimentCount.neutral },
      { name: "Negative", value: sentimentCount.negative },
    ],
    riskDistribution: levels.map((level) => ({ level, count: analyses.filter((a) => getRiskLevel(a.risk.score) === level).length })),
    violationCategories: [...violationCounts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
    trendingIssues: [...ctx.issues].sort((a, b) => b.volume - a.volume).slice(0, 8).map((i) => ({ title: i.title, volume: i.volume, growth: i.growth })),
    networkGrowth,
  };
}
