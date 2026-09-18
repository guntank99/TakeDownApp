import "server-only";

import { can } from "@/lib/auth/permissions";
import { CASE_STATUS_LABEL, PRIORITY_LABEL } from "@/lib/i18n/labels";
import { getProvider } from "@/lib/providers";
import { getStore, nextId } from "@/lib/store";
import { formatZodError, createCaseSchema, updateCaseSchema } from "@/lib/validation/schemas";
import { canTransitionCase } from "@/lib/workflow/rules";
import type { CaseRecord, CaseStatus, SessionUser } from "@/types";
import { logAudit } from "./audit";
import { failure, success, type Result } from "./result";

export function listCases(): CaseRecord[] {
  return [...getStore().cases].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getCase(id: string): CaseRecord | null {
  return getStore().cases.find((c) => c.id === id) ?? null;
}

function addTimeline(c: CaseRecord, actor: SessionUser, type: string, message: string) {
  const at = new Date().toISOString();
  c.timeline.push({ id: `TL-${c.timeline.length + 1}`, at, actorId: actor.id, type, message });
  c.updatedAt = at;
}

export async function createCase(user: SessionUser, raw: unknown): Promise<Result<CaseRecord>> {
  if (!can(user.role, "case:create")) {
    logAudit({ user, action: "CREATE_CASE", object: "case", result: "DENIED" });
    return failure("Peran Anda tidak dapat membuat kasus.", 403);
  }
  const parsed = createCaseSchema.safeParse(raw);
  if (!parsed.success) return failure(formatZodError(parsed.error));
  const input = parsed.data;

  const provider = getProvider();
  const posts = (await Promise.all(input.postIds.map((id) => provider.getPost(id)))).filter((p) => p !== null);
  if (posts.length !== input.postIds.length) return failure("Satu atau beberapa postingan tidak ditemukan.", 404);
  const accountIds = [...new Set([...input.accountIds, ...posts.map((p) => p.authorId)])];
  for (const a of accountIds) if (!(await provider.getAccount(a))) return failure(`Akun ${a} tidak ditemukan.`, 404);

  const store = getStore();
  const now = new Date().toISOString();
  const record: CaseRecord = {
    id: nextId("CASE", store.cases.map((c) => c.id)),
    title: input.title,
    description: input.description,
    platform: input.platform as CaseRecord["platform"],
    category: input.category,
    priority: input.priority,
    status: "OPEN",
    analystId: user.id,
    reviewerId: null,
    createdAt: now,
    updatedAt: now,
    postIds: posts.map((p) => p.id),
    accountIds,
    notes: [],
    timeline: [],
  };
  addTimeline(record, user, "CASE_CREATED", "Kasus dibuat");
  store.cases.push(record);
  logAudit({ user, action: "CREATE_CASE", object: record.id, caseId: record.id });
  return success(record);
}

export function transitionCase(user: SessionUser, id: string, to: CaseStatus): Result<CaseRecord> {
  const c = getCase(id);
  if (!c) return failure("Kasus tidak ditemukan.", 404);
  const decision = canTransitionCase(user, c, to);
  if (!decision.ok) {
    logAudit({ user, action: "UPDATE_CASE", object: `${id} → ${to}`, caseId: id, result: "DENIED" });
    return failure(decision.reason, 403);
  }
  const from = c.status;
  c.status = to;
  if (to === "VERIFIED") c.reviewerId = user.id;
  addTimeline(c, user, "STATUS_CHANGED", `Status diubah dari ${CASE_STATUS_LABEL[from]} menjadi ${CASE_STATUS_LABEL[to]}${to === "VERIFIED" ? " oleh peninjau" : ""}`);
  logAudit({ user, action: "UPDATE_CASE", object: `${id} → ${to}`, caseId: id });
  return success(c);
}

/** Applies a PATCH: status, priority, title/description, a note, or linking a post/account. */
export async function updateCase(user: SessionUser, id: string, raw: unknown): Promise<Result<CaseRecord>> {
  const c = getCase(id);
  if (!c) return failure("Kasus tidak ditemukan.", 404);
  if (!can(user.role, "case:update")) {
    logAudit({ user, action: "UPDATE_CASE", object: id, caseId: id, result: "DENIED" });
    return failure("Peran Anda tidak dapat memperbarui kasus.", 403);
  }
  const parsed = updateCaseSchema.safeParse(raw);
  if (!parsed.success) return failure(formatZodError(parsed.error));
  const u = parsed.data;
  const provider = getProvider();

  // Validate everything before mutating so a failed PATCH changes nothing.
  if (u.addPostId && !(await provider.getPost(u.addPostId))) return failure("Postingan tidak ditemukan.", 404);
  if (u.addAccountId && !(await provider.getAccount(u.addAccountId))) return failure("Akun tidak ditemukan.", 404);
  if (u.status && u.status !== c.status) {
    const d = canTransitionCase(user, c, u.status);
    if (!d.ok) {
      logAudit({ user, action: "UPDATE_CASE", object: `${id} → ${u.status}`, caseId: id, result: "DENIED" });
      return failure(d.reason, 403);
    }
  }

  const changes: string[] = [];
  if (u.title && u.title !== c.title) {
    c.title = u.title;
    changes.push("title");
  }
  if (u.description !== undefined && u.description !== c.description) {
    c.description = u.description;
    changes.push("description");
  }
  if (u.priority && u.priority !== c.priority) {
    addTimeline(c, user, "PRIORITY_CHANGED", `Prioritas diubah dari ${PRIORITY_LABEL[c.priority]} menjadi ${PRIORITY_LABEL[u.priority]}`);
    c.priority = u.priority;
    changes.push("priority");
  }
  if (u.addPostId && !c.postIds.includes(u.addPostId)) {
    c.postIds.push(u.addPostId);
    const post = await provider.getPost(u.addPostId);
    if (post && !c.accountIds.includes(post.authorId)) c.accountIds.push(post.authorId);
    addTimeline(c, user, "POST_ADDED", `Postingan ${u.addPostId} ditambahkan`);
    changes.push("post");
  }
  if (u.addAccountId && !c.accountIds.includes(u.addAccountId)) {
    c.accountIds.push(u.addAccountId);
    addTimeline(c, user, "ACCOUNT_ADDED", `Akun ${u.addAccountId} ditambahkan`);
    changes.push("account");
  }
  if (u.note) {
    c.notes.push({ id: `NOTE-${c.notes.length + 1}`, authorId: user.id, text: u.note, createdAt: new Date().toISOString() });
    addTimeline(c, user, "NOTE_ADDED", "Catatan ditambahkan");
    changes.push("note");
  }
  if (u.status && u.status !== c.status) {
    const t = transitionCase(user, id, u.status);
    if (!t.ok) return t;
    return success(c);
  }
  if (changes.length) {
    c.updatedAt = new Date().toISOString();
    logAudit({ user, action: "UPDATE_CASE", object: `${id} (${changes.join(", ")})`, caseId: id });
  }
  return success(c);
}
