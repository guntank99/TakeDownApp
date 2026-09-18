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

export const metadata: Metadata = { title: "Bukti" };

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
        title="Bukti"
        description="Snapshot konten yang disimpan dari sumber data, masing-masing dengan hash SHA-256 agar perubahan di kemudian hari dapat terdeteksi. Ambil bukti dari halaman kasus."
      />
      <FilterPanel
        action="/evidence"
        values={values}
        fields={[
          { name: "q", label: "Cari", type: "text", placeholder: "bukti, postingan, akun, teks" },
          { name: "case", label: "Kasus", options: cases.map((c) => ({ value: c.id, label: `${c.id}: ${c.title.slice(0, 40)}` })) },
        ]}
      />
      {rows.length === 0 ? (
        <EmptyState message="Tidak ada bukti yang cocok dengan filter ini." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((e) => <EvidenceCard key={e.id} evidence={e} intact={evidenceIntegrity(e)} />)}
        </div>
      )}
      <Pagination page={page} pages={pages} total={total} basePath="/evidence" params={values} />
    </div>
  );
}
