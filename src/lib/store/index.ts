import "server-only";

import casesJson from "@/data/mock-cases.json";
import evidenceJson from "@/data/mock-evidence.json";
import reportsJson from "@/data/mock-reports.json";
import { hashSnapshot } from "@/lib/evidence/hash";
import type {
  AuditLogEntry,
  CaseRecord,
  EvidenceRecord,
  EvidenceSnapshot,
  ReportRecord,
} from "@/types";

/**
 * PROTOTYPE STORE: in-memory, seeded from JSON. Changes survive only while the
 * server process lives (they reset on restart and on a serverless cold start).
 * Everything talks to this through src/lib/services, so replacing it with
 * PostgreSQL/Supabase later does not touch the UI.
 */

type SeedReport = Omit<ReportRecord, "sections" | "createdAt" | "updatedAt"> & Partial<Pick<ReportRecord, "createdAt" | "updatedAt">>;

export interface Store {
  cases: CaseRecord[];
  evidence: EvidenceRecord[];
  /** Seed reports get their sections built on first read (needs analysis). */
  reports: ReportRecord[];
  reportSeeds: SeedReport[];
  audit: AuditLogEntry[];
}

const g = globalThis as unknown as { __sentinelStore?: Store };

function seed(): Store {
  const cases = structuredClone(casesJson) as unknown as CaseRecord[];
  const evidence = (evidenceJson as unknown as (Omit<EvidenceRecord, "hash"> & { snapshot: EvidenceSnapshot })[]).map(
    (e) => ({ ...structuredClone(e), hash: hashSnapshot(e.snapshot) }),
  );
  const audit: AuditLogEntry[] = [
    { id: "AUD-0001", at: "2026-09-16T09:00:00Z", userId: "USR-002", userName: "Analis Demo", action: "LOGIN", object: "sesi", caseId: null, result: "SUCCESS" },
    { id: "AUD-0002", at: "2026-09-16T10:00:00Z", userId: "USR-002", userName: "Analis Demo", action: "CREATE_CASE", object: "CASE-001", caseId: "CASE-001", result: "SUCCESS" },
    { id: "AUD-0003", at: "2026-09-16T10:30:00Z", userId: "USR-002", userName: "Analis Demo", action: "CREATE_EVIDENCE", object: "EVD-001", caseId: "CASE-001", result: "SUCCESS" },
    { id: "AUD-0004", at: "2026-09-17T08:00:00Z", userId: "USR-003", userName: "Peninjau Demo", action: "UPDATE_CASE", object: "CASE-004 → Terverifikasi", caseId: "CASE-004", result: "SUCCESS" },
    { id: "AUD-0005", at: "2026-09-12T14:00:00Z", userId: "USR-003", userName: "Peninjau Demo", action: "SUBMIT_REPORT", object: "RPT-001", caseId: "CASE-005", result: "SUCCESS" },
  ];
  return {
    cases,
    evidence,
    reports: [],
    reportSeeds: structuredClone(reportsJson) as unknown as SeedReport[],
    audit,
  };
}

export function getStore(): Store {
  return (g.__sentinelStore ??= seed());
}

/** Next id like "CASE-011" given the ids already in use. */
export function nextId(prefix: string, existing: string[], width = 3): string {
  const max = existing.reduce((m, id) => {
    const n = Number(id.slice(prefix.length + 1));
    return Number.isFinite(n) && id.startsWith(`${prefix}-`) ? Math.max(m, n) : m;
  }, 0);
  return `${prefix}-${String(max + 1).padStart(width, "0")}`;
}
