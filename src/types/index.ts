/**
 * Shared domain types.
 *
 * Data governance: OBSERVED data (what a provider returned) is kept separate
 * from AUTOMATED ANALYSIS (computed by src/lib/analysis) and from ANALYST
 * ASSESSMENT / REVIEWED RESULT (cases, reports). Risk scores and sentiment are
 * therefore NOT stored on observed records.
 */

export type Platform =
  | "facebook"
  | "x"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "threads"
  | "reddit"
  | "telegram"
  | "news";

export type Sentiment = "positive" | "neutral" | "negative";

/** 0–24 LOW, 25–49 MEDIUM, 50–74 HIGH, 75–100 CRITICAL. */
export type RiskLevel = "low" | "medium" | "high" | "critical";

/** Where a record came from and how it was collected. */
export interface Provenance {
  source: string;
  collectionMethod: "simulated" | "official_api" | "manual_import";
  collectedAt: string; // ISO 8601
  isMock: boolean;
}

interface Traceable {
  provenance: Provenance;
}

// ---------------------------------------------------------------- observed

export interface Account extends Traceable {
  id: string;
  platform: Platform;
  handle: string;
  displayName: string;
  createdAt: string;
  followers: number;
  following: number;
  verified: boolean;
  /** Average posts per day over the observation window. */
  postsPerDay: number;
  /** 0–100, how complete the public profile is. */
  profileCompleteness: number;
  /** 0–1, share of the account's posts that repeat earlier content. */
  contentRepetition: number;
  /** True when a sudden burst of activity was observed. */
  activitySpike: boolean;
  /**
   * False when the numbers above are unknown (e.g. an account created from a
   * pasted URL). Unknown values are never treated as evidence of anything.
   */
  metricsKnown?: boolean;
}

export type PostStatus = "new" | "needs_review" | "reviewed";
export type MediaType = "text" | "image" | "video" | "link";

export interface Post extends Traceable {
  id: string;
  platform: Platform;
  url: string;
  authorId: string;
  text: string;
  mediaType: MediaType;
  hashtags: string[];
  /** Handles mentioned in the post, e.g. "@example". */
  mentions: string[];
  issueId: string | null;
  claimId: string | null;
  createdAt: string;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  status: PostStatus;
  /** False when engagement metrics are unknown (imported by URL, none entered). */
  metricsKnown?: boolean;
  /** False when createdAt is only the import time. */
  dateKnown?: boolean;
  thumbnailUrl?: string | null;
  /** Analyst note added when the link was collected. */
  note?: string;
  importedBy?: string;
  /** Result of the last manual "is it still online?" check (imported posts only). */
  lastCheck?: { status: "available" | "unavailable" | "unknown"; at: string; by: string };
}

export interface Comment extends Traceable {
  id: string;
  postId: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export type IssueStatus = "active" | "monitoring" | "closed";

export interface Issue extends Traceable {
  id: string;
  title: string;
  hashtag: string;
  platforms: Platform[];
  /** Mention volume for the whole period. */
  volume: number;
  /** Percent change vs the previous period. */
  growth: number;
  /** Daily mention volume, oldest first (7 days). */
  series: number[];
  status: IssueStatus;
  firstDetectedAt: string;
  lastUpdatedAt: string;
}

export type InteractionType = "share" | "quote" | "interaction";

/** Relationship that cannot be derived from post fields (shares, quotes, ...). */
export interface Interaction extends Traceable {
  id: string;
  type: InteractionType;
  sourceAccountId: string;
  targetAccountId: string;
  /** Present for share/quote: the post that was shared or quoted. */
  postId: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------- analysis

export type ReviewStatus = "NEEDS_HUMAN_REVIEW" | "NO_INDICATORS";

export type IndicatorKey =
  | "hate_speech"
  | "harassment"
  | "threat"
  | "spam"
  | "misinformation"
  | "defamation"
  | "impersonation";

export interface SentimentResult {
  sentiment: Sentiment;
  confidence: number; // 0–1
  reason: string;
  keywords: string[];
}

export interface Indicator {
  key: IndicatorKey;
  label: string;
  detected: boolean;
  confidence: number; // 0–1
  reason: string;
  evidence: string[];
}

export interface ContentAnalysis {
  sentiment: SentimentResult;
  /** 0–100 */
  toxicity: number;
  indicators: Record<IndicatorKey, Indicator>;
  flagged: IndicatorKey[];
  status: ReviewStatus;
  engine: string;
}

export interface RiskComponents {
  content: number; // 0–40
  behavior: number; // 0–25
  network: number; // 0–20
  coordination: number; // 0–15
}

export interface RiskAssessment {
  score: number; // 0–100
  level: RiskLevel;
  components: RiskComponents;
  factors: string[];
  confidence: number; // 0–1
}

export interface PolicyMatch {
  ruleId: string;
  platform: Platform;
  category: PolicyCategory;
  rule: string;
  officialUrl: string;
  /** False when the rule text has not been checked against the official source. */
  ruleVerified: boolean;
  confidence: number; // 0–1
  evidence: string[];
  status: "NEEDS_REVIEW";
}

export interface PostAnalysis {
  postId: string;
  content: ContentAnalysis;
  risk: RiskAssessment;
  policyMatches: PolicyMatch[];
  coordinationGroupSize: number;
}

export type CommentCategory =
  | "Positif"
  | "Netral"
  | "Negatif"
  | "Indikator Ujaran Kebencian"
  | "Pelecehan"
  | "Spam"
  | "Indikator Ancaman"
  | "Lainnya";

export interface CommentAnalysis {
  commentId: string;
  category: CommentCategory;
  sentiment: Sentiment;
  toxicity: number;
  confidence: number;
  reason: string;
}

export interface AuthenticitySignal {
  key: string;
  label: string;
  value: string;
  flagged: boolean;
  weight: number;
  note: string;
}

export interface AccountAnalysis {
  accountId: string;
  signals: AuthenticitySignal[];
  /** 0–100, higher = more indicators of inauthentic behaviour. */
  authenticityConcern: number;
  /** Deliberately hedged wording: never "fake". */
  authenticityLabel: "Berpotensi Tidak Autentik" | "Tidak ada kekhawatiran autentisitas yang kuat";
  risk: RiskAssessment;
  degreeCentrality: number;
  networkRole: NetworkRole | null;
  impersonation: Indicator;
}

export type ClaimVerdict =
  | "verified"
  | "likely_accurate"
  | "unverified"
  | "disputed"
  | "likely_false";

export interface ClaimAssessment {
  id: string;
  claimId: string;
  verdict: ClaimVerdict;
  confidence: number; // 0–1
  evidence: string[];
  sources: { name: string; url: string; reliability: "high" | "medium" | "low" | "unknown" }[];
  assessedAt: string;
  reviewer: string | null;
}

export interface Claim extends Traceable {
  id: string;
  text: string;
  extractedFromPostId: string;
  assessment: ClaimAssessment | null;
}

// ------------------------------------------------------------------ news

/** One headline from a publisher's official RSS feed. Only title, snippet and link are kept. */
export interface NewsItem {
  id: string;
  title: string;
  link: string;
  source: string; // outlet name, e.g. "Antara"
  publishedAt: string; // ISO 8601
  summary: string;
}

/** The same story reported by several outlets (grouped automatically, may be imperfect). */
export interface NewsCluster {
  id: string;
  headline: string;
  items: NewsItem[];
  outlets: string[];
  firstAt: string;
  latestAt: string;
}

// ------------------------------------------------------------------- SNA

export type NodeType = "account" | "post" | "hashtag" | "topic";
export type EdgeType =
  | "mention"
  | "reply"
  | "share"
  | "quote"
  | "hashtag"
  | "interaction";

export interface NetNode {
  id: string;
  type: NodeType;
  label: string;
  platform?: Platform;
}

export interface NetEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  weight: number;
}

export interface NetworkGraph {
  nodes: NetNode[];
  edges: NetEdge[];
}

/** Neutral wording only; never "mastermind", "controller" or "main culprit". */
export type NetworkRole = "Akun Sangat Terhubung" | "Potensi Hub Jaringan";

export interface NodeMetrics {
  id: string;
  degree: number;
  degreeCentrality: number;
  betweenness: number;
  community: number;
}

export interface ClusterSummary {
  index: number;
  name: string; // "Cluster A"
  nodeCount: number;
  dominantTopic: string | null;
  dominantHashtags: string[];
  sentiment: Record<Sentiment, number>;
  platforms: Partial<Record<Platform, number>>;
  importantNodes: { id: string; label: string; degree: number }[];
}

export interface NetworkAnalysis {
  graph: NetworkGraph;
  metrics: Record<string, NodeMetrics>;
  density: number;
  clusters: ClusterSummary[];
  roles: Record<string, NetworkRole>;
  positions: Record<string, { x: number; y: number }>;
}

// ------------------------------------------------------------------- ToC

export type PolicyCategory =
  | "Hate Speech"
  | "Harassment"
  | "Threats"
  | "Violence"
  | "Spam"
  | "Impersonation"
  | "Fraud"
  | "Misinformation"
  | "Privacy"
  | "Copyright"
  | "Adult Content"
  | "Platform Manipulation"
  | "Other";

export type Severity = "low" | "medium" | "high";

export interface PolicyRule {
  id: string;
  platform: Platform;
  category: PolicyCategory;
  rule: string;
  description: string;
  evidenceRequirement: string;
  severity: Severity;
  policyVersion: string;
  officialUrl: string;
  lastUpdated: string;
  /** Where the entry stands with respect to the official source. */
  verification: "verified_against_official_source" | "needs_verification";
}

export interface PlatformReportingInfo {
  platform: Platform;
  /** Official reporting page. Empty when the platform has no such mechanism. */
  officialReportingUrl: string;
  policyIndexUrl: string;
  /** No authorized submission API is integrated; reports go through the official page. */
  apiSubmissionAvailable: false;
  /** Note shown to the analyst next to the link. */
  note: string;
}

// -------------------------------------------------------- workspace / cases

export type CaseStatus =
  | "OPEN"
  | "INVESTIGATING"
  | "NEEDS_REVIEW"
  | "VERIFIED"
  | "REPORTED"
  | "CLOSED";

export type Priority = "low" | "medium" | "high" | "critical";

export interface CaseNote {
  id: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export interface CaseTimelineEvent {
  id: string;
  at: string;
  actorId: string;
  type: string;
  message: string;
}

export interface CaseRecord {
  id: string;
  title: string;
  description: string;
  platform: Platform;
  category: PolicyCategory;
  priority: Priority;
  status: CaseStatus;
  analystId: string;
  reviewerId: string | null;
  createdAt: string;
  updatedAt: string;
  postIds: string[];
  accountIds: string[];
  notes: CaseNote[];
  timeline: CaseTimelineEvent[];
}

export interface EvidenceSnapshot {
  postId: string | null;
  accountHandle: string | null;
  platform: Platform;
  text: string;
  postedAt: string | null;
  metrics: { likes: number; comments: number; shares: number; views: number } | null;
  capturedFrom: string; // provenance source label
}

export interface EvidenceRecord {
  id: string;
  caseId: string;
  url: string;
  postId: string | null;
  accountId: string | null;
  capturedAt: string;
  /** Free-text reference to an externally stored screenshot, if any. */
  screenshotRef: string | null;
  snapshot: EvidenceSnapshot;
  /** SHA-256 of the canonical JSON of `snapshot`. */
  hash: string;
  source: string;
  collectedBy: string;
}

/** A file attached to a case (screenshot, video, document). Bytes are stored separately from this record. */
export interface EvidenceFileMeta {
  id: string;
  caseId: string;
  /** Name as uploaded (display only; never used as a path). */
  filename: string;
  /** Detected from the file's own bytes, not from what the browser claimed. */
  mime: string;
  size: number;
  /** SHA-256 of the original bytes. */
  sha256: string;
  uploadedBy: string;
  uploadedAt: string;
  note?: string;
}

export type ReportStatus = "draft" | "in_review" | "approved" | "submitted";

export interface ReportSection {
  title: string;
  body: string[];
}

/** What the platform (or authority) did after the report. Recorded by a person. */
export type TakedownOutcome = "pending" | "removed" | "restricted" | "rejected" | "no_action";

export interface AvailabilityCheck {
  checkedAt: string;
  checkedBy: string;
  status: "available" | "unavailable" | "unknown";
  detail: string;
}

export interface ReportSubmission {
  platform: Platform;
  method: "official_page" | "authorized_api";
  submittedAt: string;
  submittedBy: string;
  status: "SUBMITTED";
  /** Absent on older records: treated as "pending". */
  outcome?: TakedownOutcome;
  outcomeNote?: string;
  outcomeAt?: string;
  outcomeBy?: string;
  lastCheck?: AvailabilityCheck;
}

export interface ReportRecord {
  id: string;
  caseId: string;
  title: string;
  status: ReportStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** Frozen at creation time so the report reflects what the reviewer saw. */
  sections: ReportSection[];
  reviewerNotes: string;
  recommendedAction: string;
  approvedBy: string | null;
  submission: ReportSubmission | null;
}

export type AuditAction =
  | "LOGIN"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "CREATE_CASE"
  | "UPDATE_CASE"
  | "ANALYZE_POST"
  | "ANALYZE_ACCOUNT"
  | "CREATE_EVIDENCE"
  | "GENERATE_REPORT"
  | "UPDATE_REPORT"
  | "EXPORT_REPORT"
  | "SEARCH"
  | "IMPORT_POST"
  | "DELETE_POST"
  | "CHECK_AVAILABILITY"
  | "UPLOAD_EVIDENCE"
  | "DELETE_EVIDENCE"
  | "DELETE_CASE"
  | "EXPORT_PACKAGE"
  | "RECORD_OUTCOME"
  | "CREATE_USER"
  | "UPDATE_USER"
  | "CHANGE_PASSWORD"
  | "SUBMIT_REPORT"
  | "UPDATE_POLICY";

export interface AuditLogEntry {
  id: string;
  at: string;
  userId: string;
  userName: string;
  action: AuditAction;
  object: string;
  caseId: string | null;
  result: "SUCCESS" | "DENIED" | "FAILED";
}

// ------------------------------------------------------------------ auth

export type Role = "admin" | "analyst" | "reviewer";

/** A stored user. The password hash never leaves the server. */
export interface UserRecord extends SessionUserBase {
  email: string;
  passwordHash: string;
  active: boolean;
  createdAt: string;
}

interface SessionUserBase {
  id: string;
  username: string;
  name: string;
  role: Role;
}

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: Role;
}
