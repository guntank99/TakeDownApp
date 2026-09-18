import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { findUserById } from "@/lib/auth/users";
import { can, type Permission } from "@/lib/auth/permissions";
import type { SessionUser } from "@/types";
import { rateLimit } from "./rate-limit";

/**
 * Wraps every route handler. The proxy deliberately skips /api, so each
 * endpoint authorizes itself here: session → rate limit → same-origin check
 * for writes → permission → handler, with errors mapped to JSON.
 */

export interface ApiOptions {
  permission?: Permission;
}
export interface ApiContext<P> {
  user: SessionUser;
  params: P;
}

const MAX_BODY_BYTES = 100_000;
const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const json = (data: unknown, status = 200, headers?: HeadersInit) =>
  NextResponse.json({ data }, { status, headers: { "Cache-Control": "no-store", ...headers } });
export const errorJson = (status: number, error: string, headers?: HeadersInit) =>
  NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store", ...headers } });

/** Rejects cross-site browser requests (CSRF defence in depth on top of SameSite=Lax). */
function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === req.headers.get("host");
    } catch {
      return false;
    }
  }
  return req.headers.get("sec-fetch-site") !== "cross-site";
}

export async function readJson(req: NextRequest): Promise<unknown> {
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) throw new HttpError(413, "Request body too large.");
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) throw new HttpError(413, "Request body too large.");
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

export function withApi<P = Record<string, never>>(
  options: ApiOptions,
  handler: (req: NextRequest, ctx: ApiContext<P>) => Promise<Response | unknown>,
) {
  return async (req: NextRequest, routeCtx?: { params: Promise<P> }): Promise<Response> => {
    try {
      const session = await getSession();
      const user = session ? findUserById(session.userId) : null;
      if (!user) return errorJson(401, "Authentication required.");

      const write = WRITE_METHODS.has(req.method);
      const limited = rateLimit(`${user.id}:${write ? "w" : "r"}`, write ? 30 : 120);
      if (!limited.ok) return errorJson(429, "Too many requests.", { "Retry-After": String(limited.retryAfter) });

      if (write && !sameOrigin(req)) return errorJson(403, "Cross-origin requests are not allowed.");
      if (options.permission && !can(user.role, options.permission)) return errorJson(403, "Your role cannot perform this action.");

      const params = (routeCtx ? await routeCtx.params : {}) as P;
      const result = await handler(req, { user, params });
      return result instanceof Response ? result : json(result);
    } catch (error) {
      if (error instanceof HttpError) return errorJson(error.status, error.message);
      console.error("API error", error);
      return errorJson(500, "Internal server error.");
    }
  };
}

/** Maps a service Result to a response. */
export function fromResult<T>(result: { ok: true; value: T } | { ok: false; error: string; status: number }, successStatus = 200) {
  return result.ok ? json(result.value, successStatus) : errorJson(result.status, result.error);
}

/** ?page= & ?pageSize= with sane bounds. */
export function pageOf(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(sp.get("pageSize") ?? "20", 10) || 20));
  return { page, pageSize };
}
