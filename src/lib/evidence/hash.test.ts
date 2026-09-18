import { describe, expect, it } from "vitest";
import type { EvidenceSnapshot } from "@/types";
import { hashSnapshot, verifyEvidenceIntegrity } from "./hash";

const snap: EvidenceSnapshot = {
  postId: "POST-001", accountHandle: "@a", platform: "x", text: "hello", postedAt: "2026-01-01T00:00:00Z",
  metrics: { likes: 1, comments: 2, shares: 3, views: 4 }, capturedFrom: "mock-dataset",
};

describe("evidence hashing", () => {
  it("is a 64-char SHA-256 hex and stable", () => {
    const h = hashSnapshot(snap);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSnapshot({ ...snap })).toBe(h);
  });

  it("does not depend on property order", () => {
    const reordered = { capturedFrom: snap.capturedFrom, metrics: snap.metrics, postedAt: snap.postedAt, text: snap.text, platform: snap.platform, accountHandle: snap.accountHandle, postId: snap.postId } as EvidenceSnapshot;
    expect(hashSnapshot(reordered)).toBe(hashSnapshot(snap));
  });

  it("detects tampering", () => {
    const hash = hashSnapshot(snap);
    expect(verifyEvidenceIntegrity({ snapshot: snap, hash })).toBe(true);
    expect(verifyEvidenceIntegrity({ snapshot: { ...snap, text: "hello!" }, hash })).toBe(false);
  });
});
