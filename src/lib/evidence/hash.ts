import { createHash } from "node:crypto";
import type { EvidenceRecord, EvidenceSnapshot } from "@/types";

/**
 * Canonical JSON with a fixed key order, so the same snapshot always hashes
 * to the same value regardless of how the object was constructed.
 */
export function canonicalSnapshot(s: EvidenceSnapshot): string {
  return JSON.stringify({
    postId: s.postId,
    accountHandle: s.accountHandle,
    platform: s.platform,
    text: s.text,
    postedAt: s.postedAt,
    metrics: s.metrics && {
      likes: s.metrics.likes,
      comments: s.metrics.comments,
      shares: s.metrics.shares,
      views: s.metrics.views,
    },
    capturedFrom: s.capturedFrom,
  });
}

export function hashSnapshot(s: EvidenceSnapshot): string {
  return createHash("sha256").update(canonicalSnapshot(s)).digest("hex");
}

/** Re-computes the hash; false means the stored snapshot changed after capture. */
export function verifyEvidenceIntegrity(e: Pick<EvidenceRecord, "snapshot" | "hash">): boolean {
  return hashSnapshot(e.snapshot) === e.hash;
}
