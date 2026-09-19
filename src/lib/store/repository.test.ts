import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Account, CaseRecord, EvidenceRecord, Post, ReportRecord, UserRecord } from "@/types";
import { connectPostgres } from "./connect";
import { createMemoryRepository } from "./memory";
import { createPostgresRepository, type SqlClient } from "./postgres";
import type { Repository } from "./repository";

/** PGlite is a real PostgreSQL engine running in-process. */
function pgliteClient(db: PGlite): SqlClient {
  return { async query(text, params) { return (await db.query(text, params as unknown[])).rows as never; } };
}

const iso = "2026-09-19T10:00:00.000Z";
const prov = { source: "t", collectionMethod: "manual_import" as const, collectedAt: iso, isMock: false };
const theCase = (id: string, updatedAt = iso): CaseRecord => ({
  id, title: `Kasus ${id}`, description: "d", platform: "x", category: "Spam", priority: "low", status: "OPEN",
  analystId: "USR-002", reviewerId: null, createdAt: iso, updatedAt, postIds: ["P1"], accountIds: ["A1"], notes: [], timeline: [],
});
const evidence = (id: string, caseId: string, at = iso): EvidenceRecord => ({
  id, caseId, url: "u", postId: "P1", accountId: "A1", capturedAt: at, screenshotRef: null, hash: "h", source: "s", collectedBy: "USR-002",
  snapshot: { postId: "P1", accountHandle: "@a", platform: "x", text: "t", postedAt: iso, metrics: null, capturedFrom: "s" },
});
const report = (id: string, caseId: string): ReportRecord => ({
  id, caseId, title: "Laporan", status: "draft", createdBy: "USR-002", createdAt: iso, updatedAt: iso,
  sections: [{ title: "S", body: ["b"] }], reviewerNotes: "", recommendedAction: "", approvedBy: null, submission: null,
});
const user = (id: string, username: string, email: string): UserRecord => ({
  id, username, email, name: username, role: "analyst", passwordHash: "$2b$10$x", active: true, createdAt: iso,
});
const imported = (id: string) => ({
  post: { id, platform: "youtube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", authorId: `A-${id}`, text: "judul", mediaType: "video", hashtags: [], mentions: [], issueId: null, claimId: null, createdAt: iso, likes: 0, comments: 0, shares: 0, views: 0, status: "new", provenance: prov } as Post,
  account: { id: `A-${id}`, platform: "youtube", handle: "@kanal", displayName: "Kanal", createdAt: iso, followers: 0, following: 0, verified: false, postsPerDay: 0, profileCompleteness: 0, contentRepetition: 0, activitySpike: false, metricsKnown: false, provenance: prov } as Account,
});

let pg: PGlite;
let server: PGLiteSocketServer;
const SOCKET_PORT = 54331;
let driver: SqlClient | undefined;
beforeAll(async () => {
  pg = new PGlite();
  // The production driver (postgres.js) talking to a real PostgreSQL wire-protocol server.
  server = new PGLiteSocketServer({ db: pg, port: SOCKET_PORT, host: "127.0.0.1" });
  await server.start();
});
afterAll(async () => {
  await server.stop();
});

const factories: [string, () => Promise<Repository>][] = [
  ["memory", async () => createMemoryRepository({ seed: false })],
  ["postgres (PGlite)", async () => {
    // fresh schema per repository so tests stay independent
    await pg.exec("DROP SCHEMA IF EXISTS thepower CASCADE");
    return createPostgresRepository(pgliteClient(pg));
  }],
  // Regression guard: postgres.js encodes a string bound to a jsonb parameter as a JSON *string*
  // (double encoding). PGlite does not, so only this factory can catch it.
  ["postgres (postgres.js driver)", async () => {
    await pg.exec("DROP SCHEMA IF EXISTS thepower CASCADE");
    // one connection for the whole suite: PGlite serves a single client at a time
    driver ??= connectPostgres(`postgres://postgres:postgres@127.0.0.1:${SOCKET_PORT}/postgres`);
    return createPostgresRepository(driver);
  }],
];

describe.each(factories)("repository: %s", (_name, make) => {
  it("kasus: simpan, ambil, perbarui, urut menurut pembaruan terbaru", async () => {
    const repo = await make();
    expect(await repo.getCase("CASE-001")).toBeNull();
    await repo.saveCase(theCase("CASE-001", "2026-09-19T10:00:00.000Z"));
    await repo.saveCase(theCase("CASE-002", "2026-09-19T12:00:00.000Z"));
    const c = (await repo.getCase("CASE-001"))!;
    expect(c.title).toBe("Kasus CASE-001");
    c.status = "INVESTIGATING";
    c.notes.push({ id: "N1", authorId: "U", text: "catatan", createdAt: iso });
    await repo.saveCase(c);
    expect((await repo.getCase("CASE-001"))!.status).toBe("INVESTIGATING");
    expect((await repo.getCase("CASE-001"))!.notes).toHaveLength(1);
    expect((await repo.listCases()).length).toBe(2);
  });

  it("mengembalikan salinan: mengubah objek tanpa menyimpan tidak berpengaruh", async () => {
    const repo = await make();
    await repo.saveCase(theCase("CASE-001"));
    const c = (await repo.getCase("CASE-001"))!;
    c.title = "DIUBAH TANPA SIMPAN";
    expect((await repo.getCase("CASE-001"))!.title).toBe("Kasus CASE-001");
  });

  it("id berurutan dan tidak pernah bentrok", async () => {
    const repo = await make();
    const ids = await Promise.all([repo.newCaseId(), repo.newCaseId(), repo.newCaseId()]);
    expect(new Set(ids).size).toBe(3);
    expect(ids.every((i) => /^CASE-\d{3}$/.test(i))).toBe(true);
    expect(await repo.newEvidenceId()).toBe("EVD-001");
    expect(await repo.newReportId()).toBe("RPT-001");
    expect(await repo.newUserId()).toBe("USR-001");
  });

  it("bukti dapat difilter per kasus", async () => {
    const repo = await make();
    await repo.saveEvidence(evidence("EVD-001", "CASE-001"));
    await repo.saveEvidence(evidence("EVD-002", "CASE-002"));
    expect((await repo.listEvidence("CASE-001")).map((e) => e.id)).toEqual(["EVD-001"]);
    expect((await repo.listEvidence()).length).toBe(2);
    expect((await repo.getEvidence("EVD-002"))!.snapshot.text).toBe("t");
  });

  it("laporan: JSON bersarang (bagian, pengajuan) tersimpan utuh", async () => {
    const repo = await make();
    const r = report("RPT-001", "CASE-001");
    r.submission = { platform: "x", method: "official_page", submittedAt: iso, submittedBy: "USR-003", status: "SUBMITTED", outcome: "removed", lastCheck: { checkedAt: iso, checkedBy: "USR-003", status: "unavailable", detail: "404" } };
    await repo.saveReport(r);
    const back = (await repo.getReport("RPT-001"))!;
    expect(back.sections[0].body).toEqual(["b"]);
    expect(back.submission?.outcome).toBe("removed");
    expect(back.submission?.lastCheck?.status).toBe("unavailable");
  });

  it("audit: append-only dengan id berurutan dan terbaru lebih dulu", async () => {
    const repo = await make();
    await repo.appendAudit({ at: "2026-09-19T10:00:00.000Z", userId: "U1", userName: "A", action: "LOGIN", object: "sesi", caseId: null, result: "SUCCESS" });
    await repo.appendAudit({ at: "2026-09-19T11:00:00.000Z", userId: "U2", userName: "B", action: "SEARCH", object: "q", caseId: null, result: "SUCCESS" });
    const list = await repo.listAudit();
    expect(list.map((e) => e.userId)).toEqual(["U2", "U1"]);
    expect(list.map((e) => e.id)).toEqual(["AUD-0002", "AUD-0001"]);
  });

  it("pengguna: cari lewat nama pengguna atau email tanpa peka huruf besar, dan tolak duplikat", async () => {
    const repo = await make();
    await repo.saveUser(user("USR-001", "Budi", "Budi@Contoh.Test"));
    expect((await repo.getUserByLogin("budi"))!.id).toBe("USR-001");
    expect((await repo.getUserByLogin("BUDI@contoh.test"))!.id).toBe("USR-001");
    expect(await repo.getUserByLogin("tidak-ada")).toBeNull();
    await expect(repo.saveUser(user("USR-002", "budi", "lain@contoh.test"))).rejects.toThrow(/sudah dipakai/);
    await expect(repo.saveUser(user("USR-003", "lain", "BUDI@contoh.test"))).rejects.toThrow(/sudah dipakai/);
    const u = (await repo.getUserById("USR-001"))!;
    u.active = false;
    await repo.saveUser(u);
    expect((await repo.getUserById("USR-001"))!.active).toBe(false);
  });

  it("hapus kasus, bukti, dan laporan", async () => {
    const repo = await make();
    await repo.saveCase(theCase("CASE-001"));
    await repo.saveEvidence(evidence("EVD-001", "CASE-001"));
    await repo.saveReport(report("RPT-001", "CASE-001"));
    await repo.deleteEvidence("EVD-001");
    await repo.deleteReport("RPT-001");
    await repo.deleteCase("CASE-001");
    expect(await repo.getCase("CASE-001")).toBeNull();
    expect(await repo.getEvidence("EVD-001")).toBeNull();
    expect(await repo.getReport("RPT-001")).toBeNull();
    await repo.deleteCase("CASE-404"); // menghapus yang tidak ada tidak error
  });

  it("berkas bukti: byte tersimpan utuh (termasuk byte biner), daftar hanya metadata, bisa dihapus", async () => {
    const repo = await make();
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 255, 128, 10, 13]);
    const id = await repo.newEvidenceFileId();
    expect(id).toBe("FIL-001");
    const meta = { id, caseId: "CASE-001", filename: "bukti.png", mime: "image/png", size: bytes.length, sha256: "abc", uploadedBy: "USR-002", uploadedAt: iso };
    await repo.saveEvidenceFile(meta, bytes);
    await repo.saveEvidenceFile({ ...meta, id: "FIL-002", caseId: "CASE-002" }, bytes);
    const got = (await repo.getEvidenceFile(id))!;
    expect([...got.data]).toEqual([...bytes]);
    expect(got.meta).toMatchObject({ filename: "bukti.png", mime: "image/png", size: 9 });
    const listed = await repo.listEvidenceFiles("CASE-001");
    expect(listed.map((m) => m.id)).toEqual(["FIL-001"]);
    expect(listed[0]).not.toHaveProperty("data");
    expect((await repo.listEvidenceFiles()).length).toBe(2);
    await repo.deleteEvidenceFile(id);
    expect(await repo.getEvidenceFile(id)).toBeNull();
  });

  it("konten hasil impor: simpan, ambil, perbarui, hapus", async () => {
    const repo = await make();
    await repo.saveImported(imported("IMP-YOUTUBE-aaaa"));
    await repo.saveImported(imported("IMP-YOUTUBE-bbbb"));
    expect((await repo.listImported()).length).toBe(2);
    const item = (await repo.getImported("IMP-YOUTUBE-aaaa"))!;
    expect(item.account.metricsKnown).toBe(false);
    item.post.note = "dicatat";
    await repo.saveImported(item);
    expect((await repo.getImported("IMP-YOUTUBE-aaaa"))!.post.note).toBe("dicatat");
    await repo.deleteImported("IMP-YOUTUBE-aaaa");
    expect(await repo.getImported("IMP-YOUTUBE-aaaa")).toBeNull();
  });
});

describe("skema PostgreSQL", () => {
  it("idempoten dan mengaktifkan Row Level Security pada semua tabel", async () => {
    await pg.exec("DROP SCHEMA IF EXISTS thepower CASCADE");
    const db = pgliteClient(pg);
    await createPostgresRepository(db);
    await createPostgresRepository(db); // dijalankan dua kali: tidak boleh gagal
    const rows = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'thepower' AND c.relkind = 'r'`,
    );
    expect(rows.length).toBe(8);
    expect(rows.every((r) => r.relrowsecurity === true)).toBe(true);
  });
});
