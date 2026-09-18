import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateReportAction } from "@/app/(app)/actions";
import { ReportPreview } from "@/components/analysis/CaseParts";
import { SubmitReportForm } from "@/components/analysis/SubmitReportForm";
import { PlatformBadge, StatusBadge } from "@/components/ui/badges";
import { Card, Flash, KeyValue, LinkButton, Notice, PageHeader } from "@/components/ui/layout";
import { verifySession } from "@/lib/auth/dal";
import { userName } from "@/lib/auth/directory";
import { can } from "@/lib/auth/permissions";
import { getCase } from "@/lib/services/cases";
import { getReport } from "@/lib/services/reports";
import { PLATFORM_REPORTING } from "@/lib/toc/reporting";
import { formatDateTime } from "@/lib/utils/format";
import { PLATFORM_LABEL } from "@/lib/utils/platforms";
import { canSubmitReport, canTransitionReport } from "@/lib/workflow/rules";

export async function generateMetadata({ params }: PageProps<"/reports/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Report ${id}` };
}

const btn = "rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40";
const field = "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500";

export default async function ReportDetailPage({ params, searchParams }: PageProps<"/reports/[id]">) {
  const user = await verifySession();
  const { id } = await params;
  const sp = await searchParams;
  const report = await getReport(id);
  if (!report) notFound();
  const c = getCase(report.caseId);
  if (!c) notFound();

  const reporting = PLATFORM_REPORTING[c.platform];
  const editable = report.status !== "submitted";
  const canEditNotes = editable && can(user.role, "report:review");
  const canEditAction = editable && (can(user.role, "report:create") || can(user.role, "report:review"));
  const transitions = (["in_review", "approved", "draft"] as const)
    .map((to) => ({ to, d: canTransitionReport(user, report, c.status, to) }))
    .filter(({ to }) => (to === "in_review" ? report.status === "draft" : to === "approved" ? report.status === "in_review" : report.status === "in_review" || report.status === "approved"));
  const submitDecision = canSubmitReport(user, report, c.status);
  const exportLink = (format: string) => `/api/reports/${report.id}/export?format=${format}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${report.id} — ${report.title}`}
        description="The analytical sections were frozen when this report was generated. Reviewer notes and the recommended action stay editable until submission."
        actions={<StatusBadge status={report.status} />}
      />
      <Flash searchParams={sp} />

      <Card title="Details">
        <KeyValue
          items={[
            { label: "Case", value: <Link href={`/cases/${c.id}`} className="text-sky-400 hover:underline">{c.id}</Link> },
            { label: "Platform", value: <PlatformBadge platform={c.platform} /> },
            { label: "Prepared by", value: userName(report.createdBy) },
            { label: "Approved by", value: userName(report.approvedBy) },
            { label: "Created", value: formatDateTime(report.createdAt) },
            { label: "Case status", value: <StatusBadge status={c.status} /> },
          ]}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="self-center text-xs text-slate-500">Export:</span>
          {(["pdf", "csv", "json"] as const).map((f) => (
            <a key={f} href={exportLink(f)} className={btn} download>{f.toUpperCase()}</a>
          ))}
        </div>
      </Card>

      <ReportPreview report={report} />

      {editable ? (
        <Card title="Review" description="Notes and next action; then move the report through the workflow">
          <form action={updateReportAction} className="space-y-3">
            <input type="hidden" name="reportId" value={report.id} />
            <div>
              <label htmlFor="reviewerNotes" className="mb-1 block text-sm text-slate-300">Reviewer notes {canEditNotes ? "" : "(reviewers only)"}</label>
              <textarea id="reviewerNotes" name="reviewerNotes" rows={4} defaultValue={report.reviewerNotes} readOnly={!canEditNotes} disabled={!canEditNotes} className={`${field} disabled:opacity-60`} />
            </div>
            <div>
              <label htmlFor="recommendedAction" className="mb-1 block text-sm text-slate-300">Recommended next action</label>
              <textarea id="recommendedAction" name="recommendedAction" rows={3} defaultValue={report.recommendedAction} readOnly={!canEditAction} disabled={!canEditAction} className={`${field} disabled:opacity-60`} />
            </div>
            {canEditNotes || canEditAction ? <button type="submit" className={btn}>Save changes</button> : null}
          </form>

          <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-800 pt-4">
            {transitions.map(({ to, d }) => (
              <form key={to} action={updateReportAction} title={d.ok ? undefined : d.reason}>
                <input type="hidden" name="reportId" value={report.id} />
                <input type="hidden" name="status" value={to} />
                <button type="submit" disabled={!d.ok} className={btn}>
                  {to === "in_review" ? "Send for review" : to === "approved" ? "Approve" : "Return to draft"}
                </button>
              </form>
            ))}
          </div>
          {transitions.some(({ d }) => !d.ok) ? (
            <ul className="mt-2 space-y-0.5 text-xs text-amber-300">
              {transitions.filter(({ d }) => !d.ok).map(({ to, d }) => <li key={to}>{to.replace("_", " ")}: {d.ok ? "" : d.reason}</li>)}
            </ul>
          ) : null}
        </Card>
      ) : null}

      <Card title="Official reporting" description="The app never submits reports on its own">
        {report.submission ? (
          <div className="space-y-1 text-sm text-slate-300">
            <p><StatusBadge status="submitted" /></p>
            <p>Report ID: <span className="font-mono">{report.id}</span></p>
            <p>Platform: {PLATFORM_LABEL[report.submission.platform]}</p>
            <p>Timestamp: {formatDateTime(report.submission.submittedAt)} by {userName(report.submission.submittedBy)}</p>
            <p>Method: {report.submission.method === "official_page" ? "Official reporting page (filed manually)" : "Authorized API"}</p>
          </div>
        ) : submitDecision.ok ? (
          <SubmitReportForm reportId={report.id} platformLabel={PLATFORM_LABEL[c.platform]} reportingUrl={reporting.officialReportingUrl} note={reporting.note} />
        ) : (
          <div className="space-y-2">
            <Notice tone="warning">Not ready to submit: {submitDecision.reason}</Notice>
            {reporting.officialReportingUrl ? <p className="text-xs text-slate-500">Official page for {PLATFORM_LABEL[c.platform]}: {reporting.officialReportingUrl}</p> : null}
          </div>
        )}
      </Card>
      <div><LinkButton href="/reports">Back to reports</LinkButton></div>
    </div>
  );
}
