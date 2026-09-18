import { pageOf, withApi } from "@/lib/api/handler";
import { listAuditFor } from "@/lib/services/audit";
import { paginate, param } from "@/lib/utils/params";

/**
 * GET /api/audit?action=&caseId=&page=&pageSize=
 * Reviewers and admins receive everyone's activity; other roles receive only
 * their own (scoped on the server, not by a client-supplied filter).
 */
export const GET = withApi({}, async (req, { user }) => {
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const action = param(sp, "action");
  const caseId = param(sp, "caseId");
  const { page, pageSize } = pageOf(req);
  const { entries, scope } = listAuditFor(user);
  const res = paginate(entries.filter((e) => (!action || e.action === action) && (!caseId || e.caseId === caseId)), page, pageSize);
  return { items: res.rows, page: res.page, pages: res.pages, total: res.total, scope };
});
