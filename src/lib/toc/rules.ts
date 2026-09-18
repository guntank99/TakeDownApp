import "server-only";

import tocJson from "@/data/mock-toc.json";
import type { PolicyRule } from "@/types";

/**
 * The policy database. Entries are seeded from official platform pages; each
 * carries its own `verification` status. Later phases move this to the
 * database and add an admin-only edit flow (audit action UPDATE_POLICY).
 */
export function listPolicyRules(): PolicyRule[] {
  return tocJson as PolicyRule[];
}
