import type { Metadata } from "next";
import { isPolicyStale } from "@/lib/toc/freshness";
import { nowMs } from "@/lib/utils/time";
import { DataTable, Pagination } from "@/components/tables/DataTable";
import { Badge, PlatformBadge } from "@/components/ui/badges";
import { FilterPanel } from "@/components/ui/FilterPanel";
import { Card, Notice, PageHeader } from "@/components/ui/layout";
import { verifySession } from "@/lib/auth/dal";
import { PLATFORM_REPORTING } from "@/lib/toc/reporting";
import { listPolicyRules } from "@/lib/toc/rules";
import { POLICY_CATEGORIES } from "@/lib/validation/schemas";
import { formatDate } from "@/lib/utils/format";
import { POLICY_CATEGORY_LABEL, SEVERITY_LABEL } from "@/lib/i18n/labels";
import { enumParam, pageParam, paginate, param } from "@/lib/utils/params";
import { PLATFORMS, PLATFORM_LABEL } from "@/lib/utils/platforms";

export const metadata: Metadata = { title: "Kebijakan (ToC/ToS)" };

export default async function TocPage({ searchParams }: PageProps<"/toc">) {
  await verifySession();
  const sp = await searchParams;
  const q = param(sp, "q").slice(0, 200);
  const platform = enumParam(sp, "platform", PLATFORMS);
  const category = enumParam(sp, "category", POLICY_CATEGORIES);
  const verification = enumParam(sp, "verification", ["verified_against_official_source", "needs_verification"] as const);

  const rules = listPolicyRules();
  const filtered = rules.filter(
    (r) => (!platform || r.platform === platform) && (!category || r.category === category) && (!verification || r.verification === verification)
      && (!q || `${r.rule} ${r.description}`.toLowerCase().includes(q.toLowerCase())),
  );
  const { rows, page, pages, total } = paginate(filtered, pageParam(sp), 15);
  const values = Object.fromEntries(Object.entries({ q, platform, category, verification }).filter(([, v]) => v)) as Record<string, string>;
  const verified = rules.filter((r) => r.verification === "verified_against_official_source").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Basis data kebijakan ToC / ToS"
        description="Aturan platform yang dipakai untuk pencocokan kebijakan. Entri hanya berasal dari halaman resmi; yang tidak dapat diverifikasi ditandai dan harus dicek sebelum diandalkan. Nama aturan mengikuti judul resmi aslinya."
        mock={false}
      />
      <Notice tone="warning">
        {verified} dari {rules.length} entri terverifikasi terhadap sumber resmi (Meta, YouTube, Telegram). Entri X, TikTok, dan Reddit hanyalah placeholder karena teks aturannya tidak dapat diambil otomatis; baca halaman resminya sebelum melapor. Deskripsi aturan adalah ringkasan singkat, bukan teks hukum.
      </Notice>

      <Card title="Mekanisme pelaporan resmi" description="Laporan diajukan oleh manusia melalui halaman-halaman ini. Tidak ada API pengajuan yang terintegrasi.">
        <DataTable
          caption="Halaman pelaporan resmi"
          rows={PLATFORMS.map((p) => PLATFORM_REPORTING[p])}
          rowKey={(r) => r.platform}
          columns={[
            { header: "Platform", cell: (r) => <PlatformBadge platform={r.platform} /> },
            { header: "Pelaporan", className: "max-w-xs whitespace-normal", cell: (r) => r.officialReportingUrl ? <a href={r.officialReportingUrl} target="_blank" rel="noopener noreferrer" className="break-all text-sky-400 hover:underline">{r.officialReportingUrl} ↗</a> : <span className="text-slate-500">tidak ada</span> },
            { header: "Indeks kebijakan", className: "max-w-xs whitespace-normal", cell: (r) => r.policyIndexUrl ? <a href={r.policyIndexUrl} target="_blank" rel="noopener noreferrer" className="break-all text-sky-400 hover:underline">{r.policyIndexUrl} ↗</a> : <span className="text-slate-500">—</span> },
            { header: "Catatan", className: "max-w-sm whitespace-normal text-slate-400", cell: (r) => r.note },
          ]}
        />
      </Card>

      <section>
        <FilterPanel
          action="/toc"
          values={values}
          fields={[
            { name: "q", label: "Cari", type: "text" },
            { name: "platform", label: "Platform", options: PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABEL[p] })) },
            { name: "category", label: "Kategori kebijakan", options: POLICY_CATEGORIES.map((c) => ({ value: c, label: POLICY_CATEGORY_LABEL[c] })) },
            { name: "verification", label: "Verifikasi", options: [{ value: "verified_against_official_source", label: "Terverifikasi" }, { value: "needs_verification", label: "Perlu verifikasi" }] },
          ]}
        />
        <DataTable
          caption="Aturan kebijakan"
          rows={rows}
          rowKey={(r) => r.id}
          empty="Tidak ada aturan kebijakan yang cocok dengan filter ini."
          columns={[
            { header: "Platform", cell: (r) => <PlatformBadge platform={r.platform} /> },
            { header: "Kategori", cell: (r) => POLICY_CATEGORY_LABEL[r.category] },
            { header: "Aturan", className: "max-w-[14rem] whitespace-normal font-medium", cell: (r) => r.rule },
            { header: "Deskripsi", className: "max-w-sm whitespace-normal text-slate-400", cell: (r) => r.description },
            { header: "Bukti yang dikumpulkan", className: "max-w-xs whitespace-normal text-slate-400", cell: (r) => r.evidenceRequirement },
            { header: "Tingkat", cell: (r) => <Badge tone={r.severity === "high" ? "danger" : r.severity === "medium" ? "warning" : "neutral"}>{SEVERITY_LABEL[r.severity].toUpperCase()}</Badge> },
            { header: "Versi kebijakan", className: "max-w-[12rem] whitespace-normal text-slate-400", cell: (r) => r.policyVersion },
            { header: "Verifikasi", cell: (r) => r.verification === "verified_against_official_source" ? <Badge tone="success">TERVERIFIKASI</Badge> : <Badge tone="warning">PERLU VERIFIKASI</Badge> },
            { header: "URL resmi", cell: (r) => <a href={r.officialUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">Buka ↗</a> },
            { header: "Dicek", className: "whitespace-nowrap", cell: (r) => (<span>{formatDate(r.lastUpdated)}{isPolicyStale(r.lastUpdated, nowMs()) ? <span className="ml-2"><Badge tone="warning">KEBIJAKAN MUNGKIN USANG</Badge></span> : null}</span>) },
          ]}
        />
        <Pagination page={page} pages={pages} total={total} basePath="/toc" params={values} />
      </section>
      <p className="text-xs text-slate-500">Basis data kebijakan bersifat baca-saja pada prototipe ini. Pengeditan (khusus admin, tercatat sebagai UPDATE_POLICY) hadir bersama penyimpanan berbasis database.</p>
    </div>
  );
}
