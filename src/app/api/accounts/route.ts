import { pageOf, withApi } from "@/lib/api/handler";
import { summarizeAccount } from "@/lib/api/serializers";
import { getAnalysisContext } from "@/lib/services/analysis";
import { RISK_LEVELS } from "@/lib/services/queries";
import { enumParam, paginate, param } from "@/lib/utils/params";
import { PLATFORMS } from "@/lib/utils/platforms";

/** GET /api/accounts?q=&platform=&risk=&page=&pageSize= */
export const GET = withApi({}, async (req) => {
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const q = param(sp, "q").toLowerCase().slice(0, 200);
  const platform = enumParam(sp, "platform", PLATFORMS);
  const risk = enumParam(sp, "risk", RISK_LEVELS);
  const ctx = await getAnalysisContext();
  const { page, pageSize } = pageOf(req);

  const items = ctx.accounts
    .filter((a) => (!platform || a.platform === platform) && (!risk || ctx.accountAnalysis.get(a.id)!.risk.level === risk)
      && (!q || `${a.handle} ${a.displayName}`.toLowerCase().includes(q)))
    .sort((a, b) => ctx.accountAnalysis.get(b.id)!.risk.score - ctx.accountAnalysis.get(a.id)!.risk.score);
  const res = paginate(items, page, pageSize);
  return { items: res.rows.map((a) => summarizeAccount(ctx, a)), page: res.page, pages: res.pages, total: res.total, source: ctx.source };
});
