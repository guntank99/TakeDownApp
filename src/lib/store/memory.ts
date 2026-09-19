import casesJson from "@/data/mock-cases.json";
import evidenceJson from "@/data/mock-evidence.json";
import reportsJson from "@/data/mock-reports.json";
import { hashSnapshot } from "@/lib/evidence/hash";
import type { AuditLogEntry, CaseRecord, EvidenceFileMeta, EvidenceRecord, EvidenceSnapshot, ReportRecord, UserRecord } from "@/types";
import { pad, type ImportedItem, type ReportSeed, type Repository } from "./repository";

const clone = <T>(v: T): T => structuredClone(v);

/** Highest numeric suffix among ids like "CASE-007". */
function maxSuffix(prefix: string, ids: string[]): number {
  return ids.reduce((m, id) => {
    const n = Number(id.slice(prefix.length + 1));
    return id.startsWith(`${prefix}-`) && Number.isFinite(n) ? Math.max(m, n) : m;
  }, 0);
}

interface Options {
  /** Load the fictional demo workspace (cases, evidence, reports, audit history). */
  seed: boolean;
}

/**
 * In-memory repository. State lives only as long as the server process, so it
 * is right for demos and tests and WRONG for real work (use PostgreSQL).
 */
export function createMemoryRepository({ seed }: Options): Repository {
  const cases = new Map<string, CaseRecord>();
  const evidence = new Map<string, EvidenceRecord>();
  const reports = new Map<string, ReportRecord>();
  const files = new Map<string, { meta: EvidenceFileMeta; data: Uint8Array }>();
  const users = new Map<string, UserRecord>();
  const imported = new Map<string, ImportedItem>();
  const audit: AuditLogEntry[] = [];
  let reportSeeds: ReportSeed[] = [];

  if (seed) {
    for (const c of clone(casesJson) as unknown as CaseRecord[]) cases.set(c.id, c);
    for (const e of evidenceJson as unknown as (Omit<EvidenceRecord, "hash"> & { snapshot: EvidenceSnapshot })[]) {
      evidence.set(e.id, { ...clone(e), hash: hashSnapshot(e.snapshot) });
    }
    reportSeeds = clone(reportsJson) as unknown as ReportSeed[];
    audit.push(
      { id: "AUD-0001", at: "2026-09-16T09:00:00Z", userId: "USR-002", userName: "Analis Demo", action: "LOGIN", object: "sesi", caseId: null, result: "SUCCESS" },
      { id: "AUD-0002", at: "2026-09-16T10:00:00Z", userId: "USR-002", userName: "Analis Demo", action: "CREATE_CASE", object: "CASE-001", caseId: "CASE-001", result: "SUCCESS" },
      { id: "AUD-0003", at: "2026-09-16T10:30:00Z", userId: "USR-002", userName: "Analis Demo", action: "CREATE_EVIDENCE", object: "EVD-001", caseId: "CASE-001", result: "SUCCESS" },
      { id: "AUD-0004", at: "2026-09-17T08:00:00Z", userId: "USR-003", userName: "Peninjau Demo", action: "UPDATE_CASE", object: "CASE-004 → Terverifikasi", caseId: "CASE-004", result: "SUCCESS" },
      { id: "AUD-0005", at: "2026-09-12T14:00:00Z", userId: "USR-003", userName: "Peninjau Demo", action: "SUBMIT_REPORT", object: "RPT-001", caseId: "CASE-005", result: "SUCCESS" },
    );
  }

  const counters = { CASE: 0, EVD: 0, RPT: 0, USR: 0, AUD: 0, FIL: 0 };
  const bump = (key: keyof typeof counters, existing: string[]) => {
    counters[key] = Math.max(counters[key], maxSuffix(key, existing)) + 1;
    return counters[key];
  };
  const values = <T>(m: Map<string, T>) => [...m.values()].map(clone);

  return {
    kind: "memory",

    async listCases() { return values(cases); },
    async getCase(id) { const c = cases.get(id); return c ? clone(c) : null; },
    async saveCase(r) { cases.set(r.id, clone(r)); },
    async deleteCase(id) { cases.delete(id); },
    async newCaseId() { return `CASE-${pad(bump("CASE", [...cases.keys()]), 3)}`; },

    async listEvidence(caseId) { return values(evidence).filter((e) => !caseId || e.caseId === caseId); },
    async getEvidence(id) { const e = evidence.get(id); return e ? clone(e) : null; },
    async saveEvidence(r) { evidence.set(r.id, clone(r)); },
    async deleteEvidence(id) { evidence.delete(id); },

    async listEvidenceFiles(caseId) { return [...files.values()].map((f) => clone(f.meta)).filter((m) => !caseId || m.caseId === caseId); },
    async getEvidenceFile(id) { const f = files.get(id); return f ? { meta: clone(f.meta), data: new Uint8Array(f.data) } : null; },
    async saveEvidenceFile(meta, data) { files.set(meta.id, { meta: clone(meta), data: new Uint8Array(data) }); },
    async deleteEvidenceFile(id) { files.delete(id); },
    async newEvidenceFileId() { return `FIL-${pad(bump("FIL", [...files.keys()]), 3)}`; },
    async newEvidenceId() { return `EVD-${pad(bump("EVD", [...evidence.keys()]), 3)}`; },

    async listReports() { return values(reports); },
    async getReport(id) { const r = reports.get(id); return r ? clone(r) : null; },
    async saveReport(r) { reports.set(r.id, clone(r)); },
    async deleteReport(id) { reports.delete(id); },
    async newReportId() {
      // seeds that have not been materialised yet must not collide with new ids
      return `RPT-${pad(bump("RPT", [...reports.keys(), ...reportSeeds.map((s) => s.id)]), 3)}`;
    },
    takeReportSeeds() {
      const out = reportSeeds;
      reportSeeds = [];
      return out;
    },

    async appendAudit(entry) {
      audit.push({ ...clone(entry), id: `AUD-${pad(bump("AUD", audit.map((a) => a.id)), 4)}` });
    },
    async listAudit() { return clone(audit).sort((a, b) => b.at.localeCompare(a.at)); },

    async listUsers() { return values(users); },
    async getUserById(id) { const u = users.get(id); return u ? clone(u) : null; },
    async getUserByLogin(login) {
      const needle = login.trim().toLowerCase();
      const u = [...users.values()].find((x) => x.username.toLowerCase() === needle || x.email.toLowerCase() === needle);
      return u ? clone(u) : null;
    },
    async saveUser(r) {
      const dup = [...users.values()].find((x) => x.id !== r.id && (x.username.toLowerCase() === r.username.toLowerCase() || x.email.toLowerCase() === r.email.toLowerCase()));
      if (dup) throw new Error("Nama pengguna atau email sudah dipakai.");
      users.set(r.id, clone(r));
    },
    async newUserId() { return `USR-${pad(bump("USR", [...users.keys()]), 3)}`; },

    async listImported() { return values(imported); },
    async getImported(id) { const i = imported.get(id); return i ? clone(i) : null; },
    async saveImported(item) { imported.set(item.post.id, clone(item)); },
    async deleteImported(id) { imported.delete(id); },
  };
}

