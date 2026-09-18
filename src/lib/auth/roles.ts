import type { Role } from "@/types";

/** Safe to import from client components (no secrets, no server-only code). */
export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  analyst: "Analis",
  reviewer: "Peninjau",
};
