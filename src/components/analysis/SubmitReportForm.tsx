"use client";

import { submitReportAction } from "@/app/(app)/actions";

/**
 * Recording a submission. The app never files anything itself: the person
 * opens the official reporting page, files the report there, then confirms here.
 */
export function SubmitReportForm({
  reportId,
  platformLabel,
  reportingUrl,
  note,
}: {
  reportId: string;
  platformLabel: string;
  reportingUrl: string;
  note: string;
}) {
  return (
    <form
      action={submitReportAction}
      onSubmit={(e) => {
        if (!window.confirm("Are you sure you want to submit this report?")) e.preventDefault();
      }}
      className="space-y-3"
    >
      <input type="hidden" name="reportId" value={reportId} />
      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-300">
        <li>
          {reportingUrl ? (
            <a href={reportingUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">
              Open Official Reporting Page ({platformLabel}) ↗
            </a>
          ) : (
            <span>{platformLabel} has no platform reporting page. {note}</span>
          )}
        </li>
        <li>File the report there yourself, using the evidence and findings from this report.</li>
        <li>Come back and confirm below so the submission is recorded.</li>
      </ol>
      {reportingUrl ? <p className="text-xs text-slate-500">{note}</p> : null}
      <label className="flex items-start gap-2 text-sm text-slate-300">
        <input type="checkbox" name="confirmed" required className="mt-0.5 size-4 accent-sky-500" />
        I have filed this report through the platform&apos;s official mechanism.
      </label>
      <button type="submit" className="rounded-lg bg-sky-500 px-4 py-1.5 text-sm font-semibold text-slate-950 hover:bg-sky-400">
        Record submission
      </button>
    </form>
  );
}
