import type { Role } from "@/types";

/** Public display info for user ids (no credentials), safe for any component. */
export const USER_DIRECTORY: Record<string, { name: string; role: Role }> = {
  "USR-001": { name: "Demo Admin", role: "admin" },
  "USR-002": { name: "Demo Analyst", role: "analyst" },
  "USR-003": { name: "Demo Reviewer", role: "reviewer" },
};

export function userName(id: string | null | undefined): string {
  if (!id) return "—";
  return USER_DIRECTORY[id]?.name ?? id;
}
