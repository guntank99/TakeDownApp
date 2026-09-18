import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/types";

/**
 * Signing/verification only — no next/headers here, so the proxy can use it.
 * Cookie handling lives in session.ts.
 */

export const SESSION_COOKIE = "ss_session";

/** "Remember me" keeps the session for 7 days; otherwise 8 hours. */
export const SESSION_TTL_SECONDS = {
  remember: 7 * 24 * 60 * 60,
  standard: 8 * 60 * 60,
} as const;

const ROLES: readonly Role[] = ["admin", "analyst", "reviewer"];

export interface SessionPayload {
  userId: string;
  role: Role;
}

function getKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET is missing or shorter than 32 characters. Copy .env.example to .env.local and set it.",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(
  payload: SessionPayload,
  ttlSeconds: number,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(getKey());
}

/** Returns null for a missing, tampered, or expired token. */
export async function verifySessionToken(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getKey(), {
      algorithms: ["HS256"],
    });
    const { userId, role } = payload;
    if (typeof userId !== "string" || !ROLES.includes(role as Role)) {
      return null;
    }
    return { userId, role: role as Role };
  } catch {
    return null;
  }
}
