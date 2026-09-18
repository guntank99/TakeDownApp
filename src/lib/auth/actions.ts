"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { logAudit } from "@/lib/services/audit";
import { createSession, deleteSession, getSession } from "./session";
import { DUMMY_PASSWORD_HASH, demoLoginEnabled, findUserById, findUserByIdentifier } from "./users";

export interface LoginState {
  error?: string;
  /** Echoed back so the field is not cleared after a failed attempt. */
  identifier?: string;
}

const INVALID = "Nama pengguna/email atau kata sandi salah.";

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const remember = formData.get("remember") === "on";

  if (!demoLoginEnabled()) {
    return {
      error: "Masuk dinonaktifkan: belum ada penyimpanan pengguna yang dikonfigurasi untuk deployment ini. Administrator harus mengatur DEMO_MODE=true dan DEMO_PASSWORD_HASH untuk mengaktifkan akun demo.",
      identifier,
    };
  }

  if (!identifier || !password) {
    return { error: "Masukkan nama pengguna/email dan kata sandi.", identifier };
  }
  if (identifier.length > 254 || password.length > 128) {
    return { error: INVALID, identifier };
  }

  const user = findUserByIdentifier(identifier);
  // Always run a hash comparison so timing does not reveal valid usernames.
  const passwordOk = await bcrypt.compare(
    password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );

  if (!user || !passwordOk) {
    // Log the attempted identifier (not the password) for detection of guessing.
    logAudit({ user: { id: user?.id ?? "unknown", name: user?.name ?? identifier.slice(0, 60) }, action: "LOGIN_FAILED", object: "sesi", result: "FAILED" });
    return { error: INVALID, identifier };
  }

  await createSession(
    { id: user.id, username: user.username, name: user.name, role: user.role },
    remember,
  );
  logAudit({ user, action: "LOGIN", object: "sesi" });
  redirect("/dashboard");
}

export async function logout() {
  const session = await getSession();
  const who = session ? findUserById(session.userId) : null;
  if (who) logAudit({ user: who, action: "LOGOUT", object: "sesi" });
  await deleteSession();
  redirect("/login");
}
