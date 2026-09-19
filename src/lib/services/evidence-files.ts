import "server-only";

import { rateLimit } from "@/lib/api/rate-limit";
import { can } from "@/lib/auth/permissions";
import { FILE_KINDS, MAX_FILE_BYTES, formatBytes, safeFilename, sha256Hex, sniffMime } from "@/lib/evidence/files";
import { getRepository } from "@/lib/store";
import type { EvidenceFileMeta, SessionUser } from "@/types";
import { logAudit } from "./audit";
import { addTimeline } from "./cases";
import { failure, success, type Result } from "./result";

/**
 * Screenshots, videos and documents attached to a case. The original bytes are
 * stored untouched, with their SHA-256, detected type and size, so any later
 * change is detectable. Nothing here re-encodes or resizes a file.
 */

export async function listCaseFiles(caseId: string): Promise<EvidenceFileMeta[]> {
  return (await (await getRepository()).listEvidenceFiles(caseId)).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function uploadEvidenceFile(
  user: SessionUser,
  caseId: string,
  file: { name: string; bytes: Uint8Array },
  note?: string,
): Promise<Result<EvidenceFileMeta>> {
  if (!can(user.role, "evidence:create")) {
    await logAudit({ user, action: "UPLOAD_EVIDENCE", object: "berkas", caseId, result: "DENIED" });
    return failure("Peran Anda tidak dapat mengunggah bukti.", 403);
  }
  const repo = await getRepository();
  const c = await repo.getCase(caseId);
  if (!c) return failure("Kasus tidak ditemukan.", 404);
  if (c.status === "CLOSED") return failure("Tidak dapat menambah bukti pada kasus yang sudah ditutup.", 409);

  if (file.bytes.length === 0) return failure("Berkas kosong.");
  if (file.bytes.length > MAX_FILE_BYTES) return failure(`Berkas terlalu besar (${formatBytes(file.bytes.length)}). Batas ${formatBytes(MAX_FILE_BYTES)}.`, 413);
  const mime = sniffMime(file.bytes);
  if (!mime) return failure("Jenis berkas tidak diizinkan. Yang diterima: gambar (PNG, JPEG, GIF, WebP), video (MP4, WebM), PDF, dan teks biasa.", 415);

  const limited = rateLimit(`upload:${user.id}`, 40, 60 * 60_000);
  if (!limited.ok) return failure(`Terlalu banyak unggahan. Coba lagi dalam ${Math.ceil(limited.retryAfter / 60)} menit.`, 429);

  const meta: EvidenceFileMeta = {
    id: await repo.newEvidenceFileId(),
    caseId,
    filename: safeFilename(file.name),
    mime,
    size: file.bytes.length,
    sha256: sha256Hex(file.bytes),
    uploadedBy: user.id,
    uploadedAt: new Date().toISOString(),
    note: note?.trim().slice(0, 500) || undefined,
  };
  await repo.saveEvidenceFile(meta, file.bytes);
  addTimeline(c, user, "FILE_UPLOADED", `Berkas ${meta.id} (${FILE_KINDS[mime]}, ${formatBytes(meta.size)}) diunggah`);
  await repo.saveCase(c);
  await logAudit({ user, action: "UPLOAD_EVIDENCE", object: `${meta.id} ${meta.filename} sha256:${meta.sha256.slice(0, 12)}…`, caseId });
  return success(meta);
}

/** Bytes plus a fresh integrity check against the hash recorded at upload. */
export async function readEvidenceFile(id: string): Promise<{ meta: EvidenceFileMeta; data: Uint8Array; intact: boolean } | null> {
  const found = await (await getRepository()).getEvidenceFile(id);
  return found ? { ...found, intact: sha256Hex(found.data) === found.meta.sha256 } : null;
}

export async function removeEvidenceFile(user: SessionUser, id: string): Promise<Result<true>> {
  const repo = await getRepository();
  const found = await repo.getEvidenceFile(id);
  if (!found) return failure("Berkas tidak ditemukan.", 404);
  const { meta } = found;
  const allowed = can(user.role, "settings:admin") || (can(user.role, "evidence:create") && meta.uploadedBy === user.id);
  if (!allowed) {
    await logAudit({ user, action: "DELETE_EVIDENCE", object: id, caseId: meta.caseId, result: "DENIED" });
    return failure("Hanya admin atau pengunggah yang dapat menghapus berkas ini.", 403);
  }
  const c = await repo.getCase(meta.caseId);
  if (c?.status === "CLOSED") return failure("Kasus sudah ditutup; berkasnya tidak dapat dihapus.", 409);

  await repo.deleteEvidenceFile(id);
  if (c) {
    addTimeline(c, user, "FILE_DELETED", `Berkas ${id} dihapus`);
    await repo.saveCase(c);
  }
  // The hash stays in the audit trail so the deletion is accountable without keeping the file.
  await logAudit({ user, action: "DELETE_EVIDENCE", object: `${id} ${meta.filename} sha256:${meta.sha256.slice(0, 12)}…`, caseId: meta.caseId });
  return success(true);
}
