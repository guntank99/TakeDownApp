import type { Role } from "@/types";

/** Public display info for user ids (no credentials), safe for any component. */
export const USER_DIRECTORY: Record<string, { name: string; role: Role }> = {
  "USR-001": { name: "Admin Demo", role: "admin" },
  "USR-002": { name: "Analis Demo", role: "analyst" },
  "USR-003": { name: "Peninjau Demo", role: "reviewer" },
};

export function userName(id: string | null | undefined): string {
  if (!id) return "—";
  return USER_DIRECTORY[id]?.name ?? id;
}
