import "server-only";

import { rateLimit } from "@/lib/api/rate-limit";
import { can } from "@/lib/auth/permissions";
import { verifyEvidenceIntegrity } from "@/lib/evidence/hash";
import { assessReadiness, type Readiness } from "@/lib/takedown/readiness";
import { buildReportSections } from "@/lib/reports/content";
import { getRepository } from "@/lib/store";
import { TAKEDOWN_OUTCOME_LABEL } from "@/lib/i18n/labels";
import { PLATFORM_LABEL } from "@/lib/utils/platforms";
import { createReportSchema, formatZodError, updateReportSchema } from "@/lib/validation/schemas";
import { canSubmitReport, canTransitionReport } from "@/lib/workflow/rules";
import type { ReportRecord, SessionUser } from "@/types";
import { getAnalysisContext } from "./analysis";
import { logAudit } from "./audit";
import { addTimeline, getCase } from "./cases";
import { listEvidence } from "./evidence";
import { failure, success, type Result } from "./result";

const g = globalThis as unknown as { __tpReportSeed?: Promise<void> };

/** Demo seed reports store only metadata; their analytical sections are built once on first read. */
function ensureSeeded(): Promise<void> {
  return (g.__tpReportSeed ??= (async () => {
    const repo = await getRepository();
    const seeds = repo.takeReportSeeds?.() ?? [];
    if (seeds.length === 0) return;
    const ctx = await getAnalysisContext();
    for (const seed of seeds) {
      const c = await getCase(seed.caseId);
      if (!c) continue;
      await repo.saveReport({
        ...seed,
        createdAt: seed.createdAt ?? c.updatedAt,
        updatedAt: seed.updatedAt ?? c.updatedAt,
        sections: buildReportSections(c, ctx, await listEvidence(c.id)),
      });
    }
  })());
}

export async function listReports(): Promise<ReportRecord[]> {
  await ensureSeeded();
  const all = await (await getRepository()).listReports();
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getReport(id: string): Promise<ReportRecord | null> {
  await ensureSeeded();
  return (await getRepository()).getReport(id);
}

const isHttpUrl = (u: string) => {
  try {
    return ["http:", "https:"].includes(new URL(u).protocol);
  } catch {
    return false;
  }
};

/** Another report that already covers the same content and is not a closed-out rejection. */
async function findDuplicate(report: ReportRecord, postIds: string[]): Promise<string | null> {
  const repo = await getRepository();
  const cases = new Map((await repo.listCases()).map((c) => [c.id, c]));
  for (const other of await repo.listReports()) {
    if (other.id === report.id || other.status !== "submitted") continue;
    const outcome = other.submission?.outcome ?? "pending";
    if (outcome === "rejected" || outcome === "no_action") continue; // a decided refusal may be followed up
    const shared = cases.get(other.caseId)?.postIds.some((p) => postIds.includes(p));
    if (shared) return other.id;
  }
  return null;
}

/** Readiness of a report: what still needs a human before it can be filed. */
export async function getReadiness(report: ReportRecord): Promise<Readiness> {
  const c = await getCase(report.caseId);
  const ctx = await getAnalysisContext();
  const evidence = await listEvidence(report.caseId);
  const posts = (c?.postIds ?? []).map((id) => ctx.postById.get(id)).filter((p) => p !== undefined);
  const matches = posts.flatMap((p) => ctx.postAnalysis.get(p.id)?.policyMatches ?? []);
  return assessReadiness({
    urlCount: posts.length,
    urlsValid: posts.length > 0 && posts.every((p) => isHttpUrl(p.url)),
    platformKnown: Boolean(c?.platform),
    categorySelected: Boolean(c?.category),
    evidenceCount: evidence.length,
    evidenceIntact: evidence.every((e) => verifyEvidenceIntegrity(e)),
    policyMatches: matches.length,
    policyMatchesVerified: matches.filter((m) => m.ruleVerified).length,
    description: c?.description ?? "",
    reviewerNotes: report.reviewerNotes,
    recommendedAction: report.recommendedAction,
    duplicateOf: await findDuplicate(report, c?.postIds ?? []),
  });
}

export async function createReport(user: SessionUser, raw: unknown): Promise<Result<ReportRecord>> {
  if (!can(user.role, "report:create")) {
    await logAudit({ user, action: "GENERATE_REPORT", object: "report", result: "DENIED" });
    return failure("Peran Anda tidak dapat membuat laporan.", 403);
  }
  const parsed = createReportSchema.safeParse(raw);
  if (!parsed.success) return failure(formatZodError(parsed.error));
  const c = await getCase(parsed.data.caseId);
  if (!c) return failure("Kasus tidak ditemukan.", 404);
  if (c.status === "CLOSED") return failure("Tidak dapat membuat laporan untuk kasus yang sudah ditutup.", 409);

  const limited = rateLimit(`report:${user.id}`, 20, 60 * 60_000);
  if (!limited.ok) return failure(`RATE LIMIT REACHED: terlalu banyak laporan dibuat. Coba lagi dalam ${Math.ceil(limited.retryAfter / 60)} menit.`, 429);

  await ensureSeeded();
  const repo = await getRepository();
  // One open report per case keeps reporting deliberate: no piling up of duplicate reports.
  const open = (await repo.listReports()).find((r) => r.caseId === c.id && r.status !== "submitted");
  if (open) return failure(`Kasus ini sudah memiliki laporan yang belum diajukan (${open.id}). Selesaikan atau gunakan laporan itu.`, 409);

  const ctx = await getAnalysisContext();
  const now = new Date().toISOString();
  const record: ReportRecord = {
    id: await repo.newReportId(),
    caseId: c.id,
    title: `Laporan: ${c.title}`,
    status: "draft",
    createdBy: user.id,
    createdAt: now,
    updatedAt: now,
    sections: buildReportSections(c, ctx, await listEvidence(c.id)),
    reviewerNotes: "",
    recommendedAction: `Tinjau temuan, lalu ajukan laporan melalui mekanisme pelaporan resmi ${PLATFORM_LABEL[c.platform]}.`,
    approvedBy: null,
    submission: null,
  };
  await repo.saveReport(record);
  addTimeline(c, user, "REPORT_CREATED", `Laporan ${record.id} dibuat`);
  await repo.saveCase(c);
  await logAudit({ user, action: "GENERATE_REPORT", object: record.id, caseId: c.id });
  return success(record);
}

export async function updateReport(user: SessionUser, id: string, raw: unknown): Promise<Result<ReportRecord>> {
  const report = await getReport(id);
  if (!report) return failure("Laporan tidak ditemukan.", 404);
  const c = await getCase(report.caseId);
  if (!c) return failure("Kasus tidak ditemukan.", 404);
  if (report.status === "submitted") return failure("Laporan yang sudah diajukan tidak dapat diubah lagi.", 409);

  const parsed = updateReportSchema.safeParse(raw);
  if (!parsed.success) return failure(formatZodError(parsed.error));
  const u = parsed.data;
  const deny = async (reason: string) => {
    await logAudit({ user, action: "UPDATE_REPORT", object: id, caseId: c.id, result: "DENIED" });
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
  await (await getRepository()).saveReport(report);
  await logAudit({ user, action: "UPDATE_REPORT", object: `${id}${u.status ? ` → ${u.status}` : ""}`, caseId: c.id });
  return success(report);
}

/**
 * Records that a human filed this report through the platform's OFFICIAL
 * mechanism. The app never submits anything on its own. `confirmed` must be
 * true (the "Apakah Anda yakin ingin mengajukan laporan ini?" step).
 */
export async function submitReport(user: SessionUser, id: string, confirmed: boolean): Promise<Result<ReportRecord>> {
  const report = await getReport(id);
  if (!report) return failure("Laporan tidak ditemukan.", 404);
  const c = await getCase(report.caseId);
  if (!c) return failure("Kasus tidak ditemukan.", 404);

  const d = canSubmitReport(user, report, c.status);
  if (!d.ok) {
    await logAudit({ user, action: "SUBMIT_REPORT", object: id, caseId: c.id, result: "DENIED" });
    return failure(d.reason, 403);
  }
  if (!confirmed) return failure("Mohon konfirmasi pengajuan.", 400);

  // Quality gate: nothing is filed while a blocking check still needs a human.
  const readiness = await getReadiness(report);
  if (!readiness.ready) {
    await logAudit({ user, action: "SUBMIT_REPORT", object: `${id} ditolak: belum siap`, caseId: c.id, result: "DENIED" });
    return failure(`Laporan belum siap diajukan. ${readiness.blockers.join(" ")}`, 409);
  }
  const limited = rateLimit(`submit:${user.id}`, 10, 60 * 60_000);
  if (!limited.ok) return failure(`RATE LIMIT REACHED: terlalu banyak pengajuan. Coba lagi dalam ${Math.ceil(limited.retryAfter / 60)} menit.`, 429);

  const repo = await getRepository();
  const now = new Date().toISOString();
  report.status = "submitted";
  report.updatedAt = now;
  report.submission = { platform: c.platform, method: "official_page", submittedAt: now, submittedBy: user.id, status: "SUBMITTED", outcome: "pending" };
  c.status = "REPORTED";
  addTimeline(c, user, "REPORT_SUBMITTED", `Laporan ${id} dicatat sudah diajukan melalui halaman pelaporan resmi`);
  await repo.saveReport(report);
  await repo.saveCase(c);
  await logAudit({ user, action: "SUBMIT_REPORT", object: id, caseId: c.id });
  return success(report);
}

const OUTCOMES = ["pending", "removed", "restricted", "rejected", "no_action"] as const;

/**
 * Records what the platform decided after a human filed the report. Entered by
 * a person from the platform's own reply or from checking the content; the app
 * never infers or fakes an outcome.
 */
export async function recordOutcome(user: SessionUser, id: string, raw: { outcome: string; note?: string }): Promise<Result<ReportRecord>> {
  if (!can(user.role, "report:submit")) {
    await logAudit({ user, action: "RECORD_OUTCOME", object: id, result: "DENIED" });
    return failure("Hanya peninjau atau admin yang dapat mencatat hasil take down.", 403);
  }
  const outcome = OUTCOMES.find((o) => o === raw.outcome);
  if (!outcome) return failure("Hasil tidak dikenal.");
  const note = (raw.note ?? "").trim().slice(0, 1000);

  const report = await getReport(id);
  if (!report) return failure("Laporan tidak ditemukan.", 404);
  if (!report.submission) return failure("Hasil hanya dapat dicatat setelah laporan diajukan.", 409);

  report.submission = { ...report.submission, outcome, outcomeNote: note || undefined, outcomeAt: new Date().toISOString(), outcomeBy: user.id };
  report.updatedAt = report.submission.outcomeAt!;
  const repo = await getRepository();
  await repo.saveReport(report);

  const c = await getCase(report.caseId);
  if (c) {
    addTimeline(c, user, "TAKEDOWN_OUTCOME", `Hasil pengajuan ${id} dicatat: ${TAKEDOWN_OUTCOME_LABEL[outcome]}`);
    await repo.saveCase(c);
  }
  await logAudit({ user, action: "RECORD_OUTCOME", object: `${id} → ${outcome}`, caseId: report.caseId });
  return success(report);
}
