import type { UserRecord } from "@/types";

/**
 * The very first administrator of a live deployment comes from environment
 * variables (there is nobody yet who could create one in the UI):
 *
 *   ADMIN_USERNAME, ADMIN_PASSWORD_HASH (bcrypt), and optionally ADMIN_EMAIL, ADMIN_NAME
 *
 * Only ever used while the user table is empty.
 */
export function buildBootstrapAdmin(
  env: Record<string, string | undefined>,
  id: string,
  now: string,
): { user: UserRecord } | { user: null; problem: string | null } {
  const username = env.ADMIN_USERNAME?.trim();
  const hash = env.ADMIN_PASSWORD_HASH?.trim();
  if (!username && !hash) return { user: null, problem: null };
  if (!username || !hash) return { user: null, problem: "ADMIN_USERNAME dan ADMIN_PASSWORD_HASH harus diisi bersamaan." };
  if (!/^[A-Za-z0-9._-]{3,32}$/.test(username)) return { user: null, problem: "ADMIN_USERNAME harus 3–32 karakter (huruf, angka, titik, garis)." };
  if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash)) return { user: null, problem: "ADMIN_PASSWORD_HASH bukan hash bcrypt yang valid (harus diawali $2b$10$ dan sepanjang 60 karakter)." };
  return {
    user: {
      id,
      username,
      email: env.ADMIN_EMAIL?.trim() || `${username}@thepower.local`,
      name: env.ADMIN_NAME?.trim() || "Administrator",
      role: "admin",
      passwordHash: hash,
      active: true,
      createdAt: now,
    },
  };
}
