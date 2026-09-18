/** Current time in ms. Kept in a helper so server components read the clock once per request, in one place. */
export const nowMs = (): number => Date.now();
