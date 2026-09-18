const number = new Intl.NumberFormat("id-ID");
const compact = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 });

export const formatNumber = (n: number) => number.format(n);
export const formatCompact = (n: number) => compact.format(n);
export const formatPercent = (fraction: number, digits = 0) => `${(fraction * 100).toFixed(digits)}%`;

/** Everything is shown in Western Indonesia Time (WIB, UTC+7) so server and browser always agree. */
const dateTime = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const dateOnly = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric" });

/** "17 Sep 2026 16.00 WIB" */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : `${dateTime.format(d)} WIB`;
}

/** "17 Sep 2026" */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dateOnly.format(d);
}

/** Relative time in Indonesian, e.g. "3 jam lalu". */
export function formatAgo(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (Number.isNaN(minutes)) return "—";
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.round(hours / 24)} hari lalu`;
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export const titleCase = (s: string) =>
  s.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
