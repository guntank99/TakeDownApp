import Link from "next/link";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { Badge, PlatformBadge } from "@/components/ui/badges";
import { userName } from "@/lib/auth/directory";
import { formatDateTime } from "@/lib/utils/format";
import type { CaseTimelineEvent, EvidenceRecord, ReportRecord } from "@/types";

export function CaseTimeline({ events }: { events: CaseTimelineEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-slate-500">No timeline events yet.</p>;
  return (
    <ol className="relative space-y-4 border-l border-slate-800 pl-5">
      {[...events].reverse().map((e) => (
        <li key={e.id}>
          <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full bg-sky-400" aria-hidden="true" />
          <p className="text-sm text-slate-200">{e.message}</p>
          <p className="text-xs text-slate-500">
            {formatDateTime(e.at)} · {userName(e.actorId)}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function EvidenceCard({ evidence, intact }: { evidence: EvidenceRecord; intact: boolean }) {
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-100">{evidence.id}</h3>
        <PlatformBadge platform={evidence.snapshot.platform} />
        {intact ? (
          <Badge tone="success"><CheckCircle2 className="size-3" aria-hidden="true" /> HASH VERIFIED</Badge>
        ) : (
          <Badge tone="critical"><TriangleAlert className="size-3" aria-hidden="true" /> HASH MISMATCH</Badge>
        )}
      </div>
      <p className="mt-2 text-sm text-slate-300">{evidence.snapshot.text}</p>
      <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
        <div><dt className="inline text-slate-500">Case: </dt><dd className="inline"><Link href={`/cases/${evidence.caseId}`} className="text-sky-400 hover:underline">{evidence.caseId}</Link></dd></div>
        <div><dt className="inline text-slate-500">Post: </dt><dd className="inline">{evidence.postId ? <Link href={`/posts/${evidence.postId}`} className="text-sky-400 hover:underline">{evidence.postId}</Link> : "—"}</dd></div>
        <div><dt className="inline text-slate-500">Account: </dt><dd className="inline text-slate-300">{evidence.snapshot.accountHandle ?? "—"}</dd></div>
        <div><dt className="inline text-slate-500">Captured: </dt><dd className="inline text-slate-300">{formatDateTime(evidence.capturedAt)} by {userName(evidence.collectedBy)}</dd></div>
        <div className="sm:col-span-2"><dt className="inline text-slate-500">URL: </dt><dd className="inline break-all text-slate-300">{evidence.url}</dd></div>
        <div className="sm:col-span-2"><dt className="inline text-slate-500">Source: </dt><dd className="inline text-slate-300">{evidence.source}</dd></div>
        <div className="sm:col-span-2"><dt className="inline text-slate-500">Screenshot: </dt><dd className="inline text-slate-300">{evidence.screenshotRef ?? "none attached (record an external reference if you keep one)"}</dd></div>
        <div className="sm:col-span-2"><dt className="text-slate-500">SHA-256</dt><dd className="break-all font-mono text-[11px] text-slate-400">{evidence.hash}</dd></div>
      </dl>
    </article>
  );
}

export function ReportPreview({ report }: { report: ReportRecord }) {
  const sections = [
    ...report.sections,
    { title: "Reviewer Notes", body: [report.reviewerNotes.trim() || "No reviewer notes recorded yet."] },
    { title: "Recommended Next Action", body: [report.recommendedAction.trim() || "None recorded."] },
  ];
  return (
    <div className="space-y-5 rounded-xl border border-slate-800 bg-slate-950/40 p-5">
      {sections.map((s) => (
        <section key={s.title}>
          <h3 className="mb-1.5 text-sm font-semibold text-slate-100">{s.title}</h3>
          <div className="space-y-1 text-sm text-slate-300">
            {s.body.map((line, i) => (
              <p key={i} className="break-words">{line}</p>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
