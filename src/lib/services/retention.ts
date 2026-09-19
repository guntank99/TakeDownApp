import "server-only";

import { can } from "@/lib/auth/permissions";
import { getRepository } from "@/lib/store";
import type { SessionUser } from "@/types";
import { logAudit } from "./audit";
import { failure, success, type Result } from "./result";

/**
 * DELETE CASE (privacy / retention). Evidence can contain personal data, so a
 * finished case must be removable together with everything attached to it.
 *
 * Safeguards: administrators only, the case must already be CLOSED, and the
 * caller must type the case id. The audit trail keeps a record that the case
 * existed and was deleted (id, counts, who, when), but none of its contents.
 */
export async function deleteCaseCascade(user: SessionUser, caseId: string, confirmation: string): Promise<Result<{ evidence: number; files: number; reports: number }>> {
  if (!can(user.role, "settings:admin")) {
    await logAudit({ user, action: "DELETE_CASE", object: caseId, result: "DENIED" });
    return failure("Hanya administrator yang dapat menghapus kasus.", 403);
  }
  const repo = await getRepository();
  const c = await repo.getCase(caseId);
  if (!c) return failure("Kasus tidak ditemukan.", 404);
  if (c.status !== "CLOSED") return failure("Tutup kasus terlebih dahulu sebelum menghapusnya.", 409);
  if (confirmation.trim() !== caseId) return failure(`Ketik ID kasus (${caseId}) persis untuk mengonfirmasi penghapusan.`, 400);

  const evidence = await repo.listEvidence(caseId);
  const files = await repo.listEvidenceFiles(caseId);
  const reports = (await repo.listReports()).filter((r) => r.caseId === caseId);

  for (const f of files) await repo.deleteEvidenceFile(f.id);
  for (const e of evidence) await repo.deleteEvidence(e.id);
  for (const r of reports) await repo.deleteReport(r.id);
  await repo.deleteCase(caseId);

  await logAudit({
    user,
    action: "DELETE_CASE",
    object: `${caseId} dihapus (${evidence.length} bukti, ${files.length} berkas, ${reports.length} laporan)`,
  });
  return success({ evidence: evidence.length, files: files.length, reports: reports.length });
}
