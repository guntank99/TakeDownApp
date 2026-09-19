import { describe, expect, it } from "vitest";
import { assessReadiness, type ReadinessInput } from "./readiness";

const good: ReadinessInput = {
  urlCount: 2,
  urlsValid: true,
  platformKnown: true,
  categorySelected: true,
  evidenceCount: 2,
  evidenceIntact: true,
  policyMatches: 2,
  policyMatchesVerified: 1,
  description: "Akun ini menyebarkan tautan penipuan berkedok undian berhadiah.",
  reviewerNotes: "Bukti cukup: tangkapan dan hash tersimpan.",
  recommendedAction: "Mohon tinjau dan hapus bila melanggar kebijakan penipuan.",
  duplicateOf: null,
};

describe("assessReadiness", () => {
  it("a complete report is ready and scores 100", () => {
    const r = assessReadiness(good);
    expect(r.ready).toBe(true);
    expect(r.score).toBe(100);
    expect(r.blockers).toEqual([]);
    expect(r.checks.every((c) => c.status === "PASS")).toBe(true);
  });

  it("no evidence blocks filing and says why", () => {
    const r = assessReadiness({ ...good, evidenceCount: 0 });
    expect(r.ready).toBe(false);
    expect(r.checks.find((c) => c.key === "evidence")).toMatchObject({ status: "REVIEW", blocking: true });
    expect(r.lines.find((l) => l.label === "Bukti")!.score).toBe(0);
  });

  it("altered evidence blocks filing", () => {
    const r = assessReadiness({ ...good, evidenceIntact: false });
    expect(r.ready).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/hash/i);
  });

  it("a duplicate report is detected and blocks re-filing", () => {
    const r = assessReadiness({ ...good, duplicateOf: "RPT-001" });
    expect(r.ready).toBe(false);
    expect(r.blockers[0]).toMatch(/LAPORAN GANDA TERDETEKSI.*RPT-001/);
  });

  it("an unverified policy or thin description is advisory: REVIEW but not blocking, score reduced", () => {
    const r = assessReadiness({ ...good, policyMatchesVerified: 0, description: "singkat" });
    expect(r.ready).toBe(true);
    expect(r.checks.find((c) => c.key === "policy")).toMatchObject({ status: "REVIEW", blocking: false });
    expect(r.score).toBe(80);
  });

  it("a missing reviewer statement blocks filing", () => {
    const r = assessReadiness({ ...good, reviewerNotes: "  " });
    expect(r.ready).toBe(false);
    expect(r.checks.find((c) => c.key === "statement")?.blocking).toBe(true);
  });

  it("reporter authorization is confirmed at submission, never assumed blocking", () => {
    const r = assessReadiness({ ...good, urlCount: 0, urlsValid: false });
    expect(r.checks.find((c) => c.key === "authorization")).toMatchObject({ status: "PASS", blocking: false });
  });
});
