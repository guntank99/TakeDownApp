import { pageOf, withApi } from "@/lib/api/handler";
import { listAudit } from "@/lib/services/audit";
import { paginate, param } from "@/lib/utils/params";

/** GET /api/audit?action=&caseId=&page=&pageSize= (reviewers and admins). */
export const GET = withApi({ permission: "audit:read" }, async (req) => {
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const action = param(sp, "action");
  const caseId = param(sp, "caseId");
  const { page, pageSize } = pageOf(req);
  const res = paginate(listAudit().filter((e) => (!action || e.action === action) && (!caseId || e.caseId === caseId)), page, pageSize);
  return { items: res.rows, page: res.page, pages: res.pages, total: res.total };
});
