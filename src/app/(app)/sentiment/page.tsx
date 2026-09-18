import type { Metadata } from "next";
import Link from "next/link";
import { ChartCard } from "@/components/charts/ChartCard";
import { DonutChart, HorizontalBarChart, TimeSeriesChart } from "@/components/charts/charts";
import { DataTable } from "@/components/tables/DataTable";
import { ConfidenceMeter, PlatformBadge, SentimentBadge } from "@/components/ui/badges";
import { Card, PageHeader } from "@/components/ui/layout";
import { verifySession } from "@/lib/auth/dal";
import { getAnalysisContext } from "@/lib/services/analysis";
import { formatDateTime, truncate } from "@/lib/utils/format";
import { SENTIMENT_LABEL } from "@/lib/i18n/labels";
import type { Sentiment } from "@/types";

export const metadata: Metadata = { title: "Sentimen" };

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
    .filter(({ a }) => a.sentiment !== "neutral" && a.category !== "Lainnya")
    .sort((a, b) => b.a.confidence - a.a.confidence)
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sentimen"
        description="Sentimen berbasis kata kunci untuk postingan dan komentar (bahasa Indonesia dan Inggris). Setiap hasil menampilkan keyakinan, alasan, dan kata kunci yang terdeteksi; sarkasme dan konteks dapat salah terbaca."
        mock={ctx.source.isMock}
      />

      <section aria-label="Grafik sentimen" className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Postingan" description="Porsi postingan menurut sentimen" table={{ columns: ["Sentimen", "Postingan"], rows: ORDER.map((s) => [SENTIMENT_LABEL[s], postCounts[s]]) }}>
          <DonutChart ariaLabel="Grafik donat sentimen postingan" data={ORDER.map((s) => ({ label: SENTIMENT_LABEL[s], value: postCounts[s], color: COLOR[s] }))} />
        </ChartCard>
        <ChartCard title="Komentar" description="Komentar menurut sentimen" table={{ columns: ["Sentimen", "Komentar"], rows: ORDER.map((s) => [SENTIMENT_LABEL[s], commentCounts[s]]) }}>
          <HorizontalBarChart ariaLabel="Grafik batang sentimen komentar" data={ORDER.map((s) => ({ label: SENTIMENT_LABEL[s], value: commentCounts[s], color: COLOR[s] }))} />
        </ChartCard>
        <ChartCard title="Lini masa" description="Postingan dan komentar per hari" table={{ columns: ["Tanggal", "Positif", "Netral", "Negatif"], rows: timeline.map((r) => [r.date, r.positive, r.neutral, r.negative]) }}>
          <TimeSeriesChart data={timeline} xKey="date" ariaLabel="Grafik garis sentimen per hari" series={ORDER.map((s) => ({ key: s, label: SENTIMENT_LABEL[s], color: COLOR[s] }))} />
        </ChartCard>
      </section>

      <section aria-label="Kata kunci" className="grid gap-4 md:grid-cols-2">
        {(["positive", "negative"] as const).map((kind) => (
          <Card key={kind} title={`Kata kunci ${kind === "positive" ? "positif" : "negatif"} teratas`} description="Terdeteksi pada postingan (kecocokan lexicon)">
            {topKeywords(kind).length ? (
              <ul className="flex flex-wrap gap-2">
                {topKeywords(kind).map(([k, n]) => (
                  <li key={k} className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300">{k} <span className="text-slate-500">×{n}</span></li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-500">Tidak ada kata kunci yang terdeteksi.</p>}
          </Card>
        ))}
      </section>

      <Card title="Hasil postingan dengan keyakinan tertinggi">
        <DataTable
          caption="Postingan dengan sentimen terkuat"
          rows={samplePosts}
          rowKey={({ p }) => p.id}
          columns={[
            { header: "Postingan", cell: ({ p }) => <Link href={`/posts/${p.id}`} className="text-sky-400 hover:underline">{p.id}</Link> },
            { header: "Platform", cell: ({ p }) => <PlatformBadge platform={p.platform} /> },
            { header: "Konten", className: "max-w-sm whitespace-normal", cell: ({ p }) => truncate(p.text, 100) },
            { header: "Sentimen", cell: ({ s }) => <SentimentBadge sentiment={s.sentiment} /> },
            { header: "Keyakinan", cell: ({ s }) => <ConfidenceMeter value={s.confidence} /> },
            { header: "Alasan", className: "max-w-xs whitespace-normal text-slate-400", cell: ({ s }) => s.reason },
            { header: "Kata kunci terdeteksi", className: "max-w-[12rem] whitespace-normal", cell: ({ s }) => s.keywords.join(", ") || "—" },
          ]}
        />
      </Card>

      <Card title="Hasil komentar dengan keyakinan tertinggi">
        <DataTable
          caption="Komentar dengan sentimen terkuat"
          rows={sampleComments}
          rowKey={({ c }) => c.id}
          columns={[
            { header: "Komentar", className: "max-w-sm whitespace-normal", cell: ({ c }) => truncate(c.text, 100) },
            { header: "Postingan", cell: ({ c }) => <Link href={`/posts/${c.postId}`} className="text-sky-400 hover:underline">{c.postId}</Link> },
            { header: "Sentimen", cell: ({ a }) => <SentimentBadge sentiment={a.sentiment} /> },
            { header: "Keyakinan", cell: ({ a }) => <ConfidenceMeter value={a.confidence} /> },
            { header: "Alasan", className: "max-w-xs whitespace-normal text-slate-400", cell: ({ a }) => a.reason },
            { header: "Waktu", className: "whitespace-nowrap", cell: ({ c }) => formatDateTime(c.createdAt) },
          ]}
        />
      </Card>
    </div>
  );
}
