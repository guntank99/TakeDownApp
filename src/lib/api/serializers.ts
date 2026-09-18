import "server-only";

import type { AnalysisContext } from "@/lib/services/analysis";
import type { Account, Post } from "@/types";

/** Compact JSON shapes for list endpoints (details come from the [id] routes). */
export function summarizePost(ctx: AnalysisContext, p: Post) {
  const a = ctx.postAnalysis.get(p.id)!;
  return {
    id: p.id,
    platform: p.platform,
    url: p.url,
    author: ctx.accountById.get(p.authorId)?.handle ?? p.authorId,
    authorId: p.authorId,
    text: p.text,
    createdAt: p.createdAt,
    likes: p.likes,
    comments: p.comments,
    shares: p.shares,
    views: p.views,
    status: p.status,
    sentiment: a.content.sentiment.sentiment,
    riskScore: a.risk.score,
    riskLevel: a.risk.level,
    flagged: a.content.flagged,
    provenance: p.provenance,
  };
}

export function summarizeAccount(ctx: AnalysisContext, a: Account) {
  const an = ctx.accountAnalysis.get(a.id)!;
  return {
    id: a.id,
    platform: a.platform,
    handle: a.handle,
    displayName: a.displayName,
    followers: a.followers,
    following: a.following,
    createdAt: a.createdAt,
    authenticityLabel: an.authenticityLabel,
    authenticityConcern: an.authenticityConcern,
    riskScore: an.risk.score,
    riskLevel: an.risk.level,
    networkRole: an.networkRole,
    provenance: a.provenance,
  };
}
