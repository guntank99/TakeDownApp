import "server-only";

import { can } from "@/lib/auth/permissions";
import { hashSnapshot, verifyEvidenceIntegrity } from "@/lib/evidence/hash";
import { getProvider } from "@/lib/providers";
import { getStore, nextId } from "@/lib/store";
import { createEvidenceSchema, formatZodError } from "@/lib/validation/schemas";
import type { EvidenceRecord, SessionUser } from "@/types";
import { logAudit } from "./audit";
import { getCase } from "./cases";
import { failure, success, type Result } from "./result";

export function listEvidence(caseId?: string): EvidenceRecord[] {
  const all = getStore().evidence;
  return (caseId ? all.filter((e) => e.caseId === caseId) : [...all]).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}

export function getEvidence(id: string): EvidenceRecord | null {
  return getStore().evidence.find((e) => e.id === id) ?? null;
}

export const evidenceIntegrity = (e: EvidenceRecord) => verifyEvidenceIntegrity(e);

/**
 * Preserves a post as evidence: a content snapshot taken from the provider
 * (never typed in by hand) plus its SHA-256 hash for later integrity checks.
 */
export async function createEvidence(user: SessionUser, raw: unknown): Promise<Result<EvidenceRecord>> {
  if (!can(user.role, "evidence:create")) {
    logAudit({ user, action: "CREATE_EVIDENCE", object: "evidence", result: "DENIED" });
    return failure("Peran Anda tidak dapat membuat bukti.", 403);
  }
  const parsed = createEvidenceSchema.safeParse(raw);
  if (!parsed.success) return failure(formatZodError(parsed.error));
  const { caseId, postId, screenshotRef } = parsed.data;

  const c = getCase(caseId);
  if (!c) return failure("Kasus tidak ditemukan.", 404);
  if (c.status === "CLOSED") return failure("Tidak dapat menambah bukti pada kasus yang sudah ditutup.", 409);

  const provider = getProvider();
  const post = await provider.getPost(postId);
  if (!post) return failure("Postingan tidak ditemukan.", 404);
  const author = await provider.getAccount(post.authorId);

  const store = getStore();
  const snapshot = {
    postId: post.id,
    accountHandle: author?.handle ?? null,
    platform: post.platform,
    text: post.text,
    postedAt: post.createdAt,
    metrics: { likes: post.likes, comments: post.comments, shares: post.shares, views: post.views },
    capturedFrom: post.provenance.source,
  };
  const record: EvidenceRecord = {
    id: nextId("EVD", store.evidence.map((e) => e.id)),
    caseId,
    url: post.url,
    postId: post.id,
    accountId: post.authorId,
    capturedAt: new Date().toISOString(),
    screenshotRef: screenshotRef || null,
    snapshot,
    hash: hashSnapshot(snapshot),
    source: post.provenance.source,
    collectedBy: user.id,
  };
  store.evidence.push(record);

  const now = record.capturedAt;
  c.timeline.push({ id: `TL-${c.timeline.length + 1}`, at: now, actorId: user.id, type: "EVIDENCE_ADDED", message: `Bukti ${record.id} diambil dari ${post.id}` });
  c.updatedAt = now;
  logAudit({ user, action: "CREATE_EVIDENCE", object: record.id, caseId });
  return success(record);
}
