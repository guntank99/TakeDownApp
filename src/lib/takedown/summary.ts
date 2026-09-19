import type { CaseRecord, Platform, ReportRecord } from "@/types";

/** Numbers for the Take Down dashboard. Pure: counts only, no judgement about anyone. */

export interface TakedownSummary {
  total: number;
  open: number;
  submitted: number;
  underReview: number;
  actionTaken: number;
  rejected: number;
  closed: number;
  byPlatform: { platform: Platform; cases: number; submitted: number; underReview: number; actionTaken: number }[];
  byCategory: { category: string; cases: number; open: number; closed: number }[];
}

type Filed = Pick<ReportRecord, "caseId" | "status" | "submission">;

const outcomeOf = (r: Filed) => r.submission?.outcome ?? "pending";

export function summarizeTakedown(cases: Pick<CaseRecord, "id" | "platform" | "category" | "status">[], reports: Filed[]): TakedownSummary {
  const filed = reports.filter((r) => r.status === "submitted");
  const filedFor = (caseId: string) => filed.filter((r) => r.caseId === caseId);
  const isOpen = (c: { status: string }) => c.status !== "CLOSED";

  const platforms = [...new Set(cases.map((c) => c.platform))];
  const categories = [...new Set(cases.map((c) => c.category))];

  return {
    total: cases.length,
    open: cases.filter(isOpen).length,
    submitted: filed.length,
    underReview: filed.filter((r) => outcomeOf(r) === "pending").length,
    actionTaken: filed.filter((r) => ["removed", "restricted"].includes(outcomeOf(r))).length,
    rejected: filed.filter((r) => outcomeOf(r) === "rejected").length,
    closed: cases.filter((c) => c.status === "CLOSED").length,
    byPlatform: platforms
      .map((platform) => {
        const own = cases.filter((c) => c.platform === platform);
        const reps = own.flatMap((c) => filedFor(c.id));
        return {
          platform,
          cases: own.length,
          submitted: reps.length,
          underReview: reps.filter((r) => outcomeOf(r) === "pending").length,
          actionTaken: reps.filter((r) => ["removed", "restricted"].includes(outcomeOf(r))).length,
        };
      })
      .sort((a, b) => b.cases - a.cases),
    byCategory: categories
      .map((category) => {
        const own = cases.filter((c) => c.category === category);
        return { category, cases: own.length, open: own.filter(isOpen).length, closed: own.filter((c) => !isOpen(c)).length };
      })
      .sort((a, b) => b.cases - a.cases),
  };
}
