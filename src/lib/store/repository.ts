import type {
  Account,
  AuditLogEntry,
  CaseRecord,
  EvidenceFileMeta,
  EvidenceRecord,
  Post,
  ReportRecord,
  UserRecord,
} from "@/types";

/**
 * Everything the app stores. Two implementations share this contract and the
 * same test-suite: an in-memory one (demo mode, tests) and a PostgreSQL one
 * (live mode). Services never touch storage directly.
 *
 * Semantics: methods return COPIES. To change a record, load it, modify it and
 * call the matching save*() — exactly what a database needs, and it keeps the
 * two implementations from behaving differently.
 */

/** A post/video the team added by URL, with the account it belongs to. */
export interface ImportedItem {
  post: Post;
  account: Account;
}

/** Demo-only report skeletons; their sections are generated on first read. */
export type ReportSeed = Omit<ReportRecord, "sections" | "createdAt" | "updatedAt"> &
  Partial<Pick<ReportRecord, "createdAt" | "updatedAt">>;

export interface Repository {
  readonly kind: "memory" | "postgres";

  listCases(): Promise<CaseRecord[]>;
  getCase(id: string): Promise<CaseRecord | null>;
  saveCase(record: CaseRecord): Promise<void>;
  deleteCase(id: string): Promise<void>;
  newCaseId(): Promise<string>;

  listEvidence(caseId?: string): Promise<EvidenceRecord[]>;
  getEvidence(id: string): Promise<EvidenceRecord | null>;
  saveEvidence(record: EvidenceRecord): Promise<void>;
  deleteEvidence(id: string): Promise<void>;
  newEvidenceId(): Promise<string>;

  /** Uploaded files. Metadata and bytes travel together; listing returns metadata only. */
  listEvidenceFiles(caseId?: string): Promise<EvidenceFileMeta[]>;
  getEvidenceFile(id: string): Promise<{ meta: EvidenceFileMeta; data: Uint8Array } | null>;
  saveEvidenceFile(meta: EvidenceFileMeta, data: Uint8Array): Promise<void>;
  deleteEvidenceFile(id: string): Promise<void>;
  newEvidenceFileId(): Promise<string>;

  listReports(): Promise<ReportRecord[]>;
  getReport(id: string): Promise<ReportRecord | null>;
  saveReport(record: ReportRecord): Promise<void>;
  deleteReport(id: string): Promise<void>;
  newReportId(): Promise<string>;
  /** Only the demo repository has seeds. */
  takeReportSeeds?(): ReportSeed[];

  appendAudit(entry: Omit<AuditLogEntry, "id">): Promise<void>;
  /** Newest first. */
  listAudit(): Promise<AuditLogEntry[]>;

  listUsers(): Promise<UserRecord[]>;
  getUserById(id: string): Promise<UserRecord | null>;
  /** Matches username OR email, case-insensitively. */
  getUserByLogin(login: string): Promise<UserRecord | null>;
  saveUser(record: UserRecord): Promise<void>;
  newUserId(): Promise<string>;

  listImported(): Promise<ImportedItem[]>;
  getImported(postId: string): Promise<ImportedItem | null>;
  saveImported(item: ImportedItem): Promise<void>;
  deleteImported(postId: string): Promise<void>;
}

export const pad = (n: number, width: number) => String(n).padStart(width, "0");
