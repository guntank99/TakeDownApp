import type { CaseStatus, ReportRecord } from "@/types";

/**
 * Where a case stands on the take-down path. The path is the app's safeguard:
 * every step is done by a person, and the removal itself is decided by the
 * platform or authority, never by this app.
 *
 *   1 Kumpulkan bukti → 2 Verifikasi peninjau → 3 Susun & setujui laporan
 *   → 4 Ajukan lewat kanal resmi → 5 Catat hasil dari platform
 */
export type TakedownStage = "evidence" | "verify" | "report" | "submit" | "outcome" | "done";

export const TAKEDOWN_STEPS: { key: Exclude<TakedownStage, "done">; label: string }[] = [
  { key: "evidence", label: "Kumpulkan bukti" },
  { key: "verify", label: "Verifikasi peninjau" },
  { key: "report", label: "Susun & setujui laporan" },
  { key: "submit", label: "Ajukan lewat kanal resmi" },
  { key: "outcome", label: "Catat hasil platform" },
];

export interface TakedownProgress {
  stage: TakedownStage;
  /** Index of the current step (5 when everything is done). */
  index: number;
  /** What the next person should do, in plain Indonesian. */
  action: string;
  /** The report this progress refers to, when there is one. */
  reportId: string | null;
}

const VERIFIED_OR_LATER: CaseStatus[] = ["VERIFIED", "REPORTED", "CLOSED"];

export function takedownProgress(
  c: { status: CaseStatus },
  evidenceCount: number,
  reports: Pick<ReportRecord, "id" | "status" | "submission" | "createdAt">[],
): TakedownProgress {
  const make = (stage: TakedownStage, action: string, reportId: string | null = null): TakedownProgress => ({
    stage,
    index: stage === "done" ? TAKEDOWN_STEPS.length : TAKEDOWN_STEPS.findIndex((s) => s.key === stage),
    action,
    reportId,
  });

  const newestFirst = [...reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const submitted = newestFirst.find((r) => r.status === "submitted");
  const open = newestFirst.find((r) => r.status !== "submitted");

  // A report already filed takes priority: what remains is recording the outcome.
  if (submitted && !open) {
    const outcome = submitted.submission?.outcome ?? "pending";
    return outcome === "pending"
      ? make("outcome", "Tunggu keputusan platform, lalu catat hasilnya (dihapus, dibatasi, ditolak, atau tidak ada tindakan).", submitted.id)
      : make("done", "Selesai. Hasil dari platform sudah dicatat.", submitted.id);
  }

  if (evidenceCount === 0) return make("evidence", "Ambil bukti dari postingan terkait (snapshot + hash) sebelum melanjutkan.");
  if (!VERIFIED_OR_LATER.includes(c.status)) return make("verify", "Ajukan kasus ke peninjau. Kasus harus berstatus Terverifikasi oleh orang selain analis yang menanganinya.");

  if (!open) return make("report", "Buat draf laporan dari kasus ini.");
  if (open.status === "approved") return make("submit", "Buka kanal pelaporan resmi platform, ajukan laporan sendiri, lalu catat pengajuannya di sini.", open.id);
  return make("report", open.status === "draft" ? "Lengkapi draf laporan lalu kirim untuk ditinjau." : "Peninjau perlu memeriksa dan menyetujui laporan.", open.id);
}
