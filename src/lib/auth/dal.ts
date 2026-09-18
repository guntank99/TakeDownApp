import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role, SessionUser } from "@/types";
import { getSession } from "./session";
import { findUserById } from "./users";

/**
 * Data Access Layer for auth. This is the real authorization check; the
 * proxy only does a fast optimistic redirect. Call verifySession() in every
 * protected page and route handler — layouts do not re-run on client-side
 * navigation, so a layout check alone is not enough.
 */

/** Current user, or null. Never redirects. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await getSession();
  if (!session) return null;
  return findUserById(session.userId);
});

/** Current user, or redirect to /login. */
export async function verifySession(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Like verifySession, but also requires one of the given roles. */
export async function requireRole(...allowed: Role[]): Promise<SessionUser> {
  const user = await verifySession();
  if (!allowed.includes(user.role)) redirect("/dashboard");
  return user;
}
