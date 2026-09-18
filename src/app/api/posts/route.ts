import { pageOf, withApi } from "@/lib/api/handler";
import { summarizePost } from "@/lib/api/serializers";
import { getAnalysisContext } from "@/lib/services/analysis";
import { filterPosts, parsePostFilters } from "@/lib/services/queries";
import { paginate } from "@/lib/utils/params";

/** GET /api/posts?q=&platform=&sentiment=&risk=&category=&status=&from=&to=&account=&issue=&sort=&page=&pageSize= */
export const GET = withApi({}, async (req) => {
  const filters = parsePostFilters(Object.fromEntries(req.nextUrl.searchParams));
  const ctx = await getAnalysisContext();
  const { page, pageSize } = pageOf(req);
  const res = paginate(filterPosts(ctx, filters), page, pageSize);
  return { items: res.rows.map((p) => summarizePost(ctx, p)), page: res.page, pages: res.pages, total: res.total, source: ctx.source };
});
