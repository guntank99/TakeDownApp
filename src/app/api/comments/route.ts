import { pageOf, withApi } from "@/lib/api/handler";
import { getAnalysisContext } from "@/lib/services/analysis";
import { param, paginate } from "@/lib/utils/params";

/** GET /api/comments?postId=&category=&page=&pageSize= */
export const GET = withApi({}, async (req) => {
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const postId = param(sp, "postId").slice(0, 64);
  const category = param(sp, "category").slice(0, 40);
  const ctx = await getAnalysisContext();
  const { page, pageSize } = pageOf(req);
  const items = ctx.comments
    .map((c) => ({ ...c, analysis: ctx.commentAnalysis.get(c.id)! }))
    .filter((c) => (!postId || c.postId === postId) && (!category || c.analysis.category === category));
  const res = paginate(items, page, pageSize);
  return { items: res.rows, page: res.page, pages: res.pages, total: res.total, source: ctx.source };
});
