import "server-only";

import { getStore, nextId } from "@/lib/store";
import type { AuditAction, AuditLogEntry, SessionUser } from "@/types";

interface AuditInput {
  user: Pick<SessionUser, "id" | "name">;
  action: AuditAction;
  object: string;
  caseId?: string | null;
  result?: AuditLogEntry["result"];
}

/** Append-only audit trail. Never throws: auditing must not break the request. */
export function logAudit({ user, action, object, caseId = null, result = "SUCCESS" }: AuditInput): void {
  try {
    const store = getStore();
    store.audit.push({
      id: nextId("AUD", store.audit.map((a) => a.id), 4),
      at: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      action,
      object,
      caseId,
      result,
    });
  } catch (error) {
    console.error("audit log failed", error);
  }
}

export function listAudit(): AuditLogEntry[] {
  return [...getStore().audit].sort((a, b) => b.at.localeCompare(a.at));
}
