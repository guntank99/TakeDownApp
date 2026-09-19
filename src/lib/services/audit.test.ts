import { describe, expect, it } from "vitest";
import { getRepository } from "@/lib/store";
import { listAuditFor, logAudit } from "./audit";

const me = { id: "USR-TEST-1", name: "Penguji Satu" };
const other = { id: "USR-TEST-2", name: "Penguji Dua" };

describe("riwayat aktivitas", () => {
  it("mencatat entri dengan id dan waktu", async () => {
    const repo = await getRepository();
    const before = (await repo.listAudit()).length;
    await logAudit({ user: me, action: "SEARCH", object: 'pencarian "beras"' });
    const all = await repo.listAudit();
    expect(all.length).toBe(before + 1);
    expect(all.find((e) => e.object === 'pencarian "beras"')).toMatchObject({ userId: me.id, action: "SEARCH", result: "SUCCESS" });
    expect(all.every((e) => e.id && !Number.isNaN(Date.parse(e.at)))).toBe(true);
  });

  it("analis hanya melihat aktivitasnya sendiri; peninjau dan admin melihat semuanya", async () => {
    await logAudit({ user: me, action: "LOGIN", object: "sesi" });
    await logAudit({ user: other, action: "LOGIN", object: "sesi" });

    const asAnalyst = await listAuditFor({ id: me.id, role: "analyst" });
    expect(asAnalyst.scope).toBe("own");
    expect(asAnalyst.entries.length).toBeGreaterThan(0);
    expect(asAnalyst.entries.every((e) => e.userId === me.id)).toBe(true);

    for (const role of ["reviewer", "admin"] as const) {
      const all = await listAuditFor({ id: me.id, role });
      expect(all.scope).toBe("all");
      expect(new Set(all.entries.map((e) => e.userId)).has(other.id)).toBe(true);
    }
  });

  it("mengurutkan dari yang terbaru", async () => {
    const { entries } = await listAuditFor({ id: me.id, role: "admin" });
    const times = entries.map((e) => e.at);
    expect([...times].sort().reverse()).toEqual(times);
  });
});
