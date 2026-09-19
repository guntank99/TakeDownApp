import { beforeEach, describe, expect, it } from "vitest";
import { resetRateLimits } from "@/lib/api/rate-limit";
import { MAX_FILE_BYTES, sha256Hex } from "@/lib/evidence/files";
import { getRepository } from "@/lib/store";
import type { SessionUser } from "@/types";
import { createCase, transitionCase } from "./cases";
import { listCaseFiles, readEvidenceFile, removeEvidenceFile, uploadEvidenceFile } from "./evidence-files";
import { deleteCaseCascade } from "./retention";

const analyst: SessionUser = { id: "USR-002", username: "analyst", name: "Analis Demo", role: "analyst" };
const reviewer: SessionUser = { id: "USR-003", username: "reviewer", name: "Peninjau Demo", role: "reviewer" };
const admin: SessionUser = { id: "USR-001", username: "admin", name: "Admin Demo", role: "admin" };

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82, 1, 2, 3]);

async function newCase(): Promise<string> {
  const res = await createCase(analyst, { title: "Kasus berkas", description: "uji berkas bukti", platform: "x", category: "Spam", priority: "low", postIds: [], accountIds: [] });
  if (!res.ok) throw new Error(res.error);
  return res.value.id;
}

beforeEach(() => resetRateLimits());

describe("uploadEvidenceFile", () => {
  it("stores the original bytes with their SHA-256, detected type and size, and records it", async () => {
    const id = await newCase();
    const res = await uploadEvidenceFile(analyst, id, { name: "C:\\fakepath\\layar.png", bytes: PNG }, "tangkapan layar");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toMatchObject({ filename: "layar.png", mime: "image/png", size: PNG.length, sha256: sha256Hex(PNG), uploadedBy: "USR-002", note: "tangkapan layar" });

    const back = await readEvidenceFile(res.value.id);
    expect([...back!.data]).toEqual([...PNG]);
    expect(back!.intact).toBe(true);
    expect((await listCaseFiles(id)).map((f) => f.id)).toEqual([res.value.id]);
    expect((await (await getRepository()).getCase(id))!.timeline.some((t) => t.type === "FILE_UPLOADED")).toBe(true);
  });

  it("decides the type from the bytes: an executable named .png is refused, and so are empty and oversized files", async () => {
    const id = await newCase();
    const exe = new TextEncoder().encode("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00");
    expect(await uploadEvidenceFile(analyst, id, { name: "foto.png", bytes: exe }, "")).toMatchObject({ ok: false, status: 415 });
    expect(await uploadEvidenceFile(analyst, id, { name: "kosong.png", bytes: new Uint8Array() }, "")).toMatchObject({ ok: false });
    const big = new Uint8Array(MAX_FILE_BYTES + 1);
    big.set(PNG);
    expect(await uploadEvidenceFile(analyst, id, { name: "besar.png", bytes: big }, "")).toMatchObject({ ok: false, status: 413 });
  });

  it("only roles that may collect evidence can upload, and closed cases are sealed", async () => {
    const id = await newCase();
    expect(await uploadEvidenceFile(reviewer, id, { name: "a.png", bytes: PNG }, "")).toMatchObject({ ok: false, status: 403 });
    expect(await uploadEvidenceFile(analyst, "CASE-404", { name: "a.png", bytes: PNG }, "")).toMatchObject({ ok: false, status: 404 });
    await transitionCase(analyst, id, "CLOSED");
    expect(await uploadEvidenceFile(analyst, id, { name: "a.png", bytes: PNG }, "")).toMatchObject({ ok: false, status: 409 });
  });

  it("detects tampering: bytes changed after upload no longer match the recorded hash", async () => {
    const id = await newCase();
    const res = await uploadEvidenceFile(analyst, id, { name: "a.png", bytes: PNG }, "");
    if (!res.ok) throw new Error("upload failed");
    const repo = await getRepository();
    const tampered = new Uint8Array(PNG);
    tampered[18] = 99;
    await repo.saveEvidenceFile(res.value, tampered);
    expect((await readEvidenceFile(res.value.id))!.intact).toBe(false);
  });
});

describe("removeEvidenceFile", () => {
  it("uploader or admin may delete; others may not; the hash stays in the audit trail", async () => {
    const id = await newCase();
    const res = await uploadEvidenceFile(analyst, id, { name: "a.png", bytes: PNG }, "");
    if (!res.ok) throw new Error("upload failed");
    expect(await removeEvidenceFile(reviewer, res.value.id)).toMatchObject({ ok: false, status: 403 });
    expect(await removeEvidenceFile(analyst, res.value.id)).toMatchObject({ ok: true });
    expect(await readEvidenceFile(res.value.id)).toBeNull();
    const audit = await (await getRepository()).listAudit();
    expect(audit.some((e) => e.action === "DELETE_EVIDENCE" && e.object.includes(sha256Hex(PNG).slice(0, 12)))).toBe(true);
  });
});

describe("deleteCaseCascade", () => {
  it("admin only, closed cases only, with the id typed; removes everything attached but keeps an accountable trace", async () => {
    const id = await newCase();
    const up = await uploadEvidenceFile(analyst, id, { name: "a.png", bytes: PNG }, "");
    if (!up.ok) throw new Error("upload failed");

    expect(await deleteCaseCascade(analyst, id, id)).toMatchObject({ ok: false, status: 403 });
    expect(await deleteCaseCascade(admin, id, id)).toMatchObject({ ok: false, status: 409 }); // not closed yet
    await transitionCase(analyst, id, "CLOSED");
    expect(await deleteCaseCascade(admin, id, "salah")).toMatchObject({ ok: false, status: 400 });

    const done = await deleteCaseCascade(admin, id, id);
    expect(done).toMatchObject({ ok: true, value: { files: 1 } });
    const repo = await getRepository();
    expect(await repo.getCase(id)).toBeNull();
    expect(await repo.getEvidenceFile(up.value.id)).toBeNull();
    const trace = (await repo.listAudit()).find((e) => e.action === "DELETE_CASE" && e.result === "SUCCESS" && e.object.startsWith(id));
    expect(trace).toBeTruthy();
    expect(trace!.object).not.toMatch(/Kasus berkas/); // no content of the case is kept
  });
});
