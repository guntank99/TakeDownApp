import "server-only";

import type { SessionUser } from "@/types";

/**
 * PROTOTYPE ONLY. These are fictional demo accounts with bcrypt-hashed
 * passwords so no plaintext password lives in the repository. Before any
 * real use, replace this file with a database-backed user store.
 */
interface UserRecord extends SessionUser {
  email: string;
  passwordHash: string;
}

const users: UserRecord[] = [
  {
    id: "USR-001",
    username: "admin",
    email: "admin@sentinel.example",
    name: "Admin Demo",
    role: "admin",
    passwordHash:
      "$2b$10$eMlrS3O1lh/pyh6i8TTPxe7N9ChXUKTJwZel3sa/2fMWg/wFHmTVK",
  },
  {
    id: "USR-002",
    username: "analyst",
    email: "analyst@sentinel.example",
    name: "Analis Demo",
    role: "analyst",
    passwordHash:
      "$2b$10$G3E7QEcIMwI0Qu.i/ul5Duvzjj1skTE4YGr5UMxOV8bIFhVs9P5hS",
  },
  {
    id: "USR-003",
    username: "reviewer",
    email: "reviewer@sentinel.example",
    name: "Peninjau Demo",
    role: "reviewer",
    passwordHash:
      "$2b$10$xojNsR1ykcGdutGc/Hsgcu3gpA4Lwh5A5Ba581CHUSPa.OsSeKPH.",
  },
];

/**
 * Compared against when the user does not exist, so a failed login takes
 * about as long whether or not the account is real.
 */
export const DUMMY_PASSWORD_HASH = users[0].passwordHash;

/**
 * DEMO_PASSWORD_HASH (a bcrypt hash) replaces the built-in demo password for
 * every demo account, so a public deployment does not depend on the password
 * that is documented in the README.
 */
export function findUserByIdentifier(identifier: string): UserRecord | null {
  const needle = identifier.trim().toLowerCase();
  const user = users.find((u) => u.username.toLowerCase() === needle || u.email === needle);
  if (!user) return null;
  return { ...user, passwordHash: process.env.DEMO_PASSWORD_HASH || user.passwordHash };
}

/**
 * Demo accounts are always on in development. In production they need BOTH an
 * explicit opt-in (DEMO_MODE=true) and a private password (DEMO_PASSWORD_HASH),
 * so the built-in demo password, which is public in the README, can never be
 * used against a deployment.
 */
export function demoLoginEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.DEMO_MODE === "true" && Boolean(process.env.DEMO_PASSWORD_HASH);
}

export function findUserById(id: string): SessionUser | null {
  const user = users.find((u) => u.id === id);
  if (!user) return null;
  // Never hand the hash to callers that only need identity.
  return { id: user.id, username: user.username, name: user.name, role: user.role };
}
