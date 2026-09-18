import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, Pagination } from "@/components/tables/DataTable";
import { Badge, ConfidenceMeter, SentimentBadge } from "@/components/ui/badges";
import { FilterPanel } from "@/components/ui/FilterPanel";
import { PageHeader } from "@/components/ui/layout";
import { verifySession } from "@/lib/auth/dal";
import { getAnalysisContext } from "@/lib/services/analysis";
import { SENTIMENTS } from "@/lib/services/queries";
import { formatDateTime, titleCase, truncate } from "@/lib/utils/format";
import { enumParam, pageParam, paginate, param } from "@/lib/utils/params";
import type { CommentCategory } from "@/types";

export const metadata: Metadata = { title: "Comment analysis" };

const CATEGORIES: CommentCategory[] = ["Positive", "Neutral", "Negative", "Hate Speech Indicator", "Harassment", "Spam", "Threat Indicator", "Other"];
const CONCERNING = new Set<CommentCategory>(["Hate Speech Indicator", "Harassment", "Spam", "Threat Indicator"]);

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
      <PageHeader title="Comment analysis" description="Comments sorted by toxicity. Categories flagged as indicators need human review before any conclusion." mock={ctx.source.isMock} />
      <FilterPanel
        action="/analysis/comments"
        values={values}
        fields={[
          { name: "q", label: "Search text", type: "text" },
          { name: "category", label: "Category", options: CATEGORIES.map((c) => ({ value: c, label: c })) },
          { name: "sentiment", label: "Sentiment", options: SENTIMENTS.map((s) => ({ value: s, label: titleCase(s) })) },
          { name: "post", label: "Post ID", type: "text", placeholder: "POST-001" },
        ]}
      />
      <DataTable
        caption="Analysed comments"
        rows={rows}
        rowKey={({ c }) => c.id}
        empty="No comments match these filters."
        columns={[
          { header: "Comment", className: "max-w-md whitespace-normal", cell: ({ c }) => truncate(c.text, 140) },
          { header: "Author", cell: ({ c }) => <Link href={`/accounts/${c.authorId}`} className="hover:underline">{ctx.accountById.get(c.authorId)?.handle ?? c.authorId}</Link> },
          { header: "On post", cell: ({ c }) => <Link href={`/posts/${c.postId}`} className="text-sky-400 hover:underline">{c.postId}</Link> },
          { header: "Sentiment", cell: ({ a }) => <SentimentBadge sentiment={a.sentiment} /> },
          { header: "Toxicity", className: "text-right tabular-nums", cell: ({ a }) => a.toxicity },
          { header: "Category", cell: ({ a }) => <Badge tone={CONCERNING.has(a.category) ? "warning" : "neutral"}>{a.category.toUpperCase()}</Badge> },
          { header: "Confidence", cell: ({ a }) => <ConfidenceMeter value={a.confidence} /> },
          { header: "Timestamp", className: "whitespace-nowrap", cell: ({ c }) => formatDateTime(c.createdAt) },
        ]}
      />
      <Pagination page={page} pages={pages} total={total} basePath="/analysis/comments" params={values} />
    </div>
  );
}
