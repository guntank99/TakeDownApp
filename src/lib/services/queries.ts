import "server-only";

import { enumParam, param, type SearchParams } from "@/lib/utils/params";
import { PLATFORMS } from "@/lib/utils/platforms";
import type { IndicatorKey, Platform, Post, PostStatus, RiskLevel, Sentiment } from "@/types";
import type { AnalysisContext } from "./analysis";

export const SENTIMENTS: readonly Sentiment[] = ["positive", "neutral", "negative"];
export const RISK_LEVELS: readonly RiskLevel[] = ["low", "medium", "high", "critical"];
export const POST_STATUSES: readonly PostStatus[] = ["new", "needs_review", "reviewed"];
export const CATEGORY_KEYS = [
  "hate_speech", "harassment", "threat", "spam", "misinformation", "defamation", "impersonation", "coordinated",
] as const;
export const CATEGORY_LABELS: Record<(typeof CATEGORY_KEYS)[number], string> = {
  hate_speech: "Hate speech",
  harassment: "Harassment",
  threat: "Threat",
  spam: "Spam",
  misinformation: "Misinformation",
  defamation: "Defamation",
  impersonation: "Impersonation",
  coordinated: "Coordinated posting",
};

export interface PostFilters {
  q: string;
  platform: Platform | "";
  from: string;
  to: string;
  sentiment: Sentiment | "";
  risk: RiskLevel | "";
  category: (typeof CATEGORY_KEYS)[number] | "";
  status: PostStatus | "";
  account: string;
  issue: string;
  sort: "recent" | "risk";
}

export function parsePostFilters(sp: SearchParams, defaultSort: PostFilters["sort"] = "recent"): PostFilters {
  const date = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(param(sp, k)) ? param(sp, k) : "");
  return {
    q: param(sp, "q").slice(0, 200),
    platform: enumParam(sp, "platform", PLATFORMS),
    from: date("from"),
    to: date("to"),
    sentiment: enumParam(sp, "sentiment", SENTIMENTS),
    risk: enumParam(sp, "risk", RISK_LEVELS),
    category: enumParam(sp, "category", CATEGORY_KEYS),
    status: enumParam(sp, "status", POST_STATUSES),
    account: param(sp, "account").slice(0, 64),
    issue: param(sp, "issue").slice(0, 64),
    sort: enumParam(sp, "sort", ["recent", "risk"] as const) || defaultSort,
  };
}

/** Values suitable for FilterPanel / Pagination (only non-empty filters). */
export function filtersToParams(f: PostFilters): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(f)) if (v) out[k] = String(v);
  return out;
}

export function filterPosts(ctx: AnalysisContext, f: PostFilters): Post[] {
  const q = f.q.toLowerCase();
  const rows = ctx.posts.filter((p) => {
    const a = ctx.postAnalysis.get(p.id)!;
    if (f.platform && p.platform !== f.platform) return false;
    if (f.from && p.createdAt.slice(0, 10) < f.from) return false;
    if (f.to && p.createdAt.slice(0, 10) > f.to) return false;
    if (f.sentiment && a.content.sentiment.sentiment !== f.sentiment) return false;
    if (f.risk && a.risk.level !== f.risk) return false;
    if (f.status && p.status !== f.status) return false;
    if (f.account && p.authorId !== f.account) return false;
    if (f.issue && p.issueId !== f.issue) return false;
    if (f.category) {
      const hit = f.category === "coordinated" ? a.coordinationGroupSize >= 3 : a.content.flagged.includes(f.category as IndicatorKey);
      if (!hit) return false;
    }
    if (q) {
      const author = ctx.accountById.get(p.authorId);
      const hay = [p.id, p.text, p.url, ...p.hashtags, author?.handle ?? "", author?.displayName ?? ""].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  return rows.sort((a, b) =>
    f.sort === "risk"
      ? ctx.postAnalysis.get(b.id)!.risk.score - ctx.postAnalysis.get(a.id)!.risk.score || b.createdAt.localeCompare(a.createdAt)
      : b.createdAt.localeCompare(a.createdAt),
  );
}
