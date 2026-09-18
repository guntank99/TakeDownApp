import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, Pagination } from "@/components/tables/DataTable";
import { PlatformBadge, StatusBadge } from "@/components/ui/badges";
import { FilterPanel } from "@/components/ui/FilterPanel";
import { Flash, Notice, PageHeader } from "@/components/ui/layout";
import { userName } from "@/lib/auth/directory";
import { verifySession } from "@/lib/auth/dal";
import { getCase } from "@/lib/services/cases";
import { listReports } from "@/lib/services/reports";
import { formatDateTime, truncate } from "@/lib/utils/format";
import { REPORT_STATUS_LABEL } from "@/lib/i18n/labels";
import { enumParam, pageParam, paginate, param } from "@/lib/utils/params";

export const metadata: Metadata = { title: "Laporan" };

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  await verifySession();
  const sp = await searchParams;
  const q = param(sp, "q").slice(0, 200);
  const status = enumParam(sp, "status", ["draft", "in_review", "approved", "submitted"] as const);
  const all = (await listReports()).filter((r) => (!status || r.status === status) && (!q || `${r.id} ${r.title} ${r.caseId}`.toLowerCase().includes(q.toLowerCase())));
  const { rows, page, pages, total } = paginate(all, pageParam(sp), 15);
  const values = Object.fromEntries(Object.entries({ q, status }).filter(([, v]) => v)) as Record<string, string>;

  return (
    <div>
      <PageHeader title="Laporan" description="Draf → tinjau → setujui → catat pengajuan melalui mekanisme resmi platform. Laporan dibuat dari sebuah kasus; buat dari halaman kasus." />
      <div className="mb-4"><Notice>Tidak ada penghapusan, pemblokiran, atau pelaporan massal otomatis. Pengajuan selalu dilakukan oleh manusia melalui halaman resmi.</Notice></div>
      <Flash searchParams={sp} />
      <FilterPanel
        action="/reports"
        values={values}
        fields={[
          { name: "q", label: "Cari", type: "text" },
          { name: "status", label: "Status", options: (["draft", "in_review", "approved", "submitted"] as const).map((s) => ({ value: s, label: REPORT_STATUS_LABEL[s] })) },
        ]}
      />
      <DataTable
        caption="Laporan"
        rows={rows}
        rowKey={(r) => r.id}
        empty="Tidak ada laporan yang cocok dengan filter ini."
        columns={[
          { header: "Laporan", cell: (r) => <Link href={`/reports/${r.id}`} className="font-medium text-sky-400 hover:underline">{r.id}</Link> },
          { header: "Judul", className: "max-w-sm whitespace-normal", cell: (r) => truncate(r.title, 80) },
          { header: "Kasus", cell: (r) => <Link href={`/cases/${r.caseId}`} className="text-sky-400 hover:underline">{r.caseId}</Link> },
          { header: "Platform", cell: (r) => { const c = getCase(r.caseId); return c ? <PlatformBadge platform={c.platform} /> : "—"; } },
          { header: "Disusun oleh", cell: (r) => userName(r.createdBy) },
          { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
          { header: "Dibuat", className: "whitespace-nowrap", cell: (r) => formatDateTime(r.createdAt) },
        ]}
      />
      <Pagination page={page} pages={pages} total={total} basePath="/reports" params={values} />
    </div>
  );
}
