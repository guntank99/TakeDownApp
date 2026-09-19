import { fromResult, readJson, withApi } from "@/lib/api/handler";
import { createEvidence, listEvidence } from "@/lib/services/evidence";
import { param } from "@/lib/utils/params";

export const GET = withApi({}, async (req) => {
  const caseId = param(Object.fromEntries(req.nextUrl.searchParams), "caseId");
  const items = await listEvidence(caseId || undefined);
  return { items, total: items.length };
});

/** POST /api/evidence {caseId, postId, screenshotRef?}: captures a hashed snapshot of the post. */
export const POST = withApi({ permission: "evidence:create" }, async (req, { user }) =>
  fromResult(await createEvidence(user, await readJson(req)), 201),
);
