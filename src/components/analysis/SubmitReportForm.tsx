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
        if (!window.confirm("Apakah Anda yakin ingin mengajukan laporan ini?")) e.preventDefault();
      }}
      className="space-y-3"
    >
      <input type="hidden" name="reportId" value={reportId} />
      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-300">
        <li>
          {reportingUrl ? (
            <a href={reportingUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">
              Buka Halaman Pelaporan Resmi ({platformLabel}) ↗
            </a>
          ) : (
            <span>{platformLabel} tidak memiliki halaman pelaporan platform. {note}</span>
          )}
        </li>
        <li>Ajukan laporan di sana sendiri, memakai bukti dan temuan dari laporan ini.</li>
        <li>Kembali ke sini dan konfirmasi di bawah agar pengajuan tercatat.</li>
      </ol>
      {reportingUrl ? <p className="text-xs text-slate-500">{note}</p> : null}
      <label className="flex items-start gap-2 text-sm text-slate-300">
        <input type="checkbox" name="confirmed" required className="mt-0.5 size-4 accent-sky-500" />
        Saya telah mengajukan laporan ini melalui mekanisme resmi platform.
      </label>
      <button type="submit" className="rounded-lg bg-sky-500 px-4 py-1.5 text-sm font-semibold text-slate-950 hover:bg-sky-400">
        Catat pengajuan
      </button>
    </form>
  );
}
