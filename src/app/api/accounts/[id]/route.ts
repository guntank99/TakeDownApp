import { HttpError, withApi } from "@/lib/api/handler";
import { getAnalysisContext } from "@/lib/services/analysis";

export const GET = withApi<{ id: string }>({}, async (_req, { params }) => {
  const ctx = await getAnalysisContext();
  const account = ctx.accountById.get(params.id);
  if (!account) throw new HttpError(404, "Account not found.");
  return { account, analysis: ctx.accountAnalysis.get(account.id), postIds: ctx.posts.filter((p) => p.authorId === account.id).map((p) => p.id) };
});
