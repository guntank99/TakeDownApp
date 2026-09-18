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
import { formatDateTime, titleCase, truncate } from "@/lib/utils/format";
import { enumParam, pageParam, paginate, param } from "@/lib/utils/params";

export const metadata: Metadata = { title: "Reports" };

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
      <PageHeader title="Reports" description="Draft → review → approve → record submission through the platform's official mechanism. Reports are generated from a case; create one on the case page." />
      <div className="mb-4"><Notice>There is no automatic deletion, banning or mass reporting. Submission is always a person acting through an official page.</Notice></div>
      <Flash searchParams={sp} />
      <FilterPanel
        action="/reports"
        values={values}
        fields={[
          { name: "q", label: "Search", type: "text" },
          { name: "status", label: "Status", options: ["draft", "in_review", "approved", "submitted"].map((s) => ({ value: s, label: titleCase(s) })) },
        ]}
      />
      <DataTable
        caption="Reports"
        rows={rows}
        rowKey={(r) => r.id}
        empty="No reports match these filters."
        columns={[
          { header: "Report", cell: (r) => <Link href={`/reports/${r.id}`} className="font-medium text-sky-400 hover:underline">{r.id}</Link> },
          { header: "Title", className: "max-w-sm whitespace-normal", cell: (r) => truncate(r.title, 80) },
          { header: "Case", cell: (r) => <Link href={`/cases/${r.caseId}`} className="text-sky-400 hover:underline">{r.caseId}</Link> },
          { header: "Platform", cell: (r) => { const c = getCase(r.caseId); return c ? <PlatformBadge platform={c.platform} /> : "—"; } },
          { header: "Prepared by", cell: (r) => userName(r.createdBy) },
          { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
          { header: "Created", className: "whitespace-nowrap", cell: (r) => formatDateTime(r.createdAt) },
        ]}
      />
      <Pagination page={page} pages={pages} total={total} basePath="/reports" params={values} />
    </div>
  );
}
