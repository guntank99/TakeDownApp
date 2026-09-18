import type { Metadata } from "next";
import { Activity, Briefcase, ClipboardList, FileText, ShieldAlert, ShieldQuestion, Users } from "lucide-react";
import { ChartCard } from "@/components/charts/ChartCard";
import { HorizontalBarChart, TimeSeriesChart } from "@/components/charts/charts";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/layout";
import { verifySession } from "@/lib/auth/dal";
import { getDashboardSummary } from "@/lib/services/dashboard";
import { PLATFORM_COLOR } from "@/lib/utils/platforms";
import type { RiskLevel } from "@/types";

export const metadata: Metadata = { title: "Dashboard" };

const BLUE = "#3987e5";
const ORANGE = "#d95926";
const AQUA = "#199e70";
const SENTIMENT_COLOR = { Positive: BLUE, Neutral: "#94a3b8", Negative: ORANGE } as const;
/** Status palette: severity always ships with its text label as well. */
const RISK_COLOR: Record<RiskLevel, string> = { low: "#0ca30c", medium: "#fab219", high: "#ec835a", critical: "#d03b3b" };

export default async function DashboardPage() {
  await verifySession();
  const s = await getDashboardSummary();
  const isEmpty = s.totalPosts + s.trackedIssues + s.totalAccounts + s.totalCases + s.totalReports === 0;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of monitored activity, analytical indicators and case workload."
        mock={s.dataSource.isMock}
      />
      {isEmpty ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          <section aria-label="Key indicators" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total Posts" value={s.totalPosts} hint={`${s.postsNeedingReview} need review`} icon={FileText} />
            <MetricCard label="Total Accounts" value={s.totalAccounts} hint="monitored" icon={Users} />
            <MetricCard label="Active Issues" value={s.activeIssues} hint={`of ${s.trackedIssues} tracked`} icon={Activity} />
            <MetricCard label="High Risk Accounts" value={s.highRiskAccounts} hint={`of ${s.totalAccounts} accounts`} icon={ShieldAlert} tone="danger" />
            <MetricCard label="Potential Violations" value={s.potentialViolations} hint="posts with policy matches (unreviewed)" icon={ShieldQuestion} tone="danger" />
            <MetricCard label="Cases" value={s.totalCases} hint={`${s.openCases} not closed`} icon={Briefcase} />
            <MetricCard label="Reports" value={s.totalReports} hint={`${s.submittedReports} submitted`} icon={ClipboardList} />
          </section>

          <section aria-label="Charts" className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Mentions over time"
              description="Posts and comments per day (UTC), last 14 days"
              table={{ columns: ["Date", "Posts", "Comments"], rows: s.mentionsOverTime.map((d) => [d.date, d.posts, d.comments]) }}
              className="lg:col-span-2"
            >
              <TimeSeriesChart
                data={s.mentionsOverTime}
                xKey="date"
                ariaLabel="Line chart of posts and comments per day"
                series={[
                  { key: "posts", label: "Posts", color: BLUE },
                  { key: "comments", label: "Comments", color: ORANGE },
                ]}
              />
            </ChartCard>

            <ChartCard
              title="Platform distribution"
              description="Monitored posts by platform"
              table={{ columns: ["Platform", "Posts"], rows: s.platformDistribution.map((p) => [p.label, p.count]) }}
            >
              <HorizontalBarChart
                ariaLabel="Bar chart of posts per platform"
                data={s.platformDistribution.map((p) => ({ label: p.label, value: p.count, color: PLATFORM_COLOR[p.platform] }))}
              />
            </ChartCard>

            <ChartCard
              title="Sentiment"
              description="Automated keyword-based sentiment of posts"
              table={{ columns: ["Sentiment", "Posts"], rows: s.sentiment.map((x) => [x.name, x.value]) }}
            >
              <HorizontalBarChart
                ariaLabel="Bar chart of post sentiment"
                data={s.sentiment.map((x) => ({ label: x.name, value: x.value, color: SENTIMENT_COLOR[x.name] }))}
              />
            </ChartCard>

            <ChartCard
              title="Risk distribution"
              description="Posts by analytical risk level (indicator, not a decision)"
              table={{ columns: ["Level", "Posts"], rows: s.riskDistribution.map((x) => [x.level.toUpperCase(), x.count]) }}
            >
              <HorizontalBarChart
                ariaLabel="Bar chart of posts per risk level"
                data={s.riskDistribution.map((x) => ({ label: x.level.toUpperCase(), value: x.count, color: RISK_COLOR[x.level] }))}
              />
            </ChartCard>

            <ChartCard
              title="Violation categories"
              description="Indicators detected across posts (all need human review)"
              table={{ columns: ["Category", "Posts"], rows: s.violationCategories.map((x) => [x.label, x.count]) }}
              empty={s.violationCategories.length === 0}
            >
              <HorizontalBarChart
                labelWidth={170}
                ariaLabel="Bar chart of detected indicator categories"
                data={s.violationCategories.map((x) => ({ label: x.label, value: x.count, color: BLUE }))}
              />
            </ChartCard>

            <ChartCard
              title="Trending issues"
              description="Top issues by mention volume"
              table={{ columns: ["Issue", "Volume", "Growth %"], rows: s.trendingIssues.map((x) => [x.title, x.volume, x.growth]) }}
            >
              <HorizontalBarChart
                labelWidth={190}
                valueName="Mentions"
                ariaLabel="Bar chart of issue mention volume"
                data={s.trendingIssues.map((x) => ({ label: x.title.length > 28 ? `${x.title.slice(0, 27)}…` : x.title, value: x.volume, color: BLUE }))}
              />
            </ChartCard>

            <ChartCard
              title="Network growth"
              description="Cumulative distinct accounts seen posting or commenting"
              table={{ columns: ["Date", "Accounts"], rows: s.networkGrowth.map((x) => [x.date, x.accounts]) }}
            >
              <TimeSeriesChart
                data={s.networkGrowth}
                xKey="date"
                ariaLabel="Line chart of cumulative accounts in the network"
                series={[{ key: "accounts", label: "Accounts", color: AQUA }]}
              />
            </ChartCard>
          </section>
        </div>
      )}
      <p className="mt-6 text-xs text-slate-500">
        Risk indicators are analytical aids for human review, not final determinations.
      </p>
    </div>
  );
}
