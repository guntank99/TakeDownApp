import type { Metadata } from "next";
import { EvidenceCard } from "@/components/analysis/CaseParts";
import { Pagination } from "@/components/tables/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterPanel } from "@/components/ui/FilterPanel";
import { PageHeader } from "@/components/ui/layout";
import { verifySession } from "@/lib/auth/dal";
import { listCases } from "@/lib/services/cases";
import { evidenceIntegrity, listEvidence } from "@/lib/services/evidence";
import { pageParam, paginate, param } from "@/lib/utils/params";

export const metadata: Metadata = { title: "Evidence" };

export default async function EvidencePage({ searchParams }: PageProps<"/evidence">) {
  await verifySession();
  const sp = await searchParams;
  const caseId = param(sp, "case").slice(0, 64);
  const q = param(sp, "q").slice(0, 200);
  const cases = listCases();

  const all = listEvidence(caseId || undefined).filter(
    (e) => !q || `${e.id} ${e.postId ?? ""} ${e.snapshot.text} ${e.snapshot.accountHandle ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );
  const { rows, page, pages, total } = paginate(all, pageParam(sp), 8);
  const values = Object.fromEntries(Object.entries({ case: caseId, q }).filter(([, v]) => v)) as Record<string, string>;

  return (
    <div>
      <PageHeader
        title="Evidence"
        description="Content snapshots preserved from the data source, each with a SHA-256 hash so later changes can be detected. Capture evidence from a case page."
      />
      <FilterPanel
        action="/evidence"
        values={values}
        fields={[
          { name: "q", label: "Search", type: "text", placeholder: "evidence, post, account, text" },
          { name: "case", label: "Case", options: cases.map((c) => ({ value: c.id, label: `${c.id} — ${c.title.slice(0, 40)}` })) },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState message="No evidence matches these filters." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((e) => <EvidenceCard key={e.id} evidence={e} intact={evidenceIntegrity(e)} />)}
        </div>
      )}
      <Pagination page={page} pages={pages} total={total} basePath="/evidence" params={values} />
    </div>
  );
}
