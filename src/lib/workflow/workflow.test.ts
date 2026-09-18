import { describe, expect, it } from "vitest";
import type { Role, SessionUser } from "@/types";
import { can } from "../auth/permissions";
import { allowedNextStatuses, canSubmitReport, canTransitionCase, canTransitionReport } from "./rules";

const user = (role: Role, id: string = role): SessionUser => ({ id, username: role, name: role, role });
const analyst = user("analyst", "USR-002");
const reviewer = user("reviewer", "USR-003");
const admin = user("admin", "USR-001");
const theCase = (status: "OPEN" | "INVESTIGATING" | "NEEDS_REVIEW" | "VERIFIED" | "REPORTED" | "CLOSED") => ({ status, analystId: "USR-002" });

describe("permissions", () => {
  it("matches the role model", () => {
    expect(can("analyst", "case:create")).toBe(true);
    expect(can("analyst", "case:verify")).toBe(false);
    expect(can("reviewer", "report:submit")).toBe(true);
    expect(can("reviewer", "case:create")).toBe(false);
    expect(can("analyst", "audit:read")).toBe(false);
    expect(can("admin", "settings:admin")).toBe(true);
  });
});

describe("case transitions", () => {
  it("lets an analyst progress a case but not verify it", () => {
    expect(canTransitionCase(analyst, theCase("OPEN"), "INVESTIGATING").ok).toBe(true);
    expect(canTransitionCase(analyst, theCase("INVESTIGATING"), "NEEDS_REVIEW").ok).toBe(true);
    const r = canTransitionCase(analyst, theCase("NEEDS_REVIEW"), "VERIFIED");
    expect(r.ok).toBe(false);
  });

  it("lets a different reviewer verify, but not the case's own analyst", () => {
    expect(canTransitionCase(reviewer, theCase("NEEDS_REVIEW"), "VERIFIED").ok).toBe(true);
    const self = user("reviewer", "USR-002"); // reviewer role, but is the analyst on the case
    const r = canTransitionCase(self, theCase("NEEDS_REVIEW"), "VERIFIED");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/analis/);
  });

  it("never allows a manual move to REPORTED or skipping steps", () => {
    expect(canTransitionCase(admin, theCase("VERIFIED"), "REPORTED").ok).toBe(false);
    expect(canTransitionCase(analyst, theCase("OPEN"), "VERIFIED").ok).toBe(false);
    expect(allowedNextStatuses("OPEN")).not.toContain("VERIFIED");
  });

  it("only reviewer/admin can reopen a closed case", () => {
    expect(canTransitionCase(analyst, theCase("CLOSED"), "OPEN").ok).toBe(false);
    expect(canTransitionCase(reviewer, theCase("CLOSED"), "OPEN").ok).toBe(true);
  });
});

describe("report workflow", () => {
  const draft = { status: "draft" as const, createdBy: "USR-002", reviewerNotes: "" };
  const inReview = { status: "in_review" as const, createdBy: "USR-002", reviewerNotes: "Looks consistent." };

  it("analyst sends for review; only a reviewer approves", () => {
    expect(canTransitionReport(analyst, draft, "VERIFIED", "in_review").ok).toBe(true);
    expect(canTransitionReport(analyst, inReview, "VERIFIED", "approved").ok).toBe(false);
    expect(canTransitionReport(reviewer, inReview, "VERIFIED", "approved").ok).toBe(true);
  });

  it("requires a verified case, reviewer notes and four-eyes for approval", () => {
    expect(canTransitionReport(reviewer, inReview, "NEEDS_REVIEW", "approved").ok).toBe(false);
    expect(canTransitionReport(reviewer, { ...inReview, reviewerNotes: " " }, "VERIFIED", "approved").ok).toBe(false);
    expect(canTransitionReport(user("reviewer", "USR-002"), inReview, "VERIFIED", "approved").ok).toBe(false);
  });

  it("submission needs an approved report, verified case and reviewer role", () => {
    const approved = { status: "approved" as const };
    expect(canSubmitReport(reviewer, approved, "VERIFIED").ok).toBe(true);
    expect(canSubmitReport(analyst, approved, "VERIFIED").ok).toBe(false);
    expect(canSubmitReport(reviewer, { status: "in_review" }, "VERIFIED").ok).toBe(false);
    expect(canSubmitReport(reviewer, approved, "OPEN").ok).toBe(false);
  });

  it("cannot mark submitted via a plain status change", () => {
    expect(canTransitionReport(reviewer, { ...inReview, status: "approved" }, "VERIFIED", "submitted").ok).toBe(false);
  });
});
