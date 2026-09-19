import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SESSION_TTL_SECONDS, signSession, verifySessionToken } from "./session-token";
import { buildBootstrapAdmin } from "@/lib/store/bootstrap";
import { findSessionUser, findUserByLogin, listUsersSafe, loginAvailability } from "./user-store";
import { demoLoginEnabled } from "./users";

const SECRET = "x".repeat(40);
const env = process.env as Record<string, string | undefined>;
const TOUCHED = ["AUTH_SECRET", "DEMO_PASSWORD_HASH", "DEMO_MODE", "NODE_ENV", "APP_MODE"];
const original = Object.fromEntries(TOUCHED.map((k) => [k, process.env[k]]));

beforeEach(() => {
  env.AUTH_SECRET = SECRET;
});
afterEach(() => {
  // restore key by key: replacing process.env would orphan the `env` alias above
  for (const k of TOUCHED) {
    if (original[k] === undefined) delete env[k];
    else env[k] = original[k];
  }
});

describe("session tokens", () => {
  it("round-trips a valid session", async () => {
    const token = await signSession({ userId: "USR-002", role: "analyst" }, SESSION_TTL_SECONDS.standard);
    expect(await verifySessionToken(token)).toEqual({ userId: "USR-002", role: "analyst" });
  });

  it("rejects missing, garbage and tampered tokens", async () => {
    expect(await verifySessionToken(undefined)).toBeNull();
    expect(await verifySessionToken("not-a-jwt")).toBeNull();
    const token = await signSession({ userId: "USR-002", role: "analyst" }, 60);
    const [h, , s] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ userId: "USR-001", role: "admin", exp: 9999999999 })).toString("base64url");
    expect(await verifySessionToken(`${h}.${forgedPayload}.${s}`)).toBeNull();
  });

  it("rejects expired tokens", async () => {
    const token = await signSession({ userId: "USR-002", role: "analyst" }, -60);
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("rejects tokens signed with another secret or with an unknown role", async () => {
    const other = await new SignJWT({ userId: "USR-001", role: "admin" }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(new TextEncoder().encode("y".repeat(40)));
    expect(await verifySessionToken(other)).toBeNull();
    const badRole = await new SignJWT({ userId: "USR-001", role: "superuser" }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(new TextEncoder().encode(SECRET));
    expect(await verifySessionToken(badRole)).toBeNull();
  });

  it("refuses to run without a strong AUTH_SECRET", async () => {
    env.AUTH_SECRET = "short";
    await expect(signSession({ userId: "USR-001", role: "admin" }, 60)).rejects.toThrow(/AUTH_SECRET/);
    delete env.AUTH_SECRET;
    await expect(verifySessionToken("a.b.c")).resolves.toBeNull(); // verification failures never throw to callers
  });

  it("'remember me' lasts longer than a standard session", () => {
    expect(SESSION_TTL_SECONDS.remember).toBeGreaterThan(SESSION_TTL_SECONDS.standard);
  });
});

describe("demo user store", () => {
  it("finds users by username or email, case-insensitively", async () => {
    expect((await findUserByLogin("ANALYST"))?.id).toBe("USR-002");
    expect((await findUserByLogin("Reviewer@Sentinel.Example"))?.id).toBe("USR-003");
    expect(await findUserByLogin("nobody")).toBeNull();
  });

  it("stores only bcrypt hashes and never exposes them to the session or the user list", async () => {
    expect((await findUserByLogin("admin"))!.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(await findSessionUser("USR-001")).not.toHaveProperty("passwordHash");
    for (const u of await listUsersSafe()) expect(u).not.toHaveProperty("passwordHash");
  });

  it("DEMO_PASSWORD_HASH overrides the built-in demo password", async () => {
    env.DEMO_PASSWORD_HASH = "$2b$10$overrideoverrideoverrideoverrideoverrideoverrideoverri";
    expect((await findUserByLogin("admin"))!.passwordHash).toBe(env.DEMO_PASSWORD_HASH);
  });

  it("demo login is on in development, but in production needs DEMO_MODE=true AND a private password hash", () => {
    env.NODE_ENV = "development";
    expect(demoLoginEnabled()).toBe(true);
    env.NODE_ENV = "production";
    delete env.DEMO_MODE;
    delete env.DEMO_PASSWORD_HASH;
    expect(demoLoginEnabled()).toBe(false);
    env.DEMO_MODE = "true";
    expect(demoLoginEnabled()).toBe(false); // the public README password must never work in production
    env.DEMO_PASSWORD_HASH = "$2b$10$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuuabcdefghi";
    expect(demoLoginEnabled()).toBe(true);
    env.DEMO_MODE = "false";
    expect(demoLoginEnabled()).toBe(false);
  });

  it("explains on the login form why nobody can sign in", async () => {
    env.NODE_ENV = "production";
    delete env.DEMO_MODE;
    delete env.DEMO_PASSWORD_HASH;
    const res = await loginAvailability();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/DEMO_MODE/);
  });
});

describe("bootstrap administrator (live mode)", () => {
  const HASH = "$2b$10$" + "a".repeat(53);
  const now = "2026-09-19T00:00:00.000Z";

  it("creates an admin from ADMIN_USERNAME + ADMIN_PASSWORD_HASH", () => {
    const res = buildBootstrapAdmin({ ADMIN_USERNAME: "boss", ADMIN_PASSWORD_HASH: HASH }, "USR-001", now);
    expect(res.user).toMatchObject({ id: "USR-001", username: "boss", role: "admin", active: true, passwordHash: HASH });
  });

  it("creates nothing (and no complaint) when neither variable is set", () => {
    expect(buildBootstrapAdmin({}, "USR-001", now)).toEqual({ user: null, problem: null });
  });

  it("refuses a half-configured admin, a bad username, and a password that is not a bcrypt hash", () => {
    for (const env of [
      { ADMIN_USERNAME: "boss" },
      { ADMIN_PASSWORD_HASH: HASH },
      { ADMIN_USERNAME: "a b", ADMIN_PASSWORD_HASH: HASH },
      { ADMIN_USERNAME: "boss", ADMIN_PASSWORD_HASH: "password123" },
    ]) {
      const res = buildBootstrapAdmin(env, "USR-001", now);
      expect(res.user).toBeNull();
      expect((res as { problem: string | null }).problem).toBeTruthy();
    }
  });
});
