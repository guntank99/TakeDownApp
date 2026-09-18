import "server-only";

import { cookies } from "next/headers";
import type { SessionUser } from "@/types";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  signSession,
  verifySessionToken,
  type SessionPayload,
} from "./session-token";

export async function createSession(user: SessionUser, remember: boolean) {
  const ttl = remember
    ? SESSION_TTL_SECONDS.remember
    : SESSION_TTL_SECONDS.standard;
  const token = await signSession({ userId: user.id, role: user.role }, ttl);

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Without maxAge this is a browser-session cookie (cleared on close).
    ...(remember ? { maxAge: ttl } : {}),
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

export async function deleteSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
