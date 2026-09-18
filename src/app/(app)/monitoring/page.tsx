import type { Metadata } from "next";
import { FilterPanel } from "@/components/ui/FilterPanel";
import { PageHeader } from "@/components/ui/layout";
import { Pagination } from "@/components/tables/DataTable";
import { PostsTable, postFilterFields, type PostRow } from "@/components/tables/PostsTable";
import { verifySession } from "@/lib/auth/dal";
import { getAnalysisContext } from "@/lib/services/analysis";
import { filterPosts, filtersToParams, parsePostFilters } from "@/lib/services/queries";
import { pageParam, paginate } from "@/lib/utils/params";

export const metadata: Metadata = { title: "Pemantauan" };

export default async function MonitoringPage({ searchParams }: PageProps<"/monitoring">) {
  await verifySession();
  const sp = await searchParams;
  const filters = parsePostFilters(sp, "recent");
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
        title="Pemantauan"
        description="Cari dan filter postingan yang dipantau di berbagai platform: Facebook, X, Instagram, TikTok, YouTube, Reddit, Telegram, dan Berita/Web (penyedia mock pada prototipe). Untuk berita dan konten yang sedang ramai di Indonesia, buka halaman Viral Indonesia."
        mock={ctx.source.isMock}
      />
      <FilterPanel action="/monitoring" fields={postFilterFields()} values={filtersToParams(filters)} />
      <PostsTable rows={tableRows} variant="monitoring" />
      <Pagination page={page} pages={pages} total={total} basePath="/monitoring" params={filtersToParams(filters)} />
    </div>
  );
}
