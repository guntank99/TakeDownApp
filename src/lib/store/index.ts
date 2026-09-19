import "server-only";

import { appMode } from "@/lib/config/mode";
import { buildBootstrapAdmin } from "./bootstrap";
import { connectPostgres } from "./connect";
import { createMemoryRepository } from "./memory";
import { createPostgresRepository } from "./postgres";
import type { Repository } from "./repository";

export type { ImportedItem, Repository } from "./repository";

/**
 * Picks the storage for this deployment:
 *   APP_MODE=live + DATABASE_URL → PostgreSQL (real, persistent)
 *   APP_MODE=live, no DATABASE_URL → empty in-memory workspace (NOT persistent)
 *   APP_MODE=demo (default)        → in-memory, seeded with the fictional demo workspace
 */
const g = globalThis as unknown as { __tpRepo?: Promise<Repository> };

async function create(): Promise<Repository> {
  const live = appMode() === "live";
  const url = process.env.DATABASE_URL;
  const repo = live && url ? await createPostgresRepository(connectPostgres(url)) : createMemoryRepository({ seed: !live });

  if (live && (await repo.listUsers()).length === 0) {
    const boot = buildBootstrapAdmin(process.env, await repo.newUserId(), new Date().toISOString());
    if (boot.user) await repo.saveUser(boot.user);
    else if (boot.problem) console.error(`Admin awal tidak dibuat: ${boot.problem}`);
  }
  return repo;
}

export function getRepository(): Promise<Repository> {
  if (!g.__tpRepo) {
    g.__tpRepo = create().catch((error) => {
      g.__tpRepo = undefined; // do not cache a failed start-up
      throw error;
    });
  }
  return g.__tpRepo;
}

/** True when live data would be lost on restart (live mode without a database). */
export const storageIsVolatile = (): boolean => appMode() === "live" && !process.env.DATABASE_URL;

/** Test helper. */
export function resetRepositoryForTests() {
  g.__tpRepo = undefined;
}
