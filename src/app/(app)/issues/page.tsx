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
import { formatDate, formatNumber, titleCase, truncate } from "@/lib/utils/format";
import { enumParam, pageParam, paginate, param } from "@/lib/utils/params";
import { PLATFORMS, PLATFORM_COLOR, PLATFORM_LABEL } from "@/lib/utils/platforms";
import type { Sentiment } from "@/types";

export const metadata: Metadata = { title: "Issues" };

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
  const days = ["D-6", "D-5", "D-4", "D-3", "D-2", "D-1", "Today"];
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
      <PageHeader title="Issues" description="Trending issues with volume, growth, engagement and sentiment. Volume figures are aggregate counts from the provider." mock={ctx.source.isMock} />

      <section aria-label="Issue charts" className="mb-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Mention volume" description="Top issues by mentions" table={{ columns: ["Issue", "Volume"], rows: top.map((e) => [e.issue.title, e.issue.volume]) }} empty={top.length === 0}>
          <HorizontalBarChart labelWidth={170} valueName="Mentions" ariaLabel="Bar chart of mention volume per issue" data={top.map((e) => ({ label: short(e.issue.title), value: e.issue.volume, color: BLUE }))} />
        </ChartCard>
        <ChartCard title="Growth" description="Change vs previous period (%)" table={{ columns: ["Issue", "Growth %"], rows: top.map((e) => [e.issue.title, e.issue.growth]) }} empty={top.length === 0}>
          <HorizontalBarChart labelWidth={170} valueName="Growth %" ariaLabel="Bar chart of growth per issue" data={top.map((e) => ({ label: short(e.issue.title), value: e.issue.growth, color: e.issue.growth >= 0 ? ORANGE : BLUE }))} />
        </ChartCard>
        <ChartCard title="Engagement" description="Likes + comments + shares of related posts" table={{ columns: ["Issue", "Engagement"], rows: top.map((e) => [e.issue.title, e.engagement]) }} empty={top.length === 0}>
          <HorizontalBarChart labelWidth={170} valueName="Engagement" ariaLabel="Bar chart of engagement per issue" data={top.map((e) => ({ label: short(e.issue.title), value: e.engagement, color: BLUE }))} />
        </ChartCard>
        <ChartCard title="Platform distribution" description="Issues touching each platform" table={{ columns: ["Platform", "Issues"], rows: platformCounts.map((x) => [PLATFORM_LABEL[x.p], x.n]) }} empty={platformCounts.length === 0}>
          <HorizontalBarChart ariaLabel="Bar chart of issues per platform" data={platformCounts.map((x) => ({ label: PLATFORM_LABEL[x.p], value: x.n, color: PLATFORM_COLOR[x.p] }))} />
        </ChartCard>
        <ChartCard title="Mention volume timeline" description="Daily mentions, last 7 days (all listed issues)" table={{ columns: ["Day", "Mentions"], rows: volumeSeries.map((d) => [d.day, d.volume]) }} empty={filtered.length === 0}>
          <TimeSeriesChart data={volumeSeries} xKey="day" ariaLabel="Line chart of daily mention volume" series={[{ key: "volume", label: "Mentions", color: BLUE }]} />
        </ChartCard>
        <ChartCard title="Sentiment timeline" description="Posts per day by sentiment (related posts)" table={{ columns: ["Date", "Positive", "Neutral", "Negative"], rows: sentTimeline.map((r) => [r.date, r.positive, r.neutral, r.negative]) }} empty={sentTimeline.length === 0}>
          <TimeSeriesChart data={sentTimeline} xKey="date" ariaLabel="Line chart of post sentiment per day" series={(["positive", "neutral", "negative"] as const).map((k) => ({ key: k, label: titleCase(k), color: SENT_COLOR[k] }))} />
        </ChartCard>
      </section>

      <FilterPanel
        action="/issues"
        values={values}
        fields={[
          { name: "q", label: "Search", type: "text", placeholder: "issue or #hashtag" },
          { name: "platform", label: "Platform", options: PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABEL[p] })) },
          { name: "status", label: "Status", options: ["active", "monitoring", "closed"].map((s) => ({ value: s, label: titleCase(s) })) },
        ]}
      />
      <DataTable
        caption="Trending issues"
        rows={rows}
        rowKey={(e) => e.issue.id}
        empty="No issues match these filters."
        columns={[
          { header: "Issue", className: "max-w-xs whitespace-normal", cell: (e) => <span className="font-medium">{e.issue.title}</span> },
          { header: "Hashtag", cell: (e) => e.issue.hashtag },
          { header: "Platform", cell: (e) => <span className="flex flex-col gap-0.5">{e.issue.platforms.map((p) => <PlatformBadge key={p} platform={p} />)}</span> },
          { header: "Volume", className: "text-right tabular-nums", cell: (e) => formatNumber(e.issue.volume) },
          { header: "Growth", className: "text-right tabular-nums", cell: (e) => `${e.issue.growth > 0 ? "+" : ""}${e.issue.growth}%` },
          { header: "Engagement", className: "text-right tabular-nums", cell: (e) => formatNumber(e.engagement) },
          { header: "Sentiment", cell: (e) => <SentimentBadge sentiment={e.sentiment} /> },
          { header: "Accounts", className: "text-right tabular-nums", cell: (e) => e.accounts },
          { header: "Posts", className: "text-right tabular-nums", cell: (e) => <Link href={`/monitoring?issue=${e.issue.id}`} className="text-sky-400 hover:underline">{e.posts.length}</Link> },
          { header: "Risk", cell: (e) => <RiskBadge score={e.risk} /> },
          { header: "Status", cell: (e) => <StatusBadge status={e.issue.status} /> },
          { header: "First detected", className: "whitespace-nowrap", cell: (e) => formatDate(e.issue.firstDetectedAt) },
          { header: "Updated", className: "whitespace-nowrap", cell: (e) => formatDate(e.issue.lastUpdatedAt) },
        ]}
      />
      <Pagination page={page} pages={pages} total={total} basePath="/issues" params={values} />
    </div>
  );
}
