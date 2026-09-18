export type SearchParams = Record<string, string | string[] | undefined>;

/** First value of a query parameter, trimmed; "" when missing. */
export function param(sp: SearchParams, key: string): string {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

/** One of the allowed values, or "" (so garbage in the URL is ignored). */
export function enumParam<T extends string>(sp: SearchParams, key: string, allowed: readonly T[]): T | "" {
  const v = param(sp, key);
  return (allowed as readonly string[]).includes(v) ? (v as T) : "";
}

export function pageParam(sp: SearchParams): number {
  const n = Number.parseInt(param(sp, "page"), 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10_000) : 1;
}

export function paginate<T>(items: T[], page: number, size = 15) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pages);
  return {
    rows: items.slice((current - 1) * size, current * size),
    page: current,
    pages,
    total: items.length,
    size,
  };
}

/** Builds "?a=1&b=2", skipping empty values. */
export function buildQuery(values: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) if (v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}
