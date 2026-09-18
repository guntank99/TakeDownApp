import type { Metadata } from "next";
import Link from "next/link";
import { TextAnalyzer } from "@/components/analysis/TextAnalyzer";
import { Pagination } from "@/components/tables/DataTable";
import { PostsTable, type PostRow } from "@/components/tables/PostsTable";
import { Card, PageHeader } from "@/components/ui/layout";
import { INDICATOR_LABELS } from "@/lib/analysis/indicators";
import { verifySession } from "@/lib/auth/dal";
import { getAnalysisContext } from "@/lib/services/analysis";
import { filterPosts, parsePostFilters } from "@/lib/services/queries";
import { pageParam, paginate } from "@/lib/utils/params";
import type { IndicatorKey } from "@/types";

export const metadata: Metadata = { title: "Analysis" };

export default async function AnalysisPage({ searchParams }: PageProps<"/analysis">) {
  await verifySession();
  const sp = await searchParams;
  const ctx = await getAnalysisContext();
  const analyses = [...ctx.postAnalysis.values()];
  const counts = (Object.keys(INDICATOR_LABELS) as IndicatorKey[]).map((k) => ({
    key: k,
    label: INDICATOR_LABELS[k],
    n: analyses.filter((a) => a.content.flagged.includes(k)).length,
  }));

  // flagged posts only, highest risk first
  const flagged = filterPosts(ctx, parsePostFilters({}, "risk")).filter((p) => ctx.postAnalysis.get(p.id)!.content.flagged.length > 0);
  const { rows, page, pages, total } = paginate(flagged, pageParam(sp), 10);
  const tableRows: PostRow[] = rows.map((post) => ({ post, handle: ctx.accountById.get(post.authorId)?.handle ?? post.authorId, analysis: ctx.postAnalysis.get(post.id)! }));

  const links = [
    { href: "/analysis/comments", title: "Comment analysis", text: `${ctx.comments.length} comments by category, toxicity and confidence` },
    { href: "/analysis/claims", title: "Misinformation / disinformation", text: "Claim extraction → sources → cross-check → assessment" },
    { href: "/sentiment", title: "Sentiment", text: "Distribution, timeline and keywords" },
    { href: "/accounts", title: "Account analysis", text: "Authenticity, behaviour and network indicators" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analysis"
        description="Every automated result carries a confidence, a reason and evidence, and stays 'needs human review' until an analyst decides. Indicators are not findings."
        mock={ctx.source.isMock}
      />

      <section aria-label="Analysis areas" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 transition-colors hover:border-sky-500/50">
            <h2 className="text-sm font-semibold text-slate-100">{l.title}</h2>
            <p className="mt-1 text-xs text-slate-400">{l.text}</p>
          </Link>
        ))}
      </section>

      <Card title="Indicators detected across posts" description="Counts of posts flagged per indicator (engine: lexicon-v1)">
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {counts.map((c) => (
            <li key={c.key}>
              <Link href={`/posts?category=${c.key}`} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2 text-sm hover:border-sky-500/50">
                <span className="text-slate-300">{c.label.replace(" Indicator", "")}</span>
                <span className="tabular-nums text-slate-100">{c.n}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Analyze text" description="Try the engine on any text. Runs are recorded in the audit log.">
        <TextAnalyzer />
      </Card>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-100">Flagged posts (highest risk first)</h2>
        <PostsTable rows={tableRows} variant="review" />
        <Pagination page={page} pages={pages} total={total} basePath="/analysis" params={{}} />
      </section>
    </div>
  );
}
