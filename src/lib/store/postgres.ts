import type { AuditLogEntry, CaseRecord, EvidenceFileMeta, EvidenceRecord, ReportRecord, UserRecord } from "@/types";
import { pad, type ImportedItem, type Repository } from "./repository";

/**
 * PostgreSQL repository. It talks to the database through a tiny SqlClient so
 * the same code runs against `postgres` (production), and PGlite (tests, a
 * real Postgres engine in-process).
 *
 * Security notes for hosted Postgres (e.g. Supabase):
 *  - Tables live in their own schema (`thepower`), which the platform's public
 *    REST API does not expose.
 *  - Row Level Security is enabled with no policies, so even if the schema
 *    were exposed, the anonymous role could read nothing. The server connects
 *    with the database owner role, which is not subject to RLS.
 */
export interface SqlClient {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

const S = "thepower";

const SCHEMA_STATEMENTS = [
  `CREATE SCHEMA IF NOT EXISTS ${S}`,
  `CREATE TABLE IF NOT EXISTS ${S}.counters (name text PRIMARY KEY, value integer NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ${S}.app_users (
     id text PRIMARY KEY, username text NOT NULL, email text NOT NULL, name text NOT NULL,
     role text NOT NULL, password_hash text NOT NULL, active boolean NOT NULL DEFAULT true, created_at text NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS app_users_username_key ON ${S}.app_users (lower(username))`,
  `CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_key ON ${S}.app_users (lower(email))`,
  `CREATE TABLE IF NOT EXISTS ${S}.cases (id text PRIMARY KEY, updated_at text NOT NULL, data jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ${S}.evidence (id text PRIMARY KEY, case_id text NOT NULL, captured_at text NOT NULL, data jsonb NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS evidence_case_idx ON ${S}.evidence (case_id)`,
  `CREATE TABLE IF NOT EXISTS ${S}.reports (id text PRIMARY KEY, case_id text NOT NULL, created_at text NOT NULL, data jsonb NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS ${S}.audit_logs (id text PRIMARY KEY, at text NOT NULL, user_id text NOT NULL, data jsonb NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS audit_logs_at_idx ON ${S}.audit_logs (at DESC)`,
  // File bytes are kept as base64 text so every driver handles them the same way.
  `CREATE TABLE IF NOT EXISTS ${S}.evidence_files (id text PRIMARY KEY, case_id text NOT NULL, data jsonb NOT NULL, content_b64 text NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS evidence_files_case_idx ON ${S}.evidence_files (case_id)`,
  `CREATE TABLE IF NOT EXISTS ${S}.imported_posts (id text PRIMARY KEY, created_at text NOT NULL, data jsonb NOT NULL)`,
  ...["counters", "app_users", "cases", "evidence", "reports", "audit_logs", "imported_posts", "evidence_files"].map(
    (t) => `ALTER TABLE ${S}.${t} ENABLE ROW LEVEL SECURITY`,
  ),
];

/** Idempotent: safe to run on every cold start. */
export async function ensureSchema(db: SqlClient): Promise<void> {
  for (const statement of SCHEMA_STATEMENTS) await db.query(statement);
}

const json = (v: unknown) => JSON.stringify(v);

interface UserRow {
  id: string;
  username: string;
  email: string;
  name: string;
  role: UserRecord["role"];
  password_hash: string;
  active: boolean;
  created_at: string;
}
const toUser = (r: UserRow): UserRecord => ({
  id: r.id, username: r.username, email: r.email, name: r.name, role: r.role,
  passwordHash: r.password_hash, active: r.active, createdAt: r.created_at,
});

export async function createPostgresRepository(db: SqlClient): Promise<Repository> {
  await ensureSchema(db);

  /** Atomic counter: safe with several server instances at once. */
  async function next(name: string, width: number): Promise<string> {
    const rows = await db.query<{ value: number }>(
      `INSERT INTO ${S}.counters (name, value) VALUES ($1, 1)
       ON CONFLICT (name) DO UPDATE SET value = ${S}.counters.value + 1 RETURNING value`,
      [name],
    );
    return `${name}-${pad(Number(rows[0].value), width)}`;
  }
  const data = async <T>(text: string, params: unknown[] = []): Promise<T[]> =>
    (await db.query<{ data: T }>(text, params)).map((r) => r.data);
  const one = async <T>(text: string, params: unknown[]): Promise<T | null> => (await data<T>(text, params))[0] ?? null;

  return {
    kind: "postgres",

    listCases: () => data<CaseRecord>(`SELECT data FROM ${S}.cases ORDER BY updated_at DESC`),
    getCase: (id) => one<CaseRecord>(`SELECT data FROM ${S}.cases WHERE id = $1`, [id]),
    async saveCase(r) {
      await db.query(
        `INSERT INTO ${S}.cases (id, updated_at, data) VALUES ($1, $2, $3::text::jsonb)
         ON CONFLICT (id) DO UPDATE SET updated_at = EXCLUDED.updated_at, data = EXCLUDED.data`,
        [r.id, r.updatedAt, json(r)],
      );
    },
    async deleteCase(id) {
      await db.query(`DELETE FROM ${S}.cases WHERE id = $1`, [id]);
    },
    newCaseId: () => next("CASE", 3),

    listEvidence: (caseId) =>
      caseId
        ? data<EvidenceRecord>(`SELECT data FROM ${S}.evidence WHERE case_id = $1 ORDER BY captured_at DESC`, [caseId])
        : data<EvidenceRecord>(`SELECT data FROM ${S}.evidence ORDER BY captured_at DESC`),
    getEvidence: (id) => one<EvidenceRecord>(`SELECT data FROM ${S}.evidence WHERE id = $1`, [id]),
    async saveEvidence(r) {
      await db.query(
        `INSERT INTO ${S}.evidence (id, case_id, captured_at, data) VALUES ($1, $2, $3, $4::text::jsonb)
         ON CONFLICT (id) DO UPDATE SET case_id = EXCLUDED.case_id, captured_at = EXCLUDED.captured_at, data = EXCLUDED.data`,
        [r.id, r.caseId, r.capturedAt, json(r)],
      );
    },
    async deleteEvidence(id) {
      await db.query(`DELETE FROM ${S}.evidence WHERE id = $1`, [id]);
    },
    newEvidenceId: () => next("EVD", 3),

    listEvidenceFiles: (caseId) =>
      caseId
        ? data<EvidenceFileMeta>(`SELECT data FROM ${S}.evidence_files WHERE case_id = $1 ORDER BY id`, [caseId])
        : data<EvidenceFileMeta>(`SELECT data FROM ${S}.evidence_files ORDER BY id`),
    async getEvidenceFile(id) {
      const rows = await db.query<{ data: EvidenceFileMeta; content_b64: string }>(`SELECT data, content_b64 FROM ${S}.evidence_files WHERE id = $1`, [id]);
      return rows[0] ? { meta: rows[0].data, data: new Uint8Array(Buffer.from(rows[0].content_b64, "base64")) } : null;
    },
    async saveEvidenceFile(meta, bytes) {
      await db.query(
        `INSERT INTO ${S}.evidence_files (id, case_id, data, content_b64) VALUES ($1, $2, $3::text::jsonb, $4)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, content_b64 = EXCLUDED.content_b64`,
        [meta.id, meta.caseId, json(meta), Buffer.from(bytes).toString("base64")],
      );
    },
    async deleteEvidenceFile(id) {
      await db.query(`DELETE FROM ${S}.evidence_files WHERE id = $1`, [id]);
    },
    newEvidenceFileId: () => next("FIL", 3),

    listReports: () => data<ReportRecord>(`SELECT data FROM ${S}.reports ORDER BY created_at DESC`),
    getReport: (id) => one<ReportRecord>(`SELECT data FROM ${S}.reports WHERE id = $1`, [id]),
    async saveReport(r) {
      await db.query(
        `INSERT INTO ${S}.reports (id, case_id, created_at, data) VALUES ($1, $2, $3, $4::text::jsonb)
         ON CONFLICT (id) DO UPDATE SET case_id = EXCLUDED.case_id, data = EXCLUDED.data`,
        [r.id, r.caseId, r.createdAt, json(r)],
      );
    },
    async deleteReport(id) {
      await db.query(`DELETE FROM ${S}.reports WHERE id = $1`, [id]);
    },
    newReportId: () => next("RPT", 3),

    async appendAudit(entry) {
      const id = await next("AUD", 4);
      const full: AuditLogEntry = { ...entry, id };
      await db.query(`INSERT INTO ${S}.audit_logs (id, at, user_id, data) VALUES ($1, $2, $3, $4::text::jsonb)`, [id, entry.at, entry.userId, json(full)]);
    },
    listAudit: () => data<AuditLogEntry>(`SELECT data FROM ${S}.audit_logs ORDER BY at DESC, id DESC`),

    async listUsers() {
      return (await db.query<UserRow>(`SELECT * FROM ${S}.app_users ORDER BY created_at, id`)).map(toUser);
    },
    async getUserById(id) {
      const rows = await db.query<UserRow>(`SELECT * FROM ${S}.app_users WHERE id = $1`, [id]);
      return rows[0] ? toUser(rows[0]) : null;
    },
    async getUserByLogin(login) {
      const rows = await db.query<UserRow>(
        `SELECT * FROM ${S}.app_users WHERE lower(username) = lower($1) OR lower(email) = lower($1) LIMIT 1`,
        [login.trim()],
      );
      return rows[0] ? toUser(rows[0]) : null;
    },
    async saveUser(u) {
      try {
        await db.query(
          `INSERT INTO ${S}.app_users (id, username, email, name, role, password_hash, active, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, email = EXCLUDED.email, name = EXCLUDED.name,
             role = EXCLUDED.role, password_hash = EXCLUDED.password_hash, active = EXCLUDED.active`,
          [u.id, u.username, u.email, u.name, u.role, u.passwordHash, u.active, u.createdAt],
        );
      } catch (error) {
        if (/unique|duplicate/i.test(error instanceof Error ? error.message : "")) throw new Error("Nama pengguna atau email sudah dipakai.");
        throw error;
      }
    },
    newUserId: () => next("USR", 3),

    listImported: () => data<ImportedItem>(`SELECT data FROM ${S}.imported_posts ORDER BY created_at DESC`),
    getImported: (id) => one<ImportedItem>(`SELECT data FROM ${S}.imported_posts WHERE id = $1`, [id]),
    async saveImported(item) {
      await db.query(
        `INSERT INTO ${S}.imported_posts (id, created_at, data) VALUES ($1, $2, $3::text::jsonb)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
        [item.post.id, item.post.provenance.collectedAt, json(item)],
      );
    },
    async deleteImported(id) {
      await db.query(`DELETE FROM ${S}.imported_posts WHERE id = $1`, [id]);
    },
  };
}
