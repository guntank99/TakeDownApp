import type { Metadata } from "next";
import { FilterPanel } from "@/components/ui/FilterPanel";
import { PageHeader } from "@/components/ui/layout";
import { Pagination } from "@/components/tables/DataTable";
import { PostsTable, postFilterFields, type PostRow } from "@/components/tables/PostsTable";
import { verifySession } from "@/lib/auth/dal";
import { getAnalysisContext } from "@/lib/services/analysis";
import { filterPosts, filtersToParams, parsePostFilters } from "@/lib/services/queries";
import { pageParam, paginate } from "@/lib/utils/params";

export const metadata: Metadata = { title: "Postingan" };

/** Review queue: the same posts as Monitoring, but sorted by risk and showing the analysis. */
export default async function PostsPage({ searchParams }: PageProps<"/posts">) {
  await verifySession();
  const sp = await searchParams;
  const filters = parsePostFilters(sp, "risk");
  const ctx = await getAnalysisContext();
  const { rows, page, pages, total } = paginate(filterPosts(ctx, filters), pageParam(sp), 15);

  const tableRows: PostRow[] = rows.map((post) => ({
    post,
    handle: ctx.accountById.get(post.authorId)?.handle ?? post.authorId,
    analysis: ctx.postAnalysis.get(post.id)!,
  }));

  return (
    <div>
      <PageHeader
        title="Postingan"
        description="Antrean tinjauan diurutkan menurut risiko analitis. Buka postingan untuk melihat bukti di balik setiap indikator."
        mock={ctx.source.isMock}
      />
      <FilterPanel action="/posts" fields={postFilterFields()} values={filtersToParams(filters)} />
      <PostsTable rows={tableRows} variant="review" />
      <Pagination page={page} pages={pages} total={total} basePath="/posts" params={filtersToParams(filters)} />
    </div>
  );
}
