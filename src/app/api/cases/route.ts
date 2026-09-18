import { fromResult, readJson, withApi } from "@/lib/api/handler";
import { createCase, listCases } from "@/lib/services/cases";
import { param } from "@/lib/utils/params";

/** GET /api/cases?status=&platform= */
export const GET = withApi({}, async (req) => {
  const sp = Object.fromEntries(req.nextUrl.searchParams);
  const status = param(sp, "status");
  const platform = param(sp, "platform");
  const items = listCases().filter((c) => (!status || c.status === status) && (!platform || c.platform === platform));
  return { items, total: items.length };
});

/** POST /api/cases: create a case (analyst/admin). */
export const POST = withApi({ permission: "case:create" }, async (req, { user }) =>
  fromResult(await createCase(user, await readJson(req)), 201),
);
