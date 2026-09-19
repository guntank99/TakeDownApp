import type { Account, AuthenticitySignal, Indicator } from "@/types";
import { IMPERSONATION_NAME_HINTS } from "./lexicon";

/**
 * Authenticity / behaviour signals for one account. Wording is deliberately
 * hedged: an account is "Berpotensi Tidak Autentik" (potentially inauthentic), never "palsu".
 */

export interface AccountContext {
  /** "now" for age calculations (injectable for tests / mock data). */
  now: number;
  /** Average likes+shares+comments per post by this account. */
  avgEngagementPerPost: number;
  /** Largest number of distinct accounts in a near-duplicate group. */
  coordinationAccounts: number;
  /** Neighbouring accounts younger than 90 days. */
  youngNeighbors: number;
}

const DAY = 86_400_000;

export function accountAgeDays(account: Pick<Account, "createdAt">, now: number): number {
  return Math.max(0, Math.floor((now - Date.parse(account.createdAt)) / DAY));
}

function signal(
  key: string,
  label: string,
  value: string,
  weight: number,
  flagged: boolean,
  note: string,
): AuthenticitySignal {
  return { key, label, value, flagged, weight: flagged ? weight : 0, note };
}

/** Signals that describe the account's own behaviour (feeds Behavior Risk). */
export const BEHAVIOR_SIGNAL_KEYS = [
  "age",
  "frequency",
  "ratio",
  "engagement",
  "repetition",
  "spike",
  "completeness",
];

export function authenticitySignals(a: Account, ctx: AccountContext): AuthenticitySignal[] {
  const age = accountAgeDays(a, ctx.now);
  const ratio = a.followers / Math.max(a.following, 1);
  const engagementPerFollower = ctx.avgEngagementPerPost / Math.max(a.followers, 1);

  // Accounts created from a pasted link have no known numbers. Unknown is not evidence:
  // profile-based signals are shown as "tidak diketahui" and never flagged.
  const unknown = a.metricsKnown === false;
  const profile = (key: string, label: string, value: string, weight: number, flagged: boolean, note: string) =>
    unknown ? signal(key, label, "tidak diketahui", weight, false, "Data profil tidak tersedia dari tautan yang ditempel.") : signal(key, label, value, weight, flagged, note);

  return [
    profile("age", "Usia Akun", `${age} hari`, age < 30 ? 10 : 6, age < 90, "Akun yang baru dibuat memiliki rekam jejak yang lebih sedikit."),
    profile("frequency", "Frekuensi Posting", `${a.postsPerDay}/hari`, a.postsPerDay > 20 ? 10 : 5, a.postsPerDay > 10, "Laju posting yang sangat tinggi secara terus-menerus tidak lazim bagi individu."),
    profile("ratio", "Rasio Pengikut/Mengikuti", ratio.toFixed(2), 8, a.following >= 1000 && ratio < 0.1, "Mengikuti banyak akun tetapi hanya memiliki sedikit pengikut."),
    profile("engagement", "Pola Interaksi", `${engagementPerFollower.toFixed(2)} per pengikut`, 4, engagementPerFollower > 0.15, "Interaksi tidak sebanding dengan ukuran audiens."),
    profile("repetition", "Pengulangan Konten", `${Math.round(a.contentRepetition * 100)}%`, a.contentRepetition >= 0.5 ? 12 : 6, a.contentRepetition >= 0.3, "Sering mengulang konten sebelumnya."),
    profile("spike", "Lonjakan Aktivitas", a.activitySpike ? "teramati" : "tidak ada", 6, a.activitySpike, "Aktivitas meningkat tiba-tiba."),
    profile("completeness", "Kelengkapan Profil", `${a.profileCompleteness}%`, a.profileCompleteness < 50 ? 8 : 3, a.profileCompleteness < 70, "Profil publik minim informasi."),
    signal("similarity", "Kemiripan Konten", ctx.coordinationAccounts >= 3 ? "ditemukan teks hampir identik" : "tidak ada", 10, ctx.coordinationAccounts >= 3, "Posting sangat mirip dengan posting akun lain."),
    signal("coordination", "Indikator Koordinasi", `${ctx.coordinationAccounts} akun dalam kelompok`, 8, ctx.coordinationAccounts >= 3, "Memposting teks serupa hampir bersamaan dengan akun lain."),
    signal("network", "Indikator Jaringan", `${ctx.youngNeighbors} tetangga akun baru`, 8, ctx.youngNeighbors >= 3, "Terhubung rapat dengan akun-akun yang baru dibuat."),
  ];
}

const MAX_SIGNAL_WEIGHT = 70;

export function authenticityConcern(signals: AuthenticitySignal[]): number {
  const total = signals.reduce((s, x) => s + x.weight, 0);
  return Math.round(Math.min(100, (total / MAX_SIGNAL_WEIGHT) * 100));
}

/** Behavior-risk points (0–25) from the account's own behaviour signals. */
export function behaviorPoints(signals: AuthenticitySignal[]): number {
  const total = signals
    .filter((s) => BEHAVIOR_SIGNAL_KEYS.includes(s.key))
    .reduce((s, x) => s + x.weight, 0);
  return Math.round(25 * Math.min(1, total / 40));
}

/** Impersonation indicator based on the profile (not on post content). */
export function impersonationIndicator(a: Account, now: number): Indicator {
  const name = a.displayName.toLowerCase();
  const hints = IMPERSONATION_NAME_HINTS.filter((h) => name.includes(h));
  const young = accountAgeDays(a, now) < 90;
  const detected = a.metricsKnown !== false && hints.length > 0 && !a.verified && young;
  return {
    key: "impersonation",
    label: "Indikator Peniruan Identitas",
    detected,
    confidence: detected ? Math.min(0.85, 0.5 + 0.15 * hints.length + (a.profileCompleteness < 60 ? 0.1 : 0)) : 0,
    reason: detected
      ? "Nama tampilan memakai kata bernada otoritas/layanan, sementara akun belum terverifikasi dan baru dibuat."
      : "Tidak ada indikator yang terdeteksi.",
    evidence: detected ? [a.displayName, ...hints] : [],
  };
}
