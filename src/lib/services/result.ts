export type Result<T> = { ok: true; value: T } | { ok: false; error: string; status: number };

export const success = <T>(value: T): Result<T> => ({ ok: true, value });
export const failure = (error: string, status = 400): Result<never> => ({ ok: false, error, status });
