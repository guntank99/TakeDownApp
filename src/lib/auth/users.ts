import "server-only";

import type { UserRecord } from "@/types";

/**
 * PROTOTYPE ONLY. Fictional demo accounts with bcrypt-hashed passwords, used
 * when APP_MODE=demo. In live mode users come from the database instead.
 */
export const DEMO_USERS: UserRecord[] = [
  {
    id: "USR-001",
    username: "admin",
    email: "admin@sentinel.example",
    name: "Admin Demo",
    role: "admin",
    passwordHash: "$2b$10$eMlrS3O1lh/pyh6i8TTPxe7N9ChXUKTJwZel3sa/2fMWg/wFHmTVK",
    active: true,
    createdAt: "2026-09-01T00:00:00Z",
  },
  {
    id: "USR-002",
    username: "analyst",
    email: "analyst@sentinel.example",
    name: "Analis Demo",
    role: "analyst",
    passwordHash: "$2b$10$G3E7QEcIMwI0Qu.i/ul5Duvzjj1skTE4YGr5UMxOV8bIFhVs9P5hS",
    active: true,
    createdAt: "2026-09-01T00:00:00Z",
  },
  {
    id: "USR-003",
    username: "reviewer",
    email: "reviewer@sentinel.example",
    name: "Peninjau Demo",
    role: "reviewer",
    passwordHash: "$2b$10$xojNsR1ykcGdutGc/Hsgcu3gpA4Lwh5A5Ba581CHUSPa.OsSeKPH.",
    active: true,
    createdAt: "2026-09-01T00:00:00Z",
  },
];

/**
 * Compared against when the user does not exist, so a failed login takes
 * about as long whether or not the account is real.
 */
export const DUMMY_PASSWORD_HASH = DEMO_USERS[0].passwordHash;

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
