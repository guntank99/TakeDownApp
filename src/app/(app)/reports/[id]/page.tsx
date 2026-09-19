import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { recordOutcomeAction, updateReportAction } from "@/app/(app)/actions";
import { ReportPreview } from "@/components/analysis/CaseParts";
import { SubmitReportForm } from "@/components/analysis/SubmitReportForm";
import { Badge, PlatformBadge, StatusBadge } from "@/components/ui/badges";
import { Card, Flash, KeyValue, LinkButton, Notice, PageHeader } from "@/components/ui/layout";
import { verifySession } from "@/lib/auth/dal";
import { userName } from "@/lib/auth/directory";
import { can } from "@/lib/auth/permissions";
import { getCase } from "@/lib/services/cases";
import { getReadiness, getReport } from "@/lib/services/reports";
import { PLATFORM_REPORTING } from "@/lib/toc/reporting";
import { formatDateTime } from "@/lib/utils/format";
import { REPORT_STATUS_LABEL, TAKEDOWN_OUTCOME_LABEL } from "@/lib/i18n/labels";
import { PLATFORM_LABEL } from "@/lib/utils/platforms";
import { canSubmitReport, canTransitionReport } from "@/lib/workflow/rules";

export async function generateMetadata({ params }: PageProps<"/reports/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Laporan ${id}` };
}

const btn = "rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40";
const field = "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500";

export default async function ReportDetailPage({ params, searchParams }: PageProps<"/reports/[id]">) {
  const user = await verifySession();
  const { id } = await params;
  const sp = await searchParams;
  const report = await getReport(id);
  if (!report) notFound();
  const c = await getCase(report.caseId);
  if (!c) notFound();

  const reporting = PLATFORM_REPORTING[c.platform];
  const editable = report.status !== "submitted";
  const canEditNotes = editable && can(user.role, "report:review");
  const canEditAction = editable && (can(user.role, "report:create") || can(user.role, "report:review"));
  const transitions = (["in_review", "approved", "draft"] as const)
    .map((to) => ({ to, d: canTransitionReport(user, report, c.status, to) }))
    .filter(({ to }) => (to === "in_review" ? report.status === "draft" : to === "approved" ? report.status === "in_review" : report.status === "in_review" || report.status === "approved"));
  const submitDecision = canSubmitReport(user, report, c.status);
  const readiness = report.status === "submitted" ? null : await getReadiness(report);
  const exportLink = (format: string) => `/api/reports/${report.id}/export?format=${format}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${report.id} — ${report.title}`}
        description="Bagian analitis dibekukan saat laporan ini dibuat. Catatan peninjau dan rekomendasi tindakan tetap dapat diubah sampai laporan diajukan."
        actions={<StatusBadge status={report.status} />}
      />
      <Flash searchParams={sp} />

      <Card title="Rincian">
        <KeyValue
          items={[
            { label: "Kasus", value: <Link href={`/cases/${c.id}`} className="text-sky-400 hover:underline">{c.id}</Link> },
            { label: "Platform", value: <PlatformBadge platform={c.platform} /> },
            { label: "Disusun oleh", value: userName(report.createdBy) },
            { label: "Disetujui oleh", value: userName(report.approvedBy) },
            { label: "Dibuat", value: formatDateTime(report.createdAt) },
            { label: "Status kasus", value: <StatusBadge status={c.status} /> },
          ]}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="self-center text-xs text-slate-500">Ekspor:</span>
          {(["pdf", "csv", "json", "md", "package"] as const).map((f) => (
            <a key={f} href={exportLink(f)} className={btn} download>{f === "package" ? "PAKET (JSON)" : f === "md" ? "PAKET (MARKDOWN)" : f.toUpperCase()}</a>
          ))}
        </div>
      </Card>

      <ReportPreview report={report} />

      {editable ? (
        <Card title="Tinjauan" description="Catatan dan tindakan berikutnya; lalu gerakkan laporan melalui alur kerja">
          <form action={updateReportAction} className="space-y-3">
            <input type="hidden" name="reportId" value={report.id} />
            <div>
              <label htmlFor="reviewerNotes" className="mb-1 block text-sm text-slate-300">Catatan peninjau {canEditNotes ? "" : "(khusus peninjau)"}</label>
              <textarea id="reviewerNotes" name="reviewerNotes" rows={4} defaultValue={report.reviewerNotes} readOnly={!canEditNotes} disabled={!canEditNotes} className={`${field} disabled:opacity-60`} />
            </div>
            <div>
              <label htmlFor="recommendedAction" className="mb-1 block text-sm text-slate-300">Rekomendasi tindakan berikutnya</label>
              <textarea id="recommendedAction" name="recommendedAction" rows={3} defaultValue={report.recommendedAction} readOnly={!canEditAction} disabled={!canEditAction} className={`${field} disabled:opacity-60`} />
            </div>
            {canEditNotes || canEditAction ? <button type="submit" className={btn}>Simpan perubahan</button> : null}
          </form>

          <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-800 pt-4">
            {transitions.map(({ to, d }) => (
              <form key={to} action={updateReportAction} title={d.ok ? undefined : d.reason}>
                <input type="hidden" name="reportId" value={report.id} />
                <input type="hidden" name="status" value={to} />
                <button type="submit" disabled={!d.ok} className={btn}>
                  {to === "in_review" ? "Kirim untuk ditinjau" : to === "approved" ? "Setujui" : "Kembalikan ke draf"}
                </button>
              </form>
            ))}
          </div>
          {transitions.some(({ d }) => !d.ok) ? (
            <ul className="mt-2 space-y-0.5 text-xs text-amber-300">
              {transitions.filter(({ d }) => !d.ok).map(({ to, d }) => <li key={to}>{REPORT_STATUS_LABEL[to]}: {d.ok ? "" : d.reason}</li>)}
            </ul>
          ) : null}
        </Card>
      ) : null}

      {readiness ? (
        <Card title="Kesiapan laporan" description="Mengukur kelengkapan laporan, bukan kepastian pelanggaran. Pemeriksaan bertanda WAJIB harus lulus sebelum laporan dapat diajukan.">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <span className="text-3xl font-semibold tabular-nums text-slate-50">{readiness.score}<span className="text-base text-slate-500">/100</span></span>
            {readiness.ready ? <Badge tone="success">SIAP DIAJUKAN</Badge> : <Badge tone="danger">BELUM SIAP</Badge>}
            <span className="text-xs text-slate-500">{readiness.lines.map((l) => `${l.label} ${l.score}/${l.max}`).join(" · ")}</span>
          </div>
          <ul className="space-y-1.5 text-sm">
            {readiness.checks.map((k) => (
              <li key={k.key} className="flex flex-wrap items-start gap-2">
                <Badge tone={k.status === "PASS" ? "success" : k.blocking ? "danger" : "warning"}>{k.status === "PASS" ? "LULUS" : k.blocking ? "WAJIB PERBAIKI" : "PERIKSA"}</Badge>
                <span className="text-slate-200">{k.label}</span>
                <span className="text-xs text-slate-500">{k.detail}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card title="Pelaporan resmi" description="Aplikasi tidak pernah mengajukan laporan sendiri">
        {report.submission ? (
          <div className="space-y-1 text-sm text-slate-300">
            <p><StatusBadge status="submitted" /></p>
            <p>ID Laporan: <span className="font-mono">{report.id}</span></p>
            <p>Platform: {PLATFORM_LABEL[report.submission.platform]}</p>
            <p>Waktu: {formatDateTime(report.submission.submittedAt)} oleh {userName(report.submission.submittedBy)}</p>
            <p>Metode: {report.submission.method === "official_page" ? "Halaman pelaporan resmi (diajukan manual)" : "API resmi"}</p>
            <p>
              Hasil dari platform: <Badge tone={report.submission.outcome === "removed" || report.submission.outcome === "restricted" ? "success" : report.submission.outcome === "rejected" ? "danger" : "neutral"}>{TAKEDOWN_OUTCOME_LABEL[report.submission.outcome ?? "pending"].toUpperCase()}</Badge>
              {report.submission.outcomeAt ? <span className="text-xs text-slate-500"> · dicatat {formatDateTime(report.submission.outcomeAt)} oleh {userName(report.submission.outcomeBy)}</span> : null}
            </p>
            {report.submission.outcomeNote ? <p className="text-slate-400">Catatan: {report.submission.outcomeNote}</p> : null}
            {can(user.role, "report:submit") ? (
              <form action={recordOutcomeAction} className="mt-4 space-y-3 border-t border-slate-800 pt-4">
                <input type="hidden" name="reportId" value={report.id} />
                <p className="text-xs text-slate-500">Catat keputusan platform setelah Anda menerima balasannya atau memeriksa kontennya. Aplikasi tidak menebak hasilnya.</p>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label htmlFor="outcome" className="mb-1 block text-xs text-slate-400">Hasil</label>
                    <select id="outcome" name="outcome" defaultValue={report.submission.outcome ?? "pending"} className={field}>
                      {(Object.keys(TAKEDOWN_OUTCOME_LABEL) as (keyof typeof TAKEDOWN_OUTCOME_LABEL)[]).map((o) => <option key={o} value={o}>{TAKEDOWN_OUTCOME_LABEL[o]}</option>)}
                    </select>
                  </div>
                  <div className="min-w-0 flex-1 basis-64">
                    <label htmlFor="outcome-note" className="mb-1 block text-xs text-slate-400">Catatan (mis. nomor tiket, alasan penolakan)</label>
                    <input id="outcome-note" name="note" maxLength={1000} defaultValue={report.submission.outcomeNote ?? ""} className={field} />
                  </div>
                  <button type="submit" className={btn}>Simpan hasil</button>
                </div>
              </form>
            ) : null}
          </div>
        ) : submitDecision.ok ? (
          <SubmitReportForm reportId={report.id} platformLabel={PLATFORM_LABEL[c.platform]} reportingUrl={reporting.officialReportingUrl} note={reporting.note} />
        ) : (
          <div className="space-y-2">
            <Notice tone="warning">Belum dapat diajukan: {submitDecision.reason}</Notice>
            {reporting.officialReportingUrl ? <p className="text-xs text-slate-500">Halaman resmi {PLATFORM_LABEL[c.platform]}: {reporting.officialReportingUrl}</p> : null}
          </div>
        )}
      </Card>
      <div><LinkButton href="/reports">Kembali ke laporan</LinkButton></div>
    </div>
  );
}
