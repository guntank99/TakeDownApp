import { withApi } from "@/lib/api/handler";
import { getAnalysisContext } from "@/lib/services/analysis";

/** GET /api/issues: issues with counts derived from their related posts. */
export const GET = withApi({}, async () => {
  const ctx = await getAnalysisContext();
  const items = ctx.issues.map((issue) => {
    const posts = ctx.posts.filter((p) => p.issueId === issue.id);
    return {
      ...issue,
      relatedPosts: posts.length,
      relatedAccounts: new Set(posts.map((p) => p.authorId)).size,
      maxRiskScore: Math.max(0, ...posts.map((p) => ctx.postAnalysis.get(p.id)!.risk.score)),
    };
  });
  return { items: items.sort((a, b) => b.volume - a.volume), source: ctx.source };
});
