"use server";

import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/dal";
import { analyzeContent } from "@/lib/analysis/indicators";
import { logAudit } from "@/lib/services/audit";
import { createCase, updateCase } from "@/lib/services/cases";
import { createEvidence } from "@/lib/services/evidence";
import { removeEvidenceFile, uploadEvidenceFile } from "@/lib/services/evidence-files";
import { deleteCaseCascade } from "@/lib/services/retention";
import { adapterForUrl } from "@/lib/adapters";
import { explainUnsupported, parsePostUrl } from "@/lib/embed/parse";
import { checkPostAvailability, deleteImportedPost, importPost, importedPostId } from "@/lib/services/imports";
import { getRepository } from "@/lib/store";
import { createReport, recordOutcome, submitReport, updateReport } from "@/lib/services/reports";
import { changeOwnPassword, createUser, resetPassword, updateUser } from "@/lib/services/users";
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
  back(`/cases/${result.value.id}`, "notice", "Kasus dibuat.");
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
  back(safePath(str(formData, "returnTo"), path), "notice", "Kasus diperbarui.");
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
  back(path, "notice", `Bukti ${result.value.id} diambil dan di-hash.`);
}

export async function createReportAction(formData: FormData) {
  const user = await verifySession();
  const result = await createReport(user, { caseId: str(formData, "caseId") });
  if (!result.ok) back(`/cases/${encodeURIComponent(str(formData, "caseId"))}`, "error", result.error);
  back(`/reports/${result.value.id}`, "notice", "Draf laporan dibuat.");
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
  back(path, "notice", "Laporan diperbarui.");
}

export async function submitReportAction(formData: FormData) {
  const user = await verifySession();
  const id = str(formData, "reportId");
  const result = await submitReport(user, id, formData.get("confirmed") === "on");
  const path = `/reports/${encodeURIComponent(id)}`;
  if (!result.ok) back(path, "error", result.error);
  back(path, "notice", "Pengajuan tercatat. Kasus kini berstatus Sudah dilaporkan.");
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
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Teks tidak valid.", text: str(formData, "text") };
  await logAudit({ user, action: "ANALYZE_POST", object: `analisis teks manual (${parsed.data.text.length} karakter)` });
  return { text: parsed.data.text, analysis: analyzeContent(parsed.data.text) };
}

// ------------------------------------------------------------ links & viewing

export async function importPostAction(formData: FormData) {
  const user = await verifySession();
  const returnTo = safePath(str(formData, "returnTo"), "/video");
  const body: Record<string, string> = {};
  for (const key of ["url", "caption", "note", "views", "likes", "comments", "shares", "postedAt"]) {
    const v = str(formData, key);
    if (v) body[key] = v;
  }
  const result = await importPost(user, body);
  if (!result.ok) back(returnTo, "error", result.error);
  back(returnTo, "notice", `Postingan ditambahkan: ${result.value.id}. Klik pemutar untuk menontonnya.`);
}

export async function deletePostAction(formData: FormData) {
  const user = await verifySession();
  const id = str(formData, "postId");
  const result = await deleteImportedPost(user, id);
  if (!result.ok) back(`/posts/${encodeURIComponent(id)}`, "error", result.error);
  back("/video", "notice", `Tautan ${id} dihapus dari ruang kerja.`);
}

export async function checkAvailabilityAction(formData: FormData) {
  const user = await verifySession();
  const id = str(formData, "postId");
  const path = `/posts/${encodeURIComponent(id)}`;
  const result = await checkPostAvailability(user, id);
  if (!result.ok) back(path, "error", result.error);
  const { status, supported } = result.value;
  if (!supported) back(path, "notice", "Platform ini tidak menyediakan pengecekan otomatis. Buka tautan asli di peramban untuk memastikan.");
  const text = { available: "Konten masih dapat diakses menurut platform.", unavailable: "Platform tidak menemukan konten ini (mungkin sudah dihapus, dibuat privat, atau tidak dapat disematkan). Pastikan dengan membuka tautan asli.", unknown: "Status tidak dapat dipastikan saat ini (gangguan jaringan atau platform). Coba lagi nanti." }[status];
  back(path, "notice", text);
}

export async function recordOutcomeAction(formData: FormData) {
  const user = await verifySession();
  const id = str(formData, "reportId");
  const result = await recordOutcome(user, id, { outcome: str(formData, "outcome"), note: str(formData, "note") });
  const path = `/reports/${encodeURIComponent(id)}`;
  if (!result.ok) back(path, "error", result.error);
  back(path, "notice", "Hasil dari platform dicatat.");
}

// -------------------------------------------------------------------- users

export async function createUserAction(formData: FormData) {
  const user = await verifySession();
  const result = await createUser(user, {
    username: str(formData, "username"),
    email: str(formData, "email"),
    name: str(formData, "name"),
    role: str(formData, "role"),
    password: String(formData.get("password") ?? ""),
  });
  if (!result.ok) back("/users", "error", result.error);
  back("/users", "notice", `Pengguna ${result.value.username} dibuat.`);
}

export async function updateUserAction(formData: FormData) {
  const user = await verifySession();
  const id = str(formData, "userId");
  const body: { role?: string; active?: boolean } = {};
  if (formData.has("role")) body.role = str(formData, "role");
  if (formData.has("active")) body.active = str(formData, "active") === "true";
  const result = await updateUser(user, id, body);
  if (!result.ok) back("/users", "error", result.error);
  back("/users", "notice", "Pengguna diperbarui.");
}

export async function resetPasswordAction(formData: FormData) {
  const user = await verifySession();
  const result = await resetPassword(user, str(formData, "userId"), String(formData.get("password") ?? ""));
  if (!result.ok) back("/users", "error", result.error);
  back("/users", "notice", "Kata sandi diganti. Sampaikan kata sandi baru melalui saluran yang aman.");
}

export async function changePasswordAction(formData: FormData) {
  const user = await verifySession();
  const next = String(formData.get("next") ?? "");
  if (next !== String(formData.get("confirm") ?? "")) back("/settings", "error", "Konfirmasi kata sandi tidak sama.");
  const result = await changeOwnPassword(user, String(formData.get("current") ?? ""), next);
  if (!result.ok) back("/settings", "error", result.error);
  back("/settings", "notice", "Kata sandi diganti.");
}

// ----------------------------------------------------------- files & retention

export async function uploadEvidenceFileAction(formData: FormData) {
  const user = await verifySession();
  const caseId = str(formData, "caseId");
  const path = `/cases/${encodeURIComponent(caseId)}`;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) back(path, "error", "Pilih berkas terlebih dahulu.");
  const result = await uploadEvidenceFile(user, caseId, { name: (file as File).name, bytes: new Uint8Array(await (file as File).arrayBuffer()) }, str(formData, "note"));
  if (!result.ok) back(path, "error", result.error);
  back(path, "notice", `Berkas ${result.value.id} diunggah. SHA-256: ${result.value.sha256.slice(0, 16)}…`);
}

export async function deleteEvidenceFileAction(formData: FormData) {
  const user = await verifySession();
  const caseId = str(formData, "caseId");
  const path = `/cases/${encodeURIComponent(caseId)}`;
  const result = await removeEvidenceFile(user, str(formData, "fileId"));
  if (!result.ok) back(path, "error", result.error);
  back(path, "notice", "Berkas dihapus. Hash-nya tetap tercatat di riwayat aktivitas.");
}

export async function deleteCaseAction(formData: FormData) {
  const user = await verifySession();
  const caseId = str(formData, "caseId");
  const result = await deleteCaseCascade(user, caseId, str(formData, "confirm"));
  if (!result.ok) back(`/cases/${encodeURIComponent(caseId)}`, "error", result.error);
  back("/cases", "notice", `Kasus ${caseId} dihapus beserta ${result.value.evidence} bukti, ${result.value.files} berkas, dan ${result.value.reports} laporan.`);
}

/**
 * "Mulai dari URL": validate the link with the platform's adapter, collect it
 * (or reuse it if it is already in the workspace), then open the case form.
 * Nothing is reported here; this only starts the human workflow.
 */
export async function startTakedownAction(formData: FormData) {
  const user = await verifySession();
  const url = str(formData, "url");
  if (!adapterForUrl(url)) back("/takedown", "error", explainUnsupported(url));
  const parsed = parsePostUrl(url)!;
  const id = importedPostId(parsed);
  const repo = await getRepository();
  if (!(await repo.getImported(id))) {
    const result = await importPost(user, { url });
    if (!result.ok) back("/takedown", "error", result.error);
  }
  redirect(`/cases/new?post=${encodeURIComponent(id)}`);
}
