import { can } from "@/lib/auth/permissions";
import { CASE_STATUS_LABEL } from "@/lib/i18n/labels";
import type { CaseRecord, CaseStatus, ReportRecord, ReportStatus, SessionUser } from "@/types";

/**
 * Human-review workflow rules. Pure functions so they can be unit-tested and
 * reused by both server actions and API routes.
 *
 * Principles:
 *  - Nothing is VERIFIED / approved / submitted without a human reviewer.
 *  - Four-eyes: the person who prepared a case or report cannot verify or
 *    approve it themselves.
 *  - REPORTED is only reachable by recording a report submission.
 */

export type Decision = { ok: true } | { ok: false; reason: string };
const ok: Decision = { ok: true };
const deny = (reason: string): Decision => ({ ok: false, reason });

const NEXT: Record<CaseStatus, CaseStatus[]> = {
  OPEN: ["INVESTIGATING", "CLOSED"],
  INVESTIGATING: ["NEEDS_REVIEW", "OPEN", "CLOSED"],
  NEEDS_REVIEW: ["VERIFIED", "INVESTIGATING", "CLOSED"],
  VERIFIED: ["NEEDS_REVIEW", "CLOSED"], // REPORTED only via submission
  REPORTED: ["CLOSED"],
  CLOSED: ["OPEN"],
};

export function allowedNextStatuses(from: CaseStatus): CaseStatus[] {
  return NEXT[from];
}

export function canTransitionCase(
  user: SessionUser,
  c: Pick<CaseRecord, "status" | "analystId">,
  to: CaseStatus,
): Decision {
  if (!can(user.role, "case:update")) return deny("Peran Anda tidak dapat memperbarui kasus.");
  if (to === "REPORTED") return deny("Kasus menjadi 'Sudah dilaporkan' hanya saat pengajuan laporan dicatat.");
  if (!NEXT[c.status].includes(to)) {
    return deny(`Kasus tidak dapat dipindahkan dari "${CASE_STATUS_LABEL[c.status]}" ke "${CASE_STATUS_LABEL[to]}".`);
  }
  if (to === "VERIFIED") {
    if (!can(user.role, "case:verify")) return deny("Hanya peninjau yang dapat memverifikasi kasus.");
    if (user.id === c.analystId) return deny("Anda tidak dapat memverifikasi kasus yang Anda tangani sebagai analis.");
  }
  if (c.status === "CLOSED" && user.role === "analyst") return deny("Hanya peninjau atau admin yang dapat membuka kembali kasus yang ditutup.");
  return ok;
}

const REPORT_NEXT: Record<ReportStatus, ReportStatus[]> = {
  draft: ["in_review"],
  in_review: ["approved", "draft"],
  approved: ["draft"],
  submitted: [],
};

export function canTransitionReport(
  user: SessionUser,
  report: Pick<ReportRecord, "status" | "createdBy" | "reviewerNotes">,
  caseStatus: CaseStatus,
  to: ReportStatus,
): Decision {
  if (to === "submitted") return deny("Gunakan langkah pengajuan untuk mencatat pengajuan laporan.");
  if (!REPORT_NEXT[report.status].includes(to)) return deny("Perubahan status laporan ini tidak diizinkan.");
  if (to === "in_review") {
    return can(user.role, "report:create") || can(user.role, "report:review")
      ? ok
      : deny("Peran Anda tidak dapat mengirim laporan untuk ditinjau.");
  }
  if (to === "approved") {
    if (!can(user.role, "report:review")) return deny("Hanya peninjau yang dapat menyetujui laporan.");
    if (user.id === report.createdBy) return deny("Anda tidak dapat menyetujui laporan yang Anda susun sendiri.");
    if (caseStatus !== "VERIFIED") return deny("Kasus harus berstatus Terverifikasi sebelum laporannya dapat disetujui.");
    if (!report.reviewerNotes.trim()) return deny("Isi catatan peninjau sebelum menyetujui.");
  }
  if (to === "draft" && !can(user.role, "report:review") && !can(user.role, "report:create")) {
    return deny("Peran Anda tidak dapat mengubah laporan.");
  }
  return ok;
}

export function canSubmitReport(
  user: SessionUser,
  report: Pick<ReportRecord, "status">,
  caseStatus: CaseStatus,
): Decision {
  if (!can(user.role, "report:submit")) return deny("Hanya peninjau yang dapat mencatat pengajuan.");
  if (report.status !== "approved") return deny("Hanya laporan yang sudah disetujui yang dapat diajukan.");
  if (caseStatus !== "VERIFIED") return deny("Kasus harus berstatus Terverifikasi.");
  return ok;
}
