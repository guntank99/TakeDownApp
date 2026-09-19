import type { Role } from "@/types";

/** Safe for client components: pure data, no secrets. */
export type Permission =
  | "case:create"
  | "case:update"
  | "case:verify"
  | "evidence:create"
  | "report:create"
  | "report:review"
  | "report:submit"
  | "audit:read"
  | "settings:admin"
  | "users:manage"
  | "post:import";

const MATRIX: Record<Role, readonly Permission[]> = {
  admin: [
    "case:create", "case:update", "case:verify", "evidence:create",
    "report:create", "report:review", "report:submit", "audit:read", "settings:admin", "users:manage", "post:import",
  ],
  analyst: ["case:create", "case:update", "evidence:create", "report:create", "post:import"],
  reviewer: ["case:update", "case:verify", "report:review", "report:submit", "audit:read"],
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role].includes(permission);
}
