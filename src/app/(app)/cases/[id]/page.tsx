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
import { formatDateTime, titleCase, truncate } from "@/lib/utils/format";
import { PRIORITIES } from "@/lib/validation/schemas";
import { allowedNextStatuses, canTransitionCase } from "@/lib/workflow/rules";

export async function generateMetadata({ params }: PageProps<"/cases/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Case ${id}` };
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
        actions={<div className="flex items-center gap-2"><StatusBadge status={c.status} /><Badge>{c.priority.toUpperCase()} PRIORITY</Badge></div>}
      />
      <Flash searchParams={sp} />

      <Card title="Summary">
        <KeyValue
          items={[
            { label: "Platform", value: <PlatformBadge platform={c.platform} /> },
            { label: "Category", value: c.category },
            { label: "Analyst", value: userName(c.analystId) },
            { label: "Reviewer", value: userName(c.reviewerId) },
            { label: "Created", value: formatDateTime(c.createdAt) },
            { label: "Updated", value: formatDateTime(c.updatedAt) },
          ]}
        />
      </Card>

      {can(user.role, "case:update") ? (
        <Card title="Workflow" description="Every status change is recorded in the timeline and audit log">
          <div className="flex flex-wrap items-center gap-3">
            {nextStatuses.map(({ to, decision }) => (
              <form key={to} action={updateCaseAction} title={decision.ok ? undefined : decision.reason}>
                <input type="hidden" name="caseId" value={c.id} />
                <input type="hidden" name="status" value={to} />
                <button type="submit" disabled={!decision.ok} className={`${btn} disabled:cursor-not-allowed disabled:opacity-40`}>
                  Move to {to.replace("_", " ")}
                </button>
              </form>
            ))}
            <form action={updateCaseAction} className="flex items-center gap-2">
              <input type="hidden" name="caseId" value={c.id} />
              <label htmlFor="priority" className="sr-only">Priority</label>
              <select id="priority" name="priority" defaultValue={c.priority} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100">
                {PRIORITIES.map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}
              </select>
              <button type="submit" className={btn}>Set priority</button>
            </form>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Verification needs a reviewer who is not the case analyst. “Reported” is set automatically when a report submission is recorded.
          </p>
          {nextStatuses.some((n) => !n.decision.ok) ? (
            <ul className="mt-2 space-y-0.5 text-xs text-amber-300">
              {nextStatuses.filter((n) => !n.decision.ok).map((n) => <li key={n.to}>{n.to.replace("_", " ")}: {n.decision.ok ? "" : n.decision.reason}</li>)}
            </ul>
          ) : null}
        </Card>
      ) : null}

      <Card title={`Posts (${posts.length})`} description="Capture a post as evidence to preserve a hashed snapshot">
        <DataTable
          caption="Posts in this case"
          rows={posts}
          rowKey={(p) => p.id}
          empty="No posts attached yet. Add posts from a post page."
          columns={[
            { header: "Post", cell: (p) => <Link href={`/posts/${p.id}`} className="text-sky-400 hover:underline">{p.id}</Link> },
            { header: "Platform", cell: (p) => <PlatformBadge platform={p.platform} /> },
            { header: "Content", className: "max-w-md whitespace-normal", cell: (p) => truncate(p.text, 110) },
            { header: "Risk", cell: (p) => <RiskBadge score={ctx.postAnalysis.get(p.id)!.risk.score} /> },
            { header: "Policy matches", className: "max-w-xs whitespace-normal", cell: (p) => ctx.postAnalysis.get(p.id)!.policyMatches.slice(0, 2).map((m) => `${m.category}${m.ruleVerified ? "" : " (unverified rule)"}`).join(", ") || "—" },
            {
              header: "Evidence",
              cell: (p) =>
                evidenceByPost.has(p.id) ? <Badge tone="success">CAPTURED</Badge>
                : can(user.role, "evidence:create") && !closed ? (
                  <form action={createEvidenceAction}>
                    <input type="hidden" name="caseId" value={c.id} />
                    <input type="hidden" name="postId" value={p.id} />
                    <button type="submit" className={btn}>Capture</button>
                  </form>
                ) : "—",
            },
          ]}
        />
      </Card>

      <Card title={`Accounts (${accounts.length})`}>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2 text-sm">
              <Link href={`/accounts/${a.id}`} className="text-sky-400 hover:underline">{a.handle}</Link>
              <RiskBadge score={ctx.accountAnalysis.get(a.id)!.risk.score} />
            </li>
          ))}
          {accounts.length === 0 ? <li className="text-sm text-slate-500">No accounts attached.</li> : null}
        </ul>
      </Card>

      <Card title={`Evidence (${evidence.length})`}>
        {evidence.length ? (
          <div className="grid gap-4 lg:grid-cols-2">{evidence.map((e) => <EvidenceCard key={e.id} evidence={e} intact={evidenceIntegrity(e)} />)}</div>
        ) : <p className="text-sm text-slate-500">No evidence captured yet.</p>}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Timeline"><CaseTimeline events={c.timeline} /></Card>
        <Card title={`Notes (${c.notes.length})`}>
          <ul className="space-y-3">
            {c.notes.map((n) => (
              <li key={n.id} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm">
                <p className="text-slate-200">{n.text}</p>
                <p className="mt-1 text-xs text-slate-500">{userName(n.authorId)} · {formatDateTime(n.createdAt)}</p>
              </li>
            ))}
            {c.notes.length === 0 ? <li className="text-sm text-slate-500">No notes yet.</li> : null}
          </ul>
          {can(user.role, "case:update") ? (
            <form action={updateCaseAction} className="mt-4 space-y-2">
              <input type="hidden" name="caseId" value={c.id} />
              <label htmlFor="note" className="sr-only">Add a note</label>
              <textarea id="note" name="note" rows={3} required maxLength={2000} placeholder="Add a factual note…" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500" />
              <button type="submit" className={btn}>Add note</button>
            </form>
          ) : null}
        </Card>
      </div>

      <Card title={`Reports (${reports.length})`} description="Reports are drafted here, reviewed by a person, then filed through the platform's official mechanism">
        <ul className="mb-3 space-y-2">
          {reports.map((r) => (
            <li key={r.id} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2 text-sm">
              <Link href={`/reports/${r.id}`} className="text-sky-400 hover:underline">{r.id} — {truncate(r.title, 70)}</Link>
              <StatusBadge status={r.status} />
            </li>
          ))}
          {reports.length === 0 ? <li className="text-sm text-slate-500">No reports yet.</li> : null}
        </ul>
        {can(user.role, "report:create") && !closed ? (
          <form action={createReportAction}>
            <input type="hidden" name="caseId" value={c.id} />
            <button type="submit" className="rounded-lg bg-sky-500 px-4 py-1.5 text-sm font-semibold text-slate-950 hover:bg-sky-400">Generate draft report</button>
          </form>
        ) : null}
        {evidence.length === 0 ? <div className="mt-3"><Notice tone="warning">Capture evidence before reporting so the report can reference preserved snapshots.</Notice></div> : null}
      </Card>
    </div>
  );
}
