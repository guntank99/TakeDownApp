import { describe, expect, it } from "vitest";
import type { ReportStatus, TakedownOutcome } from "@/types";
import { takedownProgress } from "./steps";

const report = (id: string, status: ReportStatus, outcome?: TakedownOutcome, createdAt = "2026-09-10T00:00:00Z") => ({
  id,
  status,
  createdAt,
  submission: status === "submitted" ? { platform: "x" as const, method: "official_page" as const, submittedAt: createdAt, submittedBy: "u", status: "SUBMITTED" as const, outcome } : null,
});

describe("takedownProgress", () => {
  it("starts with evidence, then reviewer verification", () => {
    expect(takedownProgress({ status: "OPEN" }, 0, []).stage).toBe("evidence");
    expect(takedownProgress({ status: "INVESTIGATING" }, 2, []).stage).toBe("verify");
    expect(takedownProgress({ status: "NEEDS_REVIEW" }, 2, []).stage).toBe("verify");
  });

  it("moves through the report stages only after the case is verified", () => {
    expect(takedownProgress({ status: "VERIFIED" }, 1, []).stage).toBe("report");
    expect(takedownProgress({ status: "VERIFIED" }, 1, [report("R1", "draft")])).toMatchObject({ stage: "report", reportId: "R1" });
    expect(takedownProgress({ status: "VERIFIED" }, 1, [report("R1", "in_review")]).stage).toBe("report");
    expect(takedownProgress({ status: "VERIFIED" }, 1, [report("R1", "approved")])).toMatchObject({ stage: "submit", reportId: "R1" });
  });

  it("after filing, waits for the platform and treats a missing outcome as pending", () => {
    expect(takedownProgress({ status: "REPORTED" }, 1, [report("R1", "submitted")]).stage).toBe("outcome");
    expect(takedownProgress({ status: "REPORTED" }, 1, [report("R1", "submitted", "pending")]).stage).toBe("outcome");
    expect(takedownProgress({ status: "REPORTED" }, 1, [report("R1", "submitted", "removed")]).stage).toBe("done");
    expect(takedownProgress({ status: "REPORTED" }, 1, [report("R1", "submitted", "rejected")]).index).toBe(5);
  });

  it("a newer open report after a filed one goes back to reporting", () => {
    const reports = [report("R1", "submitted", "rejected", "2026-09-01T00:00:00Z"), report("R2", "draft", undefined, "2026-09-15T00:00:00Z")];
    expect(takedownProgress({ status: "VERIFIED" }, 1, reports)).toMatchObject({ stage: "report", reportId: "R2" });
  });

  it("always explains what to do next", () => {
    for (const p of [takedownProgress({ status: "OPEN" }, 0, []), takedownProgress({ status: "REPORTED" }, 1, [report("R1", "submitted")])]) {
      expect(p.action.length).toBeGreaterThan(10);
    }
  });
});
