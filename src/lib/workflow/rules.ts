import { can } from "@/lib/auth/permissions";
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
  if (!can(user.role, "case:update")) return deny("Your role cannot update cases.");
  if (to === "REPORTED") return deny("A case becomes REPORTED only when a report submission is recorded.");
  if (!NEXT[c.status].includes(to)) return deny(`Cannot move a case from ${c.status} to ${to}.`);
  if (to === "VERIFIED") {
    if (!can(user.role, "case:verify")) return deny("Only a reviewer can verify a case.");
    if (user.id === c.analystId) return deny("You cannot verify a case you are the analyst on.");
  }
  if (c.status === "CLOSED" && user.role === "analyst") return deny("Only a reviewer or admin can reopen a closed case.");
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
  if (to === "submitted") return deny("Use the submission step to record a submission.");
  if (!REPORT_NEXT[report.status].includes(to)) return deny(`Cannot move a report from ${report.status} to ${to}.`);
  if (to === "in_review") {
    return can(user.role, "report:create") || can(user.role, "report:review")
      ? ok
      : deny("Your role cannot send reports for review.");
  }
  if (to === "approved") {
    if (!can(user.role, "report:review")) return deny("Only a reviewer can approve a report.");
    if (user.id === report.createdBy) return deny("You cannot approve a report you prepared.");
    if (caseStatus !== "VERIFIED") return deny("The case must be VERIFIED before its report can be approved.");
    if (!report.reviewerNotes.trim()) return deny("Add reviewer notes before approving.");
  }
  if (to === "draft" && !can(user.role, "report:review") && !can(user.role, "report:create")) {
    return deny("Your role cannot edit reports.");
  }
  return ok;
}

export function canSubmitReport(
  user: SessionUser,
  report: Pick<ReportRecord, "status">,
  caseStatus: CaseStatus,
): Decision {
  if (!can(user.role, "report:submit")) return deny("Only a reviewer can record a submission.");
  if (report.status !== "approved") return deny("Only an approved report can be submitted.");
  if (caseStatus !== "VERIFIED") return deny("The case must be VERIFIED.");
  return ok;
}
