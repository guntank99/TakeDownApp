import "server-only";

import { can } from "@/lib/auth/permissions";
import { buildReportSections } from "@/lib/reports/content";
import { getStore, nextId } from "@/lib/store";
import { PLATFORM_LABEL } from "@/lib/utils/platforms";
import { createReportSchema, formatZodError, updateReportSchema } from "@/lib/validation/schemas";
import { canSubmitReport, canTransitionReport } from "@/lib/workflow/rules";
import type { ReportRecord, SessionUser } from "@/types";
import { getAnalysisContext } from "./analysis";
import { logAudit } from "./audit";
import { getCase } from "./cases";
import { listEvidence } from "./evidence";
import { failure, success, type Result } from "./result";

const g = globalThis as unknown as { __sentinelReportSeed?: Promise<void> };

/** Seed reports store only metadata; their analytical sections are built once on first read. */
function ensureSeeded(): Promise<void> {
  return (g.__sentinelReportSeed ??= (async () => {
    const store = getStore();
    const ctx = await getAnalysisContext();
    for (const seed of store.reportSeeds.splice(0)) {
      const c = getCase(seed.caseId);
      if (!c) continue;
      store.reports.push({
        ...seed,
        createdAt: seed.createdAt ?? c.updatedAt,
        updatedAt: seed.updatedAt ?? c.updatedAt,
        sections: buildReportSections(c, ctx, listEvidence(c.id)),
      });
    }
  })());
}

export async function listReports(): Promise<ReportRecord[]> {
  await ensureSeeded();
  return [...getStore().reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getReport(id: string): Promise<ReportRecord | null> {
  await ensureSeeded();
  return getStore().reports.find((r) => r.id === id) ?? null;
}

export async function createReport(user: SessionUser, raw: unknown): Promise<Result<ReportRecord>> {
  if (!can(user.role, "report:create")) {
    logAudit({ user, action: "GENERATE_REPORT", object: "report", result: "DENIED" });
    return failure("Peran Anda tidak dapat membuat laporan.", 403);
  }
  const parsed = createReportSchema.safeParse(raw);
  if (!parsed.success) return failure(formatZodError(parsed.error));
  const c = getCase(parsed.data.caseId);
  if (!c) return failure("Kasus tidak ditemukan.", 404);
  if (c.status === "CLOSED") return failure("Tidak dapat membuat laporan untuk kasus yang sudah ditutup.", 409);

  await ensureSeeded();
  const ctx = await getAnalysisContext();
  const store = getStore();
  const now = new Date().toISOString();
  const record: ReportRecord = {
    id: nextId("RPT", store.reports.map((r) => r.id)),
    caseId: c.id,
    title: `Laporan: ${c.title}`,
    status: "draft",
    createdBy: user.id,
    createdAt: now,
    updatedAt: now,
    sections: buildReportSections(c, ctx, listEvidence(c.id)),
    reviewerNotes: "",
    recommendedAction: `Tinjau temuan, lalu ajukan laporan melalui mekanisme pelaporan resmi ${PLATFORM_LABEL[c.platform]}.`,
    approvedBy: null,
    submission: null,
  };
  store.reports.push(record);
  c.timeline.push({ id: `TL-${c.timeline.length + 1}`, at: now, actorId: user.id, type: "REPORT_CREATED", message: `Laporan ${record.id} dibuat` });
  c.updatedAt = now;
  logAudit({ user, action: "GENERATE_REPORT", object: record.id, caseId: c.id });
  return success(record);
}

export async function updateReport(user: SessionUser, id: string, raw: unknown): Promise<Result<ReportRecord>> {
  const report = await getReport(id);
  if (!report) return failure("Laporan tidak ditemukan.", 404);
  const c = getCase(report.caseId);
  if (!c) return failure("Kasus tidak ditemukan.", 404);
  if (report.status === "submitted") return failure("Laporan yang sudah diajukan tidak dapat diubah lagi.", 409);

  const parsed = updateReportSchema.safeParse(raw);
  if (!parsed.success) return failure(formatZodError(parsed.error));
  const u = parsed.data;
  const deny = (reason: string) => {
    logAudit({ user, action: "UPDATE_REPORT", object: id, caseId: c.id, result: "DENIED" });
    return failure(reason, 403);
  };

  if (u.reviewerNotes !== undefined && !can(user.role, "report:review")) return deny("Hanya peninjau yang dapat menulis catatan peninjau.");
  if (u.recommendedAction !== undefined && !can(user.role, "report:create") && !can(user.role, "report:review")) return deny("Peran Anda tidak dapat mengubah kolom ini.");

  // Apply text edits first so an approval in the same request sees the new notes.
  const draftState = { ...report, reviewerNotes: u.reviewerNotes ?? report.reviewerNotes };
  if (u.status && u.status !== report.status) {
    const d = canTransitionReport(user, draftState, c.status, u.status);
    if (!d.ok) return deny(d.reason);
  }

  if (u.reviewerNotes !== undefined) report.reviewerNotes = u.reviewerNotes;
  if (u.recommendedAction !== undefined) report.recommendedAction = u.recommendedAction;
  if (u.status && u.status !== report.status) {
    report.status = u.status;
    report.approvedBy = u.status === "approved" ? user.id : null;
  }
  report.updatedAt = new Date().toISOString();
  logAudit({ user, action: "UPDATE_REPORT", object: `${id}${u.status ? ` → ${u.status}` : ""}`, caseId: c.id });
  return success(report);
}

/**
 * Records that a human filed this report through the platform's OFFICIAL
 * mechanism. The app never submits anything on its own. `confirmed` must be
 * true (the "Are you sure you want to submit this report?" step).
 */
export async function submitReport(user: SessionUser, id: string, confirmed: boolean): Promise<Result<ReportRecord>> {
  const report = await getReport(id);
  if (!report) return failure("Laporan tidak ditemukan.", 404);
  const c = getCase(report.caseId);
  if (!c) return failure("Kasus tidak ditemukan.", 404);

  const d = canSubmitReport(user, report, c.status);
  if (!d.ok) {
    logAudit({ user, action: "SUBMIT_REPORT", object: id, caseId: c.id, result: "DENIED" });
    return failure(d.reason, 403);
  }
  if (!confirmed) return failure("Mohon konfirmasi pengajuan.", 400);

  const now = new Date().toISOString();
  report.status = "submitted";
  report.updatedAt = now;
  report.submission = { platform: c.platform, method: "official_page", submittedAt: now, submittedBy: user.id, status: "SUBMITTED" };
  c.status = "REPORTED";
  c.timeline.push({ id: `TL-${c.timeline.length + 1}`, at: now, actorId: user.id, type: "REPORT_SUBMITTED", message: `Laporan ${id} dicatat sudah diajukan melalui halaman pelaporan resmi` });
  c.updatedAt = now;
  logAudit({ user, action: "SUBMIT_REPORT", object: id, caseId: c.id });
  return success(report);
}
