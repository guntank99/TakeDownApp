import type { Metadata } from "next";
import Link from "next/link";
import { ChartCard } from "@/components/charts/ChartCard";
import { DonutChart, HorizontalBarChart, TimeSeriesChart } from "@/components/charts/charts";
import { DataTable } from "@/components/tables/DataTable";
import { ConfidenceMeter, PlatformBadge, SentimentBadge } from "@/components/ui/badges";
import { Card, PageHeader } from "@/components/ui/layout";
import { verifySession } from "@/lib/auth/dal";
import { getAnalysisContext } from "@/lib/services/analysis";
import { formatDateTime, titleCase, truncate } from "@/lib/utils/format";
import type { Sentiment } from "@/types";

export const metadata: Metadata = { title: "Sentiment" };

const COLOR: Record<Sentiment, string> = { positive: "#3987e5", neutral: "#94a3b8", negative: "#d95926" };
const ORDER: Sentiment[] = ["positive", "neutral", "negative"];

export default async function SentimentPage() {
  await verifySession();
  const ctx = await getAnalysisContext();

  const postCounts: Record<Sentiment, number> = { positive: 0, neutral: 0, negative: 0 };
  const commentCounts: Record<Sentiment, number> = { positive: 0, neutral: 0, negative: 0 };
  const keywords: Record<"positive" | "negative", Map<string, number>> = { positive: new Map(), negative: new Map() };
  const byDay = new Map<string, Record<Sentiment, number>>();

  const tally = (s: { sentiment: Sentiment; keywords: string[] }, date: string) => {
    for (const k of s.keywords) {
      if (s.sentiment === "positive" || s.sentiment === "negative") keywords[s.sentiment].set(k, (keywords[s.sentiment].get(k) ?? 0) + 1);
    }
    const day = date.slice(0, 10);
    const row = byDay.get(day) ?? { positive: 0, neutral: 0, negative: 0 };
    row[s.sentiment]++;
    byDay.set(day, row);
  };
  for (const p of ctx.posts) {
    const s = ctx.postAnalysis.get(p.id)!.content.sentiment;
    postCounts[s.sentiment]++;
    tally(s, p.createdAt);
  }
  for (const c of ctx.comments) {
    const a = ctx.commentAnalysis.get(c.id)!;
    commentCounts[a.sentiment]++;
    tally({ sentiment: a.sentiment, keywords: [] }, c.createdAt);
  }
  const timeline = [...byDay].sort((a, b) => a[0].localeCompare(b[0])).map(([date, r]) => ({ date, ...r }));
  const topKeywords = (kind: "positive" | "negative") => [...keywords[kind]].sort((a, b) => b[1] - a[1]).slice(0, 10);

  const samplePosts = ctx.posts
    .map((p) => ({ p, s: ctx.postAnalysis.get(p.id)!.content.sentiment }))
    .filter(({ s }) => s.sentiment !== "neutral")
    .sort((a, b) => b.s.confidence - a.s.confidence)
    .slice(0, 8);
  const sampleComments = ctx.comments
    .map((c) => ({ c, a: ctx.commentAnalysis.get(c.id)! }))
    .filter(({ a }) => a.sentiment !== "neutral" && a.category !== "Other")
    .sort((a, b) => b.a.confidence - a.a.confidence)
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sentiment"
        description="Keyword-based sentiment for posts and comments (English and Indonesian). Every result shows its confidence, reason and detected keywords; sarcasm and context can be misread."
        mock={ctx.source.isMock}
      />

      <section aria-label="Sentiment charts" className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Posts" description="Share of posts by sentiment" table={{ columns: ["Sentiment", "Posts"], rows: ORDER.map((s) => [titleCase(s), postCounts[s]]) }}>
          <DonutChart ariaLabel="Donut chart of post sentiment" data={ORDER.map((s) => ({ label: titleCase(s), value: postCounts[s], color: COLOR[s] }))} />
        </ChartCard>
        <ChartCard title="Comments" description="Comments by sentiment" table={{ columns: ["Sentiment", "Comments"], rows: ORDER.map((s) => [titleCase(s), commentCounts[s]]) }}>
          <HorizontalBarChart ariaLabel="Bar chart of comment sentiment" data={ORDER.map((s) => ({ label: titleCase(s), value: commentCounts[s], color: COLOR[s] }))} />
        </ChartCard>
        <ChartCard title="Timeline" description="Posts and comments per day" table={{ columns: ["Date", "Positive", "Neutral", "Negative"], rows: timeline.map((r) => [r.date, r.positive, r.neutral, r.negative]) }}>
          <TimeSeriesChart data={timeline} xKey="date" ariaLabel="Line chart of sentiment per day" series={ORDER.map((s) => ({ key: s, label: titleCase(s), color: COLOR[s] }))} />
        </ChartCard>
      </section>

      <section aria-label="Keywords" className="grid gap-4 md:grid-cols-2">
        {(["positive", "negative"] as const).map((kind) => (
          <Card key={kind} title={`Top ${kind} keywords`} description="Detected in posts (lexicon hits)">
            {topKeywords(kind).length ? (
              <ul className="flex flex-wrap gap-2">
                {topKeywords(kind).map(([k, n]) => (
                  <li key={k} className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300">{k} <span className="text-slate-500">×{n}</span></li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-500">No keywords detected.</p>}
          </Card>
        ))}
      </section>

      <Card title="Most confident post results">
        <DataTable
          caption="Posts with strongest sentiment"
          rows={samplePosts}
          rowKey={({ p }) => p.id}
          columns={[
            { header: "Post", cell: ({ p }) => <Link href={`/posts/${p.id}`} className="text-sky-400 hover:underline">{p.id}</Link> },
            { header: "Platform", cell: ({ p }) => <PlatformBadge platform={p.platform} /> },
            { header: "Content", className: "max-w-sm whitespace-normal", cell: ({ p }) => truncate(p.text, 100) },
            { header: "Sentiment", cell: ({ s }) => <SentimentBadge sentiment={s.sentiment} /> },
            { header: "Confidence", cell: ({ s }) => <ConfidenceMeter value={s.confidence} /> },
            { header: "Reason", className: "max-w-xs whitespace-normal text-slate-400", cell: ({ s }) => s.reason },
            { header: "Detected keywords", className: "max-w-[12rem] whitespace-normal", cell: ({ s }) => s.keywords.join(", ") || "—" },
          ]}
        />
      </Card>

      <Card title="Most confident comment results">
        <DataTable
          caption="Comments with strongest sentiment"
          rows={sampleComments}
          rowKey={({ c }) => c.id}
          columns={[
            { header: "Comment", className: "max-w-sm whitespace-normal", cell: ({ c }) => truncate(c.text, 100) },
            { header: "Post", cell: ({ c }) => <Link href={`/posts/${c.postId}`} className="text-sky-400 hover:underline">{c.postId}</Link> },
            { header: "Sentiment", cell: ({ a }) => <SentimentBadge sentiment={a.sentiment} /> },
            { header: "Confidence", cell: ({ a }) => <ConfidenceMeter value={a.confidence} /> },
            { header: "Reason", className: "max-w-xs whitespace-normal text-slate-400", cell: ({ a }) => a.reason },
            { header: "Time", className: "whitespace-nowrap", cell: ({ c }) => formatDateTime(c.createdAt) },
          ]}
        />
      </Card>
    </div>
  );
}
