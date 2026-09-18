import { describe, expect, it } from "vitest";
import { getStore } from "@/lib/store";
import { listAuditFor, logAudit } from "./audit";

const me = { id: "USR-TEST-1", name: "Penguji Satu" };
const other = { id: "USR-TEST-2", name: "Penguji Dua" };

describe("riwayat aktivitas", () => {
  it("mencatat entri dengan id berurutan dan waktu", () => {
    const before = getStore().audit.length;
    logAudit({ user: me, action: "SEARCH", object: 'pencarian "beras"' });
    const last = getStore().audit.at(-1)!;
    expect(getStore().audit.length).toBe(before + 1);
    expect(last).toMatchObject({ userId: me.id, action: "SEARCH", result: "SUCCESS" });
    expect(Date.parse(last.at)).not.toBeNaN();
  });

  it("analis hanya melihat aktivitasnya sendiri; peninjau dan admin melihat semuanya", () => {
    logAudit({ user: me, action: "LOGIN", object: "sesi" });
    logAudit({ user: other, action: "LOGIN", object: "sesi" });

    const asAnalyst = listAuditFor({ id: me.id, role: "analyst" });
    expect(asAnalyst.scope).toBe("own");
    expect(asAnalyst.entries.length).toBeGreaterThan(0);
    expect(asAnalyst.entries.every((e) => e.userId === me.id)).toBe(true);

    for (const role of ["reviewer", "admin"] as const) {
      const all = listAuditFor({ id: me.id, role });
      expect(all.scope).toBe("all");
      expect(new Set(all.entries.map((e) => e.userId)).has(other.id)).toBe(true);
    }
  });

  it("mengurutkan dari yang terbaru", () => {
    const { entries } = listAuditFor({ id: me.id, role: "admin" });
    const times = entries.map((e) => e.at);
    expect([...times].sort().reverse()).toEqual(times);
  });
});
