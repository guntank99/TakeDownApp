import { describe, expect, it } from "vitest";
import type { CaseRecord, EvidenceFileMeta, EvidenceRecord, ReportRecord } from "@/types";
import { buildPackage, packageToMarkdown } from "./package";

const iso = "2026-09-19T10:00:00.000Z";
const c: CaseRecord = {
  id: "CASE-001", title: "Penipuan undian", description: "d", platform: "x", category: "Fraud", priority: "high", status: "REPORTED",
  analystId: "USR-002", reviewerId: "USR-003", createdAt: iso, updatedAt: iso, postIds: ["IMP-X-1"], accountIds: [], notes: [{ id: "N1", authorId: "USR-002", text: "catatan | dengan pipa", createdAt: iso }],
  timeline: [{ id: "TL-1", at: iso, actorId: "USR-002", type: "CASE_CREATED", message: "Kasus dibuat" }],
};
const report: ReportRecord = {
  id: "RPT-001", caseId: "CASE-001", title: "Laporan", status: "submitted", createdBy: "USR-002", createdAt: iso, updatedAt: iso,
  sections: [{ title: "Kecocokan kebijakan", body: ["Fraud: penipuan (aturan terverifikasi)"] }],
  reviewerNotes: "Bukti cukup.", recommendedAction: "Mohon ditinjau.", approvedBy: "USR-003",
  submission: { platform: "x", method: "official_page", submittedAt: iso, submittedBy: "USR-003", status: "SUBMITTED", outcome: "removed", outcomeNote: "tiket #123" },
};
const evidence = [{ id: "EVD-001", postId: "IMP-X-1", capturedAt: iso, hash: "a".repeat(64), source: "oembed:x" }] as EvidenceRecord[];
const files: EvidenceFileMeta[] = [{ id: "FIL-001", caseId: "CASE-001", filename: "layar|1.png", mime: "image/png", size: 10, sha256: "b".repeat(64), uploadedBy: "USR-002", uploadedAt: iso }];

describe("report package", () => {
  const pkg = buildPackage({ report, c, contentUrls: [{ postId: "IMP-X-1", url: "https://x.com/a/status/1" }], evidence, files, officialReportUrl: "https://help.x.com/en/safety-and-security/report-a-post", generatedAt: iso });

  it("carries every element of the package: ids, URLs, statement, policy basis, evidence, files, timeline, action, submission", () => {
    expect(pkg).toMatchObject({
      caseId: "CASE-001", reportId: "RPT-001", platform: "x", violationCategory: "Fraud", reporterStatement: "Bukti cukup.", requestedAction: "Mohon ditinjau.",
      policyBasis: ["Fraud: penipuan (aturan terverifikasi)"],
      submission: { outcome: "Konten dihapus", outcomeNote: "tiket #123" },
    });
    expect(pkg.evidenceInventory[0].sha256).toBe("a".repeat(64));
    expect(pkg.files[0].sha256).toBe("b".repeat(64));
    expect(pkg.timeline).toHaveLength(1);
  });

  it("says plainly that it is a request, not a guarantee", () => {
    expect(pkg.notice).toMatch(/bukan jaminan/i);
    expect(packageToMarkdown(pkg)).toContain("bukan jaminan");
  });

  it("markdown escapes table separators so untrusted text cannot break the layout", () => {
    const md = packageToMarkdown(pkg);
    expect(md).toContain("layar\\|1.png");
    expect(md).toContain("catatan \\| dengan pipa");
    expect(md).toMatch(/^# Paket Laporan RPT-001/);
  });

  it("an unsubmitted report reads 'belum diajukan' instead of inventing a result", () => {
    const draft = buildPackage({ report: { ...report, status: "draft", submission: null }, c, contentUrls: [], evidence: [], files: [], officialReportUrl: "", generatedAt: iso });
    expect(draft.submission).toMatchObject({ at: null, outcome: "belum diajukan" });
    expect(packageToMarkdown(draft)).toContain("(belum ada bukti)");
  });
});
