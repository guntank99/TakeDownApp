/**
 * APP_MODE decides what kind of deployment this is:
 *
 *  - "demo" (default): simulated dataset, demo accounts, in-memory workspace.
 *    Nothing here is real; safe to show around.
 *  - "live": no simulated data and no demo accounts. Users come from the
 *    database, workspace records are stored in PostgreSQL (DATABASE_URL), and
 *    content comes from official providers (YouTube API) and from links that
 *    analysts add. This is the mode for real work.
 */
export type AppMode = "demo" | "live";

export function appMode(): AppMode {
  return process.env.APP_MODE === "live" ? "live" : "demo";
}

export const isLive = (): boolean => appMode() === "live";

/**
 * True when the data on screen is simulated. Drives the "DATA MOCK" labels so
 * they can never appear on live data (or be missing on demo data).
 */
export const isSimulatedData = (): boolean => !isLive() && !(process.env.DATA_PROVIDER === "youtube" && Boolean(process.env.YOUTUBE_API_KEY));
