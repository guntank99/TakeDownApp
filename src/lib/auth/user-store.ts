import "server-only";

import { appMode } from "@/lib/config/mode";
import { getRepository } from "@/lib/store";
import type { SessionUser, UserRecord } from "@/types";
import { setDirectory } from "./directory";
import { DEMO_USERS, demoLoginEnabled } from "./users";

/**
 * One place that answers "who is this user?" for both modes:
 *   demo → the fictional demo accounts
 *   live → the database (so deactivating a user takes effect immediately)
 */

const isDemo = () => appMode() === "demo";

function demoUsers(): UserRecord[] {
  // DEMO_PASSWORD_HASH replaces the built-in demo password for every demo account.
  const override = process.env.DEMO_PASSWORD_HASH;
  return DEMO_USERS.map((u) => ({ ...u, passwordHash: override || u.passwordHash }));
}

export async function findUserByLogin(login: string): Promise<UserRecord | null> {
  const needle = login.trim().toLowerCase();
  if (isDemo()) return demoUsers().find((u) => u.username.toLowerCase() === needle || u.email === needle) ?? null;
  return (await getRepository()).getUserByLogin(login);
}

const toSession = (u: UserRecord): SessionUser => ({ id: u.id, username: u.username, name: u.name, role: u.role });

/** The signed-in user as stored NOW (role and active flag included); null if gone or disabled. */
export async function findSessionUser(id: string): Promise<SessionUser | null> {
  if (isDemo()) {
    const u = DEMO_USERS.find((x) => x.id === id);
    return u ? toSession(u) : null;
  }
  const u = await (await getRepository()).getUserById(id);
  return u && u.active ? toSession(u) : null;
}

export async function listUsersSafe(): Promise<Omit<UserRecord, "passwordHash">[]> {
  const users = isDemo() ? DEMO_USERS : await (await getRepository()).listUsers();
  return users.map((u) => ({ id: u.id, username: u.username, email: u.email, name: u.name, role: u.role, active: u.active, createdAt: u.createdAt }));
}

/** Can anybody sign in on this deployment? If not, says why (shown on the login form). */
export async function loginAvailability(): Promise<{ ok: true } | { ok: false; message: string }> {
  if (isDemo()) {
    return demoLoginEnabled()
      ? { ok: true }
      : { ok: false, message: "Masuk dinonaktifkan: belum ada penyimpanan pengguna yang dikonfigurasi untuk deployment ini. Administrator harus mengatur DEMO_MODE=true dan DEMO_PASSWORD_HASH untuk mengaktifkan akun demo." };
  }
  const users = await (await getRepository()).listUsers();
  return users.some((u) => u.active)
    ? { ok: true }
    : { ok: false, message: "Belum ada pengguna terdaftar. Administrator harus mengatur ADMIN_USERNAME dan ADMIN_PASSWORD_HASH (hash bcrypt), lalu deploy ulang." };
}

// ------------------------------------------------- display names (sync lookup)
const TTL_MS = 30_000;
const g = globalThis as unknown as { __tpDirAt?: number };

/**
 * Loads id → display name so the sync userName() helper works while pages
 * render. Called from the auth check every page already performs.
 */
export async function refreshDirectory(force = false): Promise<void> {
  if (isDemo()) {
    setDirectory(DEMO_USERS.map((u) => ({ id: u.id, name: u.name, role: u.role })));
    return;
  }
  if (!force && g.__tpDirAt && Date.now() - g.__tpDirAt < TTL_MS) return;
  const users = await (await getRepository()).listUsers();
  setDirectory(users.map((u) => ({ id: u.id, name: u.name, role: u.role })));
  g.__tpDirAt = Date.now();
}
