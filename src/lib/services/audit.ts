import "server-only";

import { can } from "@/lib/auth/permissions";
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

/** Everything, newest first. Use listAuditFor() for anything user-facing. */
export function listAudit(): AuditLogEntry[] {
  return [...getStore().audit].sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * Activity visible to a user: reviewers and admins see everyone's activity,
 * everyone else sees only their own. Enforced here, on the server, so neither
 * the page nor the API can be tricked into showing other people's history.
 */
export function listAuditFor(user: Pick<SessionUser, "id" | "role">): { entries: AuditLogEntry[]; scope: "all" | "own" } {
  const all = can(user.role, "audit:read");
  const entries = listAudit();
  return all ? { entries, scope: "all" } : { entries: entries.filter((e) => e.userId === user.id), scope: "own" };
}
