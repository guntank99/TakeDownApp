import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createEvidenceAction, createReportAction, updateCaseAction } from "@/app/(app)/actions";
import { CaseTimeline, EvidenceCard } from "@/components/analysis/CaseParts";
import { DataTable } from "@/components/tables/DataTable";
import { Badge, PlatformBadge, RiskBadge, StatusBadge } from "@/components/ui/badges";
import { Card, Flash, KeyValue, Notice, PageHeader } from "@/components/ui/layout";
import { verifySession } from "@/lib/auth/dal";
import { userName } from "@/lib/auth/directory";
import { can } from "@/lib/auth/permissions";
import { getAnalysisContext } from "@/lib/services/analysis";
import { getCase } from "@/lib/services/cases";
import { evidenceIntegrity, listEvidence } from "@/lib/services/evidence";
import { listReports } from "@/lib/services/reports";
import { formatDateTime, truncate } from "@/lib/utils/format";
import { CASE_STATUS_LABEL, POLICY_CATEGORY_LABEL, PRIORITY_LABEL } from "@/lib/i18n/labels";
import { PRIORITIES } from "@/lib/validation/schemas";
import { allowedNextStatuses, canTransitionCase } from "@/lib/workflow/rules";

export async function generateMetadata({ params }: PageProps<"/cases/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Kasus ${id}` };
}

const btn = "rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800";

export default async function CaseDetailPage({ params, searchParams }: PageProps<"/cases/[id]">) {
  const user = await verifySession();
  const { id } = await params;
  const sp = await searchParams;
  const c = getCase(id);
  if (!c) notFound();

  const ctx = await getAnalysisContext();
  const evidence = listEvidence(c.id);
  const reports = (await listReports()).filter((r) => r.caseId === c.id);
  const posts = c.postIds.map((pid) => ctx.postById.get(pid)).filter((p) => p !== undefined);
  const accounts = c.accountIds.map((aid) => ctx.accountById.get(aid)).filter((a) => a !== undefined);
  const evidenceByPost = new Set(evidence.map((e) => e.postId));
  const nextStatuses = allowedNextStatuses(c.status).map((to) => ({ to, decision: canTransitionCase(user, c, to) }));
  const closed = c.status === "CLOSED";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${c.id} — ${c.title}`}
        description={c.description}
        actions={<div className="flex items-center gap-2"><StatusBadge status={c.status} /><Badge>PRIORITAS {PRIORITY_LABEL[c.priority].toUpperCase()}</Badge></div>}
      />
      <Flash searchParams={sp} />

      <Card title="Ringkasan">
        <KeyValue
          items={[
            { label: "Platform", value: <PlatformBadge platform={c.platform} /> },
            { label: "Kategori", value: POLICY_CATEGORY_LABEL[c.category] },
            { label: "Analis", value: userName(c.analystId) },
            { label: "Peninjau", value: userName(c.reviewerId) },
            { label: "Dibuat", value: formatDateTime(c.createdAt) },
            { label: "Diperbarui", value: formatDateTime(c.updatedAt) },
          ]}
        />
      </Card>

      {can(user.role, "case:update") ? (
        <Card title="Alur kerja" description="Setiap perubahan status tercatat pada lini masa dan riwayat aktivitas">
          <div className="flex flex-wrap items-center gap-3">
            {nextStatuses.map(({ to, decision }) => (
              <form key={to} action={updateCaseAction} title={decision.ok ? undefined : decision.reason}>
                <input type="hidden" name="caseId" value={c.id} />
                <input type="hidden" name="status" value={to} />
                <button type="submit" disabled={!decision.ok} className={`${btn} disabled:cursor-not-allowed disabled:opacity-40`}>
                  Pindahkan ke {CASE_STATUS_LABEL[to]}
                </button>
              </form>
            ))}
            <form action={updateCaseAction} className="flex items-center gap-2">
              <input type="hidden" name="caseId" value={c.id} />
              <label htmlFor="priority" className="sr-only">Prioritas</label>
              <select id="priority" name="priority" defaultValue={c.priority} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100">
                {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
              </select>
              <button type="submit" className={btn}>Atur prioritas</button>
            </form>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Verifikasi memerlukan peninjau yang bukan analis kasus. Status “Sudah dilaporkan” diatur otomatis saat pengajuan laporan dicatat.
          </p>
          {nextStatuses.some((n) => !n.decision.ok) ? (
            <ul className="mt-2 space-y-0.5 text-xs text-amber-300">
              {nextStatuses.filter((n) => !n.decision.ok).map((n) => <li key={n.to}>{CASE_STATUS_LABEL[n.to]}: {n.decision.ok ? "" : n.decision.reason}</li>)}
            </ul>
          ) : null}
        </Card>
      ) : null}

      <Card title={`Postingan (${posts.length})`} description="Ambil postingan sebagai bukti untuk menyimpan snapshot ber-hash">
        <DataTable
          caption="Postingan dalam kasus ini"
          rows={posts}
          rowKey={(p) => p.id}
          empty="Belum ada postingan yang dilampirkan. Tambahkan dari halaman postingan."
          columns={[
            { header: "Postingan", cell: (p) => <Link href={`/posts/${p.id}`} className="text-sky-400 hover:underline">{p.id}</Link> },
            { header: "Platform", cell: (p) => <PlatformBadge platform={p.platform} /> },
            { header: "Konten", className: "max-w-md whitespace-normal", cell: (p) => truncate(p.text, 110) },
            { header: "Risiko", cell: (p) => <RiskBadge score={ctx.postAnalysis.get(p.id)!.risk.score} /> },
            { header: "Kecocokan kebijakan", className: "max-w-xs whitespace-normal", cell: (p) => ctx.postAnalysis.get(p.id)!.policyMatches.slice(0, 2).map((m) => `${m.category}${m.ruleVerified ? "" : " (aturan belum diverifikasi)"}`).join(", ") || "—" },
            {
              header: "Bukti",
              cell: (p) =>
                evidenceByPost.has(p.id) ? <Badge tone="success">SUDAH DIAMBIL</Badge>
                : can(user.role, "evidence:create") && !closed ? (
                  <form action={createEvidenceAction}>
                    <input type="hidden" name="caseId" value={c.id} />
                    <input type="hidden" name="postId" value={p.id} />
                    <button type="submit" className={btn}>Ambil bukti</button>
                  </form>
                ) : "—",
            },
          ]}
        />
      </Card>

      <Card title={`Akun (${accounts.length})`}>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2 text-sm">
              <Link href={`/accounts/${a.id}`} className="text-sky-400 hover:underline">{a.handle}</Link>
              <RiskBadge score={ctx.accountAnalysis.get(a.id)!.risk.score} />
            </li>
          ))}
          {accounts.length === 0 ? <li className="text-sm text-slate-500">Belum ada akun yang dilampirkan.</li> : null}
        </ul>
      </Card>

      <Card title={`Bukti (${evidence.length})`}>
        {evidence.length ? (
          <div className="grid gap-4 lg:grid-cols-2">{evidence.map((e) => <EvidenceCard key={e.id} evidence={e} intact={evidenceIntegrity(e)} />)}</div>
        ) : <p className="text-sm text-slate-500">Belum ada bukti yang diambil.</p>}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Lini masa"><CaseTimeline events={c.timeline} /></Card>
        <Card title={`Catatan (${c.notes.length})`}>
          <ul className="space-y-3">
            {c.notes.map((n) => (
              <li key={n.id} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm">
                <p className="text-slate-200">{n.text}</p>
                <p className="mt-1 text-xs text-slate-500">{userName(n.authorId)} · {formatDateTime(n.createdAt)}</p>
              </li>
            ))}
            {c.notes.length === 0 ? <li className="text-sm text-slate-500">Belum ada catatan.</li> : null}
          </ul>
          {can(user.role, "case:update") ? (
            <form action={updateCaseAction} className="mt-4 space-y-2">
              <input type="hidden" name="caseId" value={c.id} />
              <label htmlFor="note" className="sr-only">Tambah catatan</label>
              <textarea id="note" name="note" rows={3} required maxLength={2000} placeholder="Tambahkan catatan faktual…" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500" />
              <button type="submit" className={btn}>Tambah catatan</button>
            </form>
          ) : null}
        </Card>
      </div>

      <Card title={`Laporan (${reports.length})`} description="Laporan disusun di sini, ditinjau oleh manusia, lalu diajukan melalui mekanisme resmi platform">
        <ul className="mb-3 space-y-2">
          {reports.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2 text-sm">
              <Link href={`/reports/${r.id}`} className="text-sky-400 hover:underline">{r.id} — {truncate(r.title, 70)}</Link>
              <StatusBadge status={r.status} />
            </li>
          ))}
          {reports.length === 0 ? <li className="text-sm text-slate-500">Belum ada laporan.</li> : null}
        </ul>
        {can(user.role, "report:create") && !closed ? (
          <form action={createReportAction}>
            <input type="hidden" name="caseId" value={c.id} />
            <button type="submit" className="rounded-lg bg-sky-500 px-4 py-1.5 text-sm font-semibold text-slate-950 hover:bg-sky-400">Buat draf laporan</button>
          </form>
        ) : null}
        {evidence.length === 0 ? <div className="mt-3"><Notice tone="warning">Ambil bukti sebelum melapor agar laporan dapat merujuk pada snapshot yang tersimpan.</Notice></div> : null}
      </Card>
    </div>
  );
}
