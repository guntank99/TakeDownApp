import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, Pagination } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/badges";
import { FilterPanel } from "@/components/ui/FilterPanel";
import { Notice, PageHeader } from "@/components/ui/layout";
import { requireRole } from "@/lib/auth/dal";
import { listAudit } from "@/lib/services/audit";
import { formatDateTime } from "@/lib/utils/format";
import { pageParam, paginate, param } from "@/lib/utils/params";

export const metadata: Metadata = { title: "Audit log" };

const ACTIONS = [
  "LOGIN", "LOGIN_FAILED", "LOGOUT", "CREATE_CASE", "UPDATE_CASE", "ANALYZE_POST", "ANALYZE_ACCOUNT",
  "CREATE_EVIDENCE", "GENERATE_REPORT", "UPDATE_REPORT", "EXPORT_REPORT", "SUBMIT_REPORT", "UPDATE_POLICY",
];

export default async function AuditPage({ searchParams }: PageProps<"/audit">) {
  // Audit trails are sensitive: reviewers and admins only.
  await requireRole("admin", "reviewer");
  const sp = await searchParams;
  const action = param(sp, "action");
  const q = param(sp, "q").slice(0, 200);
  const result = param(sp, "result");

  const all = listAudit().filter(
    (e) => (!action || e.action === action) && (!result || e.result === result)
      && (!q || `${e.userName} ${e.object} ${e.caseId ?? ""}`.toLowerCase().includes(q.toLowerCase())),
  );
  const { rows, page, pages, total } = paginate(all, pageParam(sp), 20);
  const values = Object.fromEntries(Object.entries({ action, q, result }).filter(([, v]) => v)) as Record<string, string>;

  return (
    <div>
      <PageHeader title="Audit log" description="Append-only record of who did what, to which object, and whether it succeeded." />
      <div className="mb-4">
        <Notice tone="warning">Prototype store: entries live in memory and reset when the server restarts. Production keeps them in the database.</Notice>
      </div>
      <FilterPanel
        action="/audit"
        values={values}
        fields={[
          { name: "q", label: "Search", type: "text", placeholder: "user, object, case" },
          { name: "action", label: "Action", options: ACTIONS.map((a) => ({ value: a, label: a })) },
          { name: "result", label: "Result", options: ["SUCCESS", "DENIED", "FAILED"].map((r) => ({ value: r, label: r })) },
        ]}
      />
      <DataTable
        caption="Audit log"
        rows={rows}
        rowKey={(e) => e.id}
        empty="No audit entries match these filters."
        columns={[
          { header: "Timestamp", className: "whitespace-nowrap", cell: (e) => formatDateTime(e.at) },
          { header: "User", cell: (e) => e.userName },
          { header: "Action", cell: (e) => <span className="font-mono text-xs">{e.action}</span> },
          { header: "Object", className: "max-w-xs whitespace-normal", cell: (e) => e.object },
          { header: "Case ID", cell: (e) => e.caseId ? <Link href={`/cases/${e.caseId}`} className="text-sky-400 hover:underline">{e.caseId}</Link> : "—" },
          { header: "Result", cell: (e) => <Badge tone={e.result === "SUCCESS" ? "success" : e.result === "DENIED" ? "warning" : "critical"}>{e.result}</Badge> },
        ]}
      />
      <Pagination page={page} pages={pages} total={total} basePath="/audit" params={values} />
    </div>
  );
}
