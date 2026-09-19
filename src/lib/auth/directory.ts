import type { Role } from "@/types";

/**
 * Public display info (id → name, role), never credentials. It is refreshed
 * by the server-side auth check (see user-store.ts) so pages can call the
 * synchronous userName() while rendering.
 */
export interface DirectoryEntry {
  id: string;
  name: string;
  role: Role;
}

const g = globalThis as unknown as { __tpDirectory?: Map<string, DirectoryEntry> };
const store = () => (g.__tpDirectory ??= new Map());

export function setDirectory(entries: DirectoryEntry[]) {
  g.__tpDirectory = new Map(entries.map((e) => [e.id, e]));
}

export function listDirectory(): DirectoryEntry[] {
  return [...store().values()];
}

export function userName(id: string | null | undefined): string {
  if (!id) return "—";
  return store().get(id)?.name ?? id;
}
