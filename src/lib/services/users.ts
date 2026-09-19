import "server-only";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { can } from "@/lib/auth/permissions";
import { refreshDirectory } from "@/lib/auth/user-store";
import { appMode } from "@/lib/config/mode";
import { getRepository } from "@/lib/store";
import type { Role, SessionUser, UserRecord } from "@/types";
import { logAudit } from "./audit";
import { failure, success, type Result } from "./result";

const ROLES = ["admin", "analyst", "reviewer"] as const;
export const MIN_PASSWORD = 10;
const BCRYPT_ROUNDS = 12;

const password = z.string().min(MIN_PASSWORD, `Kata sandi minimal ${MIN_PASSWORD} karakter`).max(128, "Kata sandi maksimal 128 karakter");

export const createUserSchema = z.object({
  username: z.string().trim().regex(/^[A-Za-z0-9._-]{3,32}$/, "Nama pengguna 3–32 karakter (huruf, angka, titik, garis)"),
  email: z.string().trim().toLowerCase().email("Email tidak valid").max(254),
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(80),
  role: z.enum(ROLES),
  password,
});

const demoBlocked = () => (appMode() === "demo" ? failure("Mode demo bersifat hanya-baca untuk pengguna. Gunakan APP_MODE=live untuk mengelola pengguna nyata.", 409) : null);

const publicView = (u: UserRecord) => ({ id: u.id, username: u.username, email: u.email, name: u.name, role: u.role, active: u.active, createdAt: u.createdAt });
type PublicUser = ReturnType<typeof publicView>;

async function deny(user: SessionUser, object: string): Promise<Result<never>> {
  await logAudit({ user, action: "UPDATE_USER", object, result: "DENIED" });
  return failure("Hanya admin yang dapat mengelola pengguna.", 403);
}

export async function createUser(actor: SessionUser, raw: unknown): Promise<Result<PublicUser>> {
  if (!can(actor.role, "users:manage")) return deny(actor, "buat pengguna");
  const blocked = demoBlocked();
  if (blocked) return blocked;
  const parsed = createUserSchema.safeParse(raw);
  if (!parsed.success) return failure(parsed.error.issues[0]?.message ?? "Input tidak valid.");

  const repo = await getRepository();
  const u = parsed.data;
  if (await repo.getUserByLogin(u.username)) return failure("Nama pengguna sudah dipakai.", 409);
  if (await repo.getUserByLogin(u.email)) return failure("Email sudah terdaftar.", 409);

  const record: UserRecord = {
    id: await repo.newUserId(),
    username: u.username,
    email: u.email,
    name: u.name,
    role: u.role,
    passwordHash: await bcrypt.hash(u.password, BCRYPT_ROUNDS),
    active: true,
    createdAt: new Date().toISOString(),
  };
  await repo.saveUser(record);
  await refreshDirectory(true);
  await logAudit({ user: actor, action: "CREATE_USER", object: `${record.username} (${record.role})` });
  return success(publicView(record));
}

async function activeAdmins(): Promise<UserRecord[]> {
  return (await (await getRepository()).listUsers()).filter((x) => x.role === "admin" && x.active);
}

/** Change role and/or active flag. Never lets the workspace end up with no working admin. */
export async function updateUser(actor: SessionUser, id: string, raw: { role?: string; active?: boolean }): Promise<Result<PublicUser>> {
  if (!can(actor.role, "users:manage")) return deny(actor, id);
  const blocked = demoBlocked();
  if (blocked) return blocked;
  const repo = await getRepository();
  const target = await repo.getUserById(id);
  if (!target) return failure("Pengguna tidak ditemukan.", 404);

  const role = raw.role === undefined ? undefined : ROLES.find((r) => r === raw.role);
  if (raw.role !== undefined && !role) return failure("Peran tidak dikenal.");

  const losesAdmin = target.role === "admin" && target.active && ((role !== undefined && role !== "admin") || raw.active === false);
  if (losesAdmin) {
    if (target.id === actor.id) return failure("Anda tidak dapat menurunkan atau menonaktifkan akun Anda sendiri.", 409);
    if ((await activeAdmins()).length <= 1) return failure("Tidak dapat: ini satu-satunya admin aktif.", 409);
  }

  const changes: string[] = [];
  if (role && role !== target.role) {
    target.role = role as Role;
    changes.push(`peran → ${role}`);
  }
  if (raw.active !== undefined && raw.active !== target.active) {
    target.active = raw.active;
    changes.push(raw.active ? "diaktifkan" : "dinonaktifkan");
  }
  if (changes.length) {
    await repo.saveUser(target);
    await refreshDirectory(true);
    await logAudit({ user: actor, action: "UPDATE_USER", object: `${target.username}: ${changes.join(", ")}` });
  }
  return success(publicView(target));
}

/** Admin sets a new password for someone (e.g. forgotten password). */
export async function resetPassword(actor: SessionUser, id: string, newPassword: string): Promise<Result<true>> {
  if (!can(actor.role, "users:manage")) return deny(actor, id);
  const blocked = demoBlocked();
  if (blocked) return blocked;
  const ok = password.safeParse(newPassword);
  if (!ok.success) return failure(ok.error.issues[0]?.message ?? "Kata sandi tidak valid.");
  const repo = await getRepository();
  const target = await repo.getUserById(id);
  if (!target) return failure("Pengguna tidak ditemukan.", 404);
  target.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await repo.saveUser(target);
  await logAudit({ user: actor, action: "CHANGE_PASSWORD", object: `reset untuk ${target.username}` });
  return success(true);
}

export async function changeOwnPassword(actor: SessionUser, current: string, next: string): Promise<Result<true>> {
  const blocked = demoBlocked();
  if (blocked) return blocked;
  const ok = password.safeParse(next);
  if (!ok.success) return failure(ok.error.issues[0]?.message ?? "Kata sandi tidak valid.");
  const repo = await getRepository();
  const me = await repo.getUserById(actor.id);
  if (!me || !(await bcrypt.compare(current, me.passwordHash))) {
    await logAudit({ user: actor, action: "CHANGE_PASSWORD", object: "kata sandi saat ini salah", result: "FAILED" });
    return failure("Kata sandi saat ini salah.", 403);
  }
  me.passwordHash = await bcrypt.hash(next, BCRYPT_ROUNDS);
  await repo.saveUser(me);
  await logAudit({ user: actor, action: "CHANGE_PASSWORD", object: "kata sandi sendiri" });
  return success(true);
}
