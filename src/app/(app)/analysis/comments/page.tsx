import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, Pagination } from "@/components/tables/DataTable";
import { Badge, ConfidenceMeter, SentimentBadge } from "@/components/ui/badges";
import { FilterPanel } from "@/components/ui/FilterPanel";
import { PageHeader } from "@/components/ui/layout";
import { verifySession } from "@/lib/auth/dal";
import { getAnalysisContext } from "@/lib/services/analysis";
import { SENTIMENTS } from "@/lib/services/queries";
import { formatDateTime, truncate } from "@/lib/utils/format";
import { SENTIMENT_LABEL } from "@/lib/i18n/labels";
import { enumParam, pageParam, paginate, param } from "@/lib/utils/params";
import type { CommentCategory } from "@/types";

export const metadata: Metadata = { title: "Analisis komentar" };

const CATEGORIES: CommentCategory[] = ["Positif", "Netral", "Negatif", "Indikator Ujaran Kebencian", "Pelecehan", "Spam", "Indikator Ancaman", "Lainnya"];
const CONCERNING = new Set<CommentCategory>(["Indikator Ujaran Kebencian", "Pelecehan", "Spam", "Indikator Ancaman"]);

export default async function CommentAnalysisPage({ searchParams }: PageProps<"/analysis/comments">) {
  await verifySession();
  const sp = await searchParams;
  const q = param(sp, "q").slice(0, 200);
  const category = enumParam(sp, "category", CATEGORIES);
  const sentiment = enumParam(sp, "sentiment", SENTIMENTS);
  const post = param(sp, "post").slice(0, 64);

  const ctx = await getAnalysisContext();
  const items = ctx.comments
    .map((c) => ({ c, a: ctx.commentAnalysis.get(c.id)! }))
    .filter(({ c, a }) => (!category || a.category === category) && (!sentiment || a.sentiment === sentiment) && (!post || c.postId === post)
      && (!q || c.text.toLowerCase().includes(q.toLowerCase())))
    .sort((x, y) => y.a.toxicity - x.a.toxicity || y.c.createdAt.localeCompare(x.c.createdAt));
  const { rows, page, pages, total } = paginate(items, pageParam(sp), 20);
  const values = Object.fromEntries(Object.entries({ q, category, sentiment, post }).filter(([, v]) => v)) as Record<string, string>;

  return (
    <div>
      <PageHeader title="Analisis komentar" description="Komentar diurutkan menurut toksisitas. Kategori yang ditandai sebagai indikator memerlukan tinjauan manusia sebelum ada kesimpulan." mock={ctx.source.isMock} />
      <FilterPanel
        action="/analysis/comments"
        values={values}
        fields={[
          { name: "q", label: "Cari teks", type: "text" },
          { name: "category", label: "Kategori", options: CATEGORIES.map((c) => ({ value: c, label: c })) },
          { name: "sentiment", label: "Sentimen", options: SENTIMENTS.map((s) => ({ value: s, label: SENTIMENT_LABEL[s] })) },
          { name: "post", label: "ID Postingan", type: "text", placeholder: "POST-001" },
        ]}
      />
      <DataTable
        caption="Komentar yang dianalisis"
        rows={rows}
        rowKey={({ c }) => c.id}
        empty="Tidak ada komentar yang cocok dengan filter ini."
        columns={[
          { header: "Komentar", className: "max-w-md whitespace-normal", cell: ({ c }) => truncate(c.text, 140) },
          { header: "Penulis", cell: ({ c }) => <Link href={`/accounts/${c.authorId}`} className="hover:underline">{ctx.accountById.get(c.authorId)?.handle ?? c.authorId}</Link> },
          { header: "Pada postingan", cell: ({ c }) => <Link href={`/posts/${c.postId}`} className="text-sky-400 hover:underline">{c.postId}</Link> },
          { header: "Sentimen", cell: ({ a }) => <SentimentBadge sentiment={a.sentiment} /> },
          { header: "Toksisitas", className: "text-right tabular-nums", cell: ({ a }) => a.toxicity },
          { header: "Kategori", cell: ({ a }) => <Badge tone={CONCERNING.has(a.category) ? "warning" : "neutral"}>{a.category.toUpperCase()}</Badge> },
          { header: "Keyakinan", cell: ({ a }) => <ConfidenceMeter value={a.confidence} /> },
          { header: "Waktu", className: "whitespace-nowrap", cell: ({ c }) => formatDateTime(c.createdAt) },
        ]}
      />
      <Pagination page={page} pages={pages} total={total} basePath="/analysis/comments" params={values} />
    </div>
  );
}
