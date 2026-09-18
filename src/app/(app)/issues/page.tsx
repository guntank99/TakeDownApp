import type { Metadata } from "next";
import Link from "next/link";
import { ChartCard } from "@/components/charts/ChartCard";
import { HorizontalBarChart, TimeSeriesChart } from "@/components/charts/charts";
import { DataTable, Pagination } from "@/components/tables/DataTable";
import { PlatformBadge, RiskBadge, SentimentBadge, StatusBadge } from "@/components/ui/badges";
import { FilterPanel } from "@/components/ui/FilterPanel";
import { PageHeader } from "@/components/ui/layout";
import { verifySession } from "@/lib/auth/dal";
import { getAnalysisContext } from "@/lib/services/analysis";
import { formatDate, formatNumber, truncate } from "@/lib/utils/format";
import { ISSUE_STATUS_LABEL, SENTIMENT_LABEL } from "@/lib/i18n/labels";
import { enumParam, pageParam, paginate, param } from "@/lib/utils/params";
import { PLATFORMS, PLATFORM_COLOR, PLATFORM_LABEL } from "@/lib/utils/platforms";
import type { Sentiment } from "@/types";

export const metadata: Metadata = { title: "Isu" };

const BLUE = "#3987e5";
const ORANGE = "#d95926";
const SENT_COLOR: Record<Sentiment, string> = { positive: BLUE, neutral: "#94a3b8", negative: ORANGE };

export default async function IssuesPage({ searchParams }: PageProps<"/issues">) {
  await verifySession();
  const sp = await searchParams;
  const q = param(sp, "q").slice(0, 200);
  const platform = enumParam(sp, "platform", PLATFORMS);
  const status = enumParam(sp, "status", ["active", "monitoring", "closed"] as const);

  const ctx = await getAnalysisContext();
  const enriched = ctx.issues.map((issue) => {
    const posts = ctx.posts.filter((p) => p.issueId === issue.id);
    const analyses = posts.map((p) => ctx.postAnalysis.get(p.id)!);
    const sent: Record<Sentiment, number> = { positive: 0, neutral: 0, negative: 0 };
    for (const a of analyses) sent[a.content.sentiment.sentiment]++;
    const dominant = (Object.entries(sent).sort((a, b) => b[1] - a[1])[0][0]) as Sentiment;
    return {
      issue,
      posts,
      accounts: new Set(posts.map((p) => p.authorId)).size,
      engagement: posts.reduce((s, p) => s + p.likes + p.comments + p.shares, 0),
      sentiment: posts.length ? dominant : ("neutral" as Sentiment),
      risk: Math.max(0, ...analyses.map((a) => a.risk.score)),
    };
  });

  const filtered = enriched
    .filter((e) => (!platform || e.issue.platforms.includes(platform)) && (!status || e.issue.status === status)
      && (!q || `${e.issue.title} ${e.issue.hashtag}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.issue.volume - a.issue.volume);
  const { rows, page, pages, total } = paginate(filtered, pageParam(sp), 10);
  const values = Object.fromEntries(Object.entries({ q, platform, status }).filter(([, v]) => v)) as Record<string, string>;

  // charts (over the filtered set)
  const top = filtered.slice(0, 8);
  const short = (t: string) => truncate(t, 26);
  const days = ["H-6", "H-5", "H-4", "H-3", "H-2", "H-1", "Hari ini"];
  const volumeSeries = days.map((d, i) => ({ day: d, volume: filtered.reduce((s, e) => s + (e.issue.series[i] ?? 0), 0) }));
  const platformCounts = PLATFORMS.map((p) => ({ p, n: filtered.filter((e) => e.issue.platforms.includes(p)).length })).filter((x) => x.n > 0);
  const sentTimeline = (() => {
    const byDay = new Map<string, Record<Sentiment, number>>();
    for (const e of filtered) for (const p of e.posts) {
      const d = p.createdAt.slice(0, 10);
      const row = byDay.get(d) ?? { positive: 0, neutral: 0, negative: 0 };
      row[ctx.postAnalysis.get(p.id)!.content.sentiment.sentiment]++;
      byDay.set(d, row);
    }
    return [...byDay].sort((a, b) => a[0].localeCompare(b[0])).map(([date, r]) => ({ date, ...r }));
  })();

  return (
    <div>
      <PageHeader title="Isu" description="Isu yang sedang tren beserta volume, pertumbuhan, interaksi, dan sentimen. Angka volume adalah agregat dari penyedia data." mock={ctx.source.isMock} />

      <section aria-label="Grafik isu" className="mb-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Volume penyebutan" description="Isu teratas menurut penyebutan" table={{ columns: ["Isu", "Volume"], rows: top.map((e) => [e.issue.title, e.issue.volume]) }} empty={top.length === 0}>
          <HorizontalBarChart labelWidth={170} valueName="Penyebutan" ariaLabel="Grafik batang volume penyebutan per isu" data={top.map((e) => ({ label: short(e.issue.title), value: e.issue.volume, color: BLUE }))} />
        </ChartCard>
        <ChartCard title="Pertumbuhan" description="Perubahan dibanding periode sebelumnya (%)" table={{ columns: ["Isu", "Pertumbuhan %"], rows: top.map((e) => [e.issue.title, e.issue.growth]) }} empty={top.length === 0}>
          <HorizontalBarChart labelWidth={170} valueName="Pertumbuhan %" ariaLabel="Grafik batang pertumbuhan per isu" data={top.map((e) => ({ label: short(e.issue.title), value: e.issue.growth, color: e.issue.growth >= 0 ? ORANGE : BLUE }))} />
        </ChartCard>
        <ChartCard title="Interaksi" description="Suka + komentar + bagikan pada postingan terkait" table={{ columns: ["Isu", "Interaksi"], rows: top.map((e) => [e.issue.title, e.engagement]) }} empty={top.length === 0}>
          <HorizontalBarChart labelWidth={170} valueName="Interaksi" ariaLabel="Grafik batang interaksi per isu" data={top.map((e) => ({ label: short(e.issue.title), value: e.engagement, color: BLUE }))} />
        </ChartCard>
        <ChartCard title="Distribusi platform" description="Jumlah isu yang menyentuh tiap platform" table={{ columns: ["Platform", "Isu"], rows: platformCounts.map((x) => [PLATFORM_LABEL[x.p], x.n]) }} empty={platformCounts.length === 0}>
          <HorizontalBarChart ariaLabel="Grafik batang isu per platform" data={platformCounts.map((x) => ({ label: PLATFORM_LABEL[x.p], value: x.n, color: PLATFORM_COLOR[x.p] }))} />
        </ChartCard>
        <ChartCard title="Lini masa volume penyebutan" description="Penyebutan harian, 7 hari terakhir (semua isu terdaftar)" table={{ columns: ["Hari", "Penyebutan"], rows: volumeSeries.map((d) => [d.day, d.volume]) }} empty={filtered.length === 0}>
          <TimeSeriesChart data={volumeSeries} xKey="day" ariaLabel="Grafik garis volume penyebutan harian" series={[{ key: "volume", label: "Penyebutan", color: BLUE }]} />
        </ChartCard>
        <ChartCard title="Lini masa sentimen" description="Postingan per hari menurut sentimen (postingan terkait)" table={{ columns: ["Tanggal", "Positif", "Netral", "Negatif"], rows: sentTimeline.map((r) => [r.date, r.positive, r.neutral, r.negative]) }} empty={sentTimeline.length === 0}>
          <TimeSeriesChart data={sentTimeline} xKey="date" ariaLabel="Grafik garis sentimen postingan per hari" series={(["positive", "neutral", "negative"] as const).map((k) => ({ key: k, label: SENTIMENT_LABEL[k], color: SENT_COLOR[k] }))} />
        </ChartCard>
      </section>

      <FilterPanel
        action="/issues"
        values={values}
        fields={[
          { name: "q", label: "Cari", type: "text", placeholder: "isu atau #tagar" },
          { name: "platform", label: "Platform", options: PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABEL[p] })) },
          { name: "status", label: "Status", options: (["active", "monitoring", "closed"] as const).map((s) => ({ value: s, label: ISSUE_STATUS_LABEL[s] })) },
        ]}
      />
      <DataTable
        caption="Isu yang sedang tren"
        rows={rows}
        rowKey={(e) => e.issue.id}
        empty="Tidak ada isu yang cocok dengan filter ini."
        columns={[
          { header: "Isu", className: "max-w-xs whitespace-normal", cell: (e) => <span className="font-medium">{e.issue.title}</span> },
          { header: "Tagar", cell: (e) => e.issue.hashtag },
          { header: "Platform", cell: (e) => <span className="flex flex-col gap-0.5">{e.issue.platforms.map((p) => <PlatformBadge key={p} platform={p} />)}</span> },
          { header: "Volume", className: "text-right tabular-nums", cell: (e) => formatNumber(e.issue.volume) },
          { header: "Pertumbuhan", className: "text-right tabular-nums", cell: (e) => `${e.issue.growth > 0 ? "+" : ""}${e.issue.growth}%` },
          { header: "Interaksi", className: "text-right tabular-nums", cell: (e) => formatNumber(e.engagement) },
          { header: "Sentimen", cell: (e) => <SentimentBadge sentiment={e.sentiment} /> },
          { header: "Akun", className: "text-right tabular-nums", cell: (e) => e.accounts },
          { header: "Postingan", className: "text-right tabular-nums", cell: (e) => <Link href={`/monitoring?issue=${e.issue.id}`} className="text-sky-400 hover:underline">{e.posts.length}</Link> },
          { header: "Risiko", cell: (e) => <RiskBadge score={e.risk} /> },
          { header: "Status", cell: (e) => <StatusBadge status={e.issue.status} /> },
          { header: "Pertama terdeteksi", className: "whitespace-nowrap", cell: (e) => formatDate(e.issue.firstDetectedAt) },
          { header: "Diperbarui", className: "whitespace-nowrap", cell: (e) => formatDate(e.issue.lastUpdatedAt) },
        ]}
      />
      <Pagination page={page} pages={pages} total={total} basePath="/issues" params={values} />
    </div>
  );
}
