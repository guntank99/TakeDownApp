"use server";

import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/dal";
import { analyzeContent } from "@/lib/analysis/indicators";
import { logAudit } from "@/lib/services/audit";
import { createCase, updateCase } from "@/lib/services/cases";
import { createEvidence } from "@/lib/services/evidence";
import { createReport, submitReport, updateReport } from "@/lib/services/reports";
import { textSchema } from "@/lib/validation/schemas";
import type { ContentAnalysis } from "@/types";

/**
 * Server Actions for the forms in the app. Each one re-verifies the session
 * and delegates to a service that enforces role permissions, validation and
 * audit logging. Results come back to the page as ?notice= / ?error=.
 */

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

function back(path: string, kind: "notice" | "error", message: string): never {
  redirect(`${path}?${kind}=${encodeURIComponent(message)}`);
}

/** Only allow redirects back to our own pages. */
function safePath(p: string, fallback: string): string {
  return /^\/[a-z0-9/_-]*$/i.test(p) ? p : fallback;
}

export async function createCaseAction(formData: FormData) {
  const user = await verifySession();
  const result = await createCase(user, {
    title: str(formData, "title"),
    description: str(formData, "description"),
    platform: str(formData, "platform"),
    category: str(formData, "category"),
    priority: str(formData, "priority"),
    postIds: formData.getAll("postIds").flatMap((v) => String(v).split(/[\s,]+/)).filter(Boolean),
    accountIds: [],
  });
  if (!result.ok) back("/cases/new", "error", result.error);
  back(`/cases/${result.value.id}`, "notice", "Case created.");
}

export async function updateCaseAction(formData: FormData) {
  const user = await verifySession();
  const id = str(formData, "caseId");
  const path = `/cases/${encodeURIComponent(id)}`;
  const body: Record<string, string> = {};
  for (const key of ["status", "priority", "note", "addPostId", "addAccountId"]) {
    const v = str(formData, key);
    if (v) body[key] = v;
  }
  const result = await updateCase(user, id, body);
  if (!result.ok) back(safePath(str(formData, "returnTo"), path), "error", result.error);
  back(safePath(str(formData, "returnTo"), path), "notice", "Case updated.");
}

export async function createEvidenceAction(formData: FormData) {
  const user = await verifySession();
  const caseId = str(formData, "caseId");
  const result = await createEvidence(user, {
    caseId,
    postId: str(formData, "postId"),
    screenshotRef: str(formData, "screenshotRef") || undefined,
  });
  const path = `/cases/${encodeURIComponent(caseId)}`;
  if (!result.ok) back(path, "error", result.error);
  back(path, "notice", `Evidence ${result.value.id} captured and hashed.`);
}

export async function createReportAction(formData: FormData) {
  const user = await verifySession();
  const result = await createReport(user, { caseId: str(formData, "caseId") });
  if (!result.ok) back(`/cases/${encodeURIComponent(str(formData, "caseId"))}`, "error", result.error);
  back(`/reports/${result.value.id}`, "notice", "Draft report generated.");
}

export async function updateReportAction(formData: FormData) {
  const user = await verifySession();
  const id = str(formData, "reportId");
  const body: Record<string, string> = {};
  for (const key of ["status", "reviewerNotes", "recommendedAction"]) {
    if (formData.has(key)) body[key] = str(formData, key);
  }
  const result = await updateReport(user, id, body);
  const path = `/reports/${encodeURIComponent(id)}`;
  if (!result.ok) back(path, "error", result.error);
  back(path, "notice", "Report updated.");
}

export async function submitReportAction(formData: FormData) {
  const user = await verifySession();
  const id = str(formData, "reportId");
  const result = await submitReport(user, id, formData.get("confirmed") === "on");
  const path = `/reports/${encodeURIComponent(id)}`;
  if (!result.ok) back(path, "error", result.error);
  back(path, "notice", "Submission recorded. The case is now REPORTED.");
}

export interface AnalyzeState {
  error?: string;
  text?: string;
  analysis?: ContentAnalysis;
}

/** Manual text analysis for the /analysis tool. Logged as ANALYZE_POST. */
export async function analyzeTextAction(_prev: AnalyzeState, formData: FormData): Promise<AnalyzeState> {
  const user = await verifySession();
  const parsed = textSchema.safeParse({ text: str(formData, "text") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid text.", text: str(formData, "text") };
  logAudit({ user, action: "ANALYZE_POST", object: `manual text (${parsed.data.text.length} chars)` });
  return { text: parsed.data.text, analysis: analyzeContent(parsed.data.text) };
}
