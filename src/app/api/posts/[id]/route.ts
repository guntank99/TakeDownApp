import { HttpError, withApi } from "@/lib/api/handler";
import { getAnalysisContext } from "@/lib/services/analysis";

export const GET = withApi<{ id: string }>({}, async (_req, { params }) => {
  const ctx = await getAnalysisContext();
  const post = ctx.postById.get(params.id);
  if (!post) throw new HttpError(404, "Postingan tidak ditemukan.");
  return {
    post,
    analysis: ctx.postAnalysis.get(post.id),
    comments: ctx.comments.filter((c) => c.postId === post.id).map((c) => ({ ...c, analysis: ctx.commentAnalysis.get(c.id) })),
  };
});
