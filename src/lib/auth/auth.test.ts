import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SESSION_TTL_SECONDS, signSession, verifySessionToken } from "./session-token";
import { demoLoginEnabled, findUserById, findUserByIdentifier } from "./users";

const SECRET = "x".repeat(40);
const env = process.env as Record<string, string | undefined>;
const TOUCHED = ["AUTH_SECRET", "DEMO_PASSWORD_HASH", "DEMO_MODE", "NODE_ENV"];
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
  it("finds users by username or email, case-insensitively", () => {
    expect(findUserByIdentifier("ANALYST")?.id).toBe("USR-002");
    expect(findUserByIdentifier("Reviewer@Sentinel.Example")?.id).toBe("USR-003");
    expect(findUserByIdentifier("nobody")).toBeNull();
  });

  it("stores only bcrypt hashes and never exposes them through findUserById", () => {
    const u = findUserByIdentifier("admin")!;
    expect(u.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(findUserById("USR-001")).not.toHaveProperty("passwordHash");
  });

  it("DEMO_PASSWORD_HASH overrides the built-in demo password", () => {
    env.DEMO_PASSWORD_HASH = "$2b$10$overrideoverrideoverrideoverrideoverrideoverrideoverri";
    expect(findUserByIdentifier("admin")!.passwordHash).toBe(env.DEMO_PASSWORD_HASH);
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
});
