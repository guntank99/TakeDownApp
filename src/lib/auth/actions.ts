"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { rateLimit } from "@/lib/api/rate-limit";
import { logAudit } from "@/lib/services/audit";
import { createSession, deleteSession, getSession } from "./session";
import { findSessionUser, findUserByLogin, loginAvailability } from "./user-store";
import { DUMMY_PASSWORD_HASH } from "./users";

export interface LoginState {
  error?: string;
  /** Echoed back so the field is not cleared after a failed attempt. */
  identifier?: string;
}

const INVALID = "Nama pengguna/email atau kata sandi salah.";
const LOGIN_ATTEMPTS = 8;
const LOGIN_WINDOW_MS = 10 * 60_000;

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const remember = formData.get("remember") === "on";

  const availability = await loginAvailability();
  if (!availability.ok) return { error: availability.message, identifier };

  if (!identifier || !password) {
    return { error: "Masukkan nama pengguna/email dan kata sandi.", identifier };
  }
  if (identifier.length > 254 || password.length > 128) {
    return { error: INVALID, identifier };
  }

  // Slows password guessing per identifier. In-memory, so per server instance.
  const limited = rateLimit(`login:${identifier.toLowerCase()}`, LOGIN_ATTEMPTS, LOGIN_WINDOW_MS);
  if (!limited.ok) {
    return { error: `Terlalu banyak percobaan masuk. Coba lagi dalam ${Math.ceil(limited.retryAfter / 60)} menit.`, identifier };
  }

  const user = await findUserByLogin(identifier);
  // Always run a hash comparison so timing does not reveal valid usernames.
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

  if (!user || !passwordOk) {
    // Log the attempted identifier (not the password) for detection of guessing.
    await logAudit({ user: { id: user?.id ?? "unknown", name: user?.name ?? identifier.slice(0, 60) }, action: "LOGIN_FAILED", object: "sesi", result: "FAILED" });
    return { error: INVALID, identifier };
  }
  if (!user.active) {
    await logAudit({ user, action: "LOGIN_FAILED", object: "sesi (akun dinonaktifkan)", result: "DENIED" });
    return { error: "Akun ini dinonaktifkan. Hubungi administrator.", identifier };
  }

  await createSession({ id: user.id, username: user.username, name: user.name, role: user.role }, remember);
  await logAudit({ user, action: "LOGIN", object: "sesi" });
  redirect("/dashboard");
}

export async function logout() {
  const session = await getSession();
  const who = session ? await findSessionUser(session.userId) : null;
  if (who) await logAudit({ user: who, action: "LOGOUT", object: "sesi" });
  await deleteSession();
  redirect("/login");
}
