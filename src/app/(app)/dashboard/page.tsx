import type { Metadata } from "next";
import { Activity, Briefcase, ClipboardList, FileText, ShieldAlert, ShieldQuestion, Users } from "lucide-react";
import { ChartCard } from "@/components/charts/ChartCard";
import { HorizontalBarChart, TimeSeriesChart } from "@/components/charts/charts";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/layout";
import { verifySession } from "@/lib/auth/dal";
import { RISK_LABEL } from "@/lib/i18n/labels";
import { getDashboardSummary } from "@/lib/services/dashboard";
import { PLATFORM_COLOR } from "@/lib/utils/platforms";
import type { RiskLevel } from "@/types";

export const metadata: Metadata = { title: "Dasbor" };

const BLUE = "#3987e5";
const ORANGE = "#d95926";
const AQUA = "#199e70";
const SENTIMENT_COLOR = { Positif: BLUE, Netral: "#94a3b8", Negatif: ORANGE } as const;
/** Status palette: severity always ships with its text label as well. */
const RISK_COLOR: Record<RiskLevel, string> = { low: "#0ca30c", medium: "#fab219", high: "#ec835a", critical: "#d03b3b" };

export default async function DashboardPage() {
  await verifySession();
  const s = await getDashboardSummary();
  const isEmpty = s.totalPosts + s.trackedIssues + s.totalAccounts + s.totalCases + s.totalReports === 0;

  return (
    <div>
      <PageHeader
        title="Dasbor"
        description="Ringkasan aktivitas yang dipantau, indikator analitis, dan beban kerja kasus."
        mock={s.dataSource.isMock}
      />
      {isEmpty ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          <section aria-label="Indikator utama" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Total Postingan" value={s.totalPosts} hint={`${s.postsNeedingReview} perlu ditinjau`} icon={FileText} />
            <MetricCard label="Total Akun" value={s.totalAccounts} hint="dipantau" icon={Users} />
            <MetricCard label="Isu Aktif" value={s.activeIssues} hint={`dari ${s.trackedIssues} isu dipantau`} icon={Activity} />
            <MetricCard label="Akun Berisiko Tinggi" value={s.highRiskAccounts} hint={`dari ${s.totalAccounts} akun`} icon={ShieldAlert} tone="danger" />
            <MetricCard label="Potensi Pelanggaran" value={s.potentialViolations} hint="postingan dengan kecocokan kebijakan (belum ditinjau)" icon={ShieldQuestion} tone="danger" />
            <MetricCard label="Kasus" value={s.totalCases} hint={`${s.openCases} belum ditutup`} icon={Briefcase} />
            <MetricCard label="Laporan" value={s.totalReports} hint={`${s.submittedReports} sudah diajukan`} icon={ClipboardList} />
          </section>

          <section aria-label="Grafik" className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Penyebutan dari waktu ke waktu"
              description="Postingan dan komentar per hari (WIB), 14 hari terakhir"
              table={{ columns: ["Tanggal", "Postingan", "Komentar"], rows: s.mentionsOverTime.map((d) => [d.date, d.posts, d.comments]) }}
              className="lg:col-span-2"
            >
              <TimeSeriesChart
                data={s.mentionsOverTime}
                xKey="date"
                ariaLabel="Grafik garis postingan dan komentar per hari"
                series={[
                  { key: "posts", label: "Postingan", color: BLUE },
                  { key: "comments", label: "Komentar", color: ORANGE },
                ]}
              />
            </ChartCard>

            <ChartCard
              title="Distribusi platform"
              description="Postingan yang dipantau menurut platform"
              table={{ columns: ["Platform", "Postingan"], rows: s.platformDistribution.map((p) => [p.label, p.count]) }}
            >
              <HorizontalBarChart
                ariaLabel="Grafik batang postingan per platform"
                data={s.platformDistribution.map((p) => ({ label: p.label, value: p.count, color: PLATFORM_COLOR[p.platform] }))}
              />
            </ChartCard>

            <ChartCard
              title="Sentimen"
              description="Sentimen postingan berbasis kata kunci otomatis"
              table={{ columns: ["Sentimen", "Postingan"], rows: s.sentiment.map((x) => [x.name, x.value]) }}
            >
              <HorizontalBarChart
                ariaLabel="Grafik batang sentimen postingan"
                data={s.sentiment.map((x) => ({ label: x.name, value: x.value, color: SENTIMENT_COLOR[x.name] }))}
              />
            </ChartCard>

            <ChartCard
              title="Distribusi risiko"
              description="Postingan menurut tingkat risiko analitis (indikator, bukan keputusan)"
              table={{ columns: ["Tingkat", "Postingan"], rows: s.riskDistribution.map((x) => [RISK_LABEL[x.level], x.count]) }}
            >
              <HorizontalBarChart
                ariaLabel="Grafik batang postingan per tingkat risiko"
                data={s.riskDistribution.map((x) => ({ label: RISK_LABEL[x.level], value: x.count, color: RISK_COLOR[x.level] }))}
              />
            </ChartCard>

            <ChartCard
              title="Kategori pelanggaran"
              description="Indikator yang terdeteksi pada postingan (semuanya perlu tinjauan manusia)"
              table={{ columns: ["Kategori", "Postingan"], rows: s.violationCategories.map((x) => [x.label, x.count]) }}
              empty={s.violationCategories.length === 0}
            >
              <HorizontalBarChart
                labelWidth={190}
                ariaLabel="Grafik batang kategori indikator yang terdeteksi"
                data={s.violationCategories.map((x) => ({ label: x.label, value: x.count, color: BLUE }))}
              />
            </ChartCard>

            <ChartCard
              title="Isu yang sedang tren"
              description="Isu teratas menurut volume penyebutan"
              table={{ columns: ["Isu", "Volume", "Pertumbuhan %"], rows: s.trendingIssues.map((x) => [x.title, x.volume, x.growth]) }}
            >
              <HorizontalBarChart
                labelWidth={210}
                valueName="Penyebutan"
                ariaLabel="Grafik batang volume penyebutan isu"
                data={s.trendingIssues.map((x) => ({ label: x.title.length > 30 ? `${x.title.slice(0, 29)}…` : x.title, value: x.volume, color: BLUE }))}
              />
            </ChartCard>

            <ChartCard
              title="Pertumbuhan jaringan"
              description="Jumlah kumulatif akun berbeda yang memposting atau berkomentar"
              table={{ columns: ["Tanggal", "Akun"], rows: s.networkGrowth.map((x) => [x.date, x.accounts]) }}
            >
              <TimeSeriesChart
                data={s.networkGrowth}
                xKey="date"
                ariaLabel="Grafik garis jumlah kumulatif akun dalam jaringan"
                series={[{ key: "accounts", label: "Akun", color: AQUA }]}
              />
            </ChartCard>
          </section>
        </div>
      )}
      <p className="mt-6 text-xs text-slate-500">
        Indikator risiko adalah alat bantu tinjauan manusia, bukan keputusan akhir.
      </p>
    </div>
  );
}
