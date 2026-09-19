import "server-only";

import { can } from "@/lib/auth/permissions";
import { getRepository } from "@/lib/store";
import type { AuditAction, AuditLogEntry, SessionUser } from "@/types";

interface AuditInput {
  user: Pick<SessionUser, "id" | "name">;
  action: AuditAction;
  object: string;
  caseId?: string | null;
  result?: AuditLogEntry["result"];
}

/**
 * Append-only audit trail. Always `await` it: on serverless hosts work that is
 * still running when the response ends can be cut off. It never throws, so a
 * storage problem cannot break the action being audited.
 */
export async function logAudit({ user, action, object, caseId = null, result = "SUCCESS" }: AuditInput): Promise<void> {
  try {
    await (await getRepository()).appendAudit({
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

/**
 * Activity visible to a user: reviewers and admins see everyone's activity,
 * everyone else sees only their own. Enforced here, on the server, so neither
 * the page nor the API can be tricked into showing other people's history.
 */
export async function listAuditFor(user: Pick<SessionUser, "id" | "role">): Promise<{ entries: AuditLogEntry[]; scope: "all" | "own" }> {
  const all = can(user.role, "audit:read");
  const entries = await (await getRepository()).listAudit();
  return all ? { entries, scope: "all" } : { entries: entries.filter((e) => e.userId === user.id), scope: "own" };
}
