import { fromResult, readJson, withApi } from "@/lib/api/handler";
import { createReport, listReports } from "@/lib/services/reports";

export const GET = withApi({}, async () => {
  const items = await listReports();
  return { items, total: items.length };
});

/** POST /api/reports {caseId}: generates a DRAFT report. It is never submitted automatically. */
export const POST = withApi({ permission: "report:create" }, async (req, { user }) =>
  fromResult(await createReport(user, await readJson(req)), 201),
);
