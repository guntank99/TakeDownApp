import { describe, expect, it } from "vitest";
import type { CaseStatus, Platform, TakedownOutcome } from "@/types";
import { summarizeTakedown } from "./summary";

const c = (id: string, platform: Platform, category: string, status: CaseStatus) => ({ id, platform, category: category as never, status });
const filed = (caseId: string, outcome?: TakedownOutcome) => ({
  caseId,
  status: "submitted" as const,
  submission: { platform: "x" as const, method: "official_page" as const, submittedAt: "t", submittedBy: "u", status: "SUBMITTED" as const, outcome },
});
const draft = (caseId: string) => ({ caseId, status: "draft" as const, submission: null });

describe("summarizeTakedown", () => {
  const cases = [c("C1", "x", "Spam", "OPEN"), c("C2", "x", "Fraud", "REPORTED"), c("C3", "youtube", "Fraud", "REPORTED"), c("C4", "youtube", "Spam", "CLOSED")];
  const reports = [filed("C2"), filed("C3", "removed"), draft("C1"), filed("C4", "rejected")];
  const s = summarizeTakedown(cases, reports);

  it("counts cases and reports for the overview cards", () => {
    expect(s).toMatchObject({ total: 4, open: 3, closed: 1, submitted: 3, underReview: 1, actionTaken: 1, rejected: 1 });
  });

  it("ignores drafts: only filed reports count as submitted", () => {
    expect(s.submitted).toBe(3);
  });

  it("breaks down by platform and by violation category", () => {
    expect(s.byPlatform.find((p) => p.platform === "x")).toEqual({ platform: "x", cases: 2, submitted: 1, underReview: 1, actionTaken: 0 });
    expect(s.byPlatform.find((p) => p.platform === "youtube")).toEqual({ platform: "youtube", cases: 2, submitted: 2, underReview: 0, actionTaken: 1 });
    expect(s.byCategory.find((k) => k.category === "Spam")).toEqual({ category: "Spam", cases: 2, open: 1, closed: 1 });
    expect(s.byCategory.find((k) => k.category === "Fraud")).toEqual({ category: "Fraud", cases: 2, open: 2, closed: 0 });
  });

  it("is all zeros for an empty workspace", () => {
    expect(summarizeTakedown([], [])).toMatchObject({ total: 0, open: 0, submitted: 0, byPlatform: [], byCategory: [] });
  });
});
