import { HttpError, fromResult, readJson, withApi } from "@/lib/api/handler";
import { getCase, updateCase } from "@/lib/services/cases";

export const GET = withApi<{ id: string }>({}, async (_req, { params }) => {
  const c = getCase(params.id);
  if (!c) throw new HttpError(404, "Kasus tidak ditemukan.");
  return c;
});

/** PATCH /api/cases/:id {status?, priority?, title?, description?, note?, addPostId?, addAccountId?} */
export const PATCH = withApi<{ id: string }>({ permission: "case:update" }, async (req, { user, params }) =>
  fromResult(await updateCase(user, params.id, await readJson(req))),
);
