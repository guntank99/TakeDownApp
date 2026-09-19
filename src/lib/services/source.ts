import "server-only";

import { getProvider, type SocialMediaProvider } from "@/lib/providers";
import { withImports } from "@/lib/providers/composite";
import { getRepository } from "@/lib/store";

const g = globalThis as unknown as { __tpImportVersion?: number };

/** Bumped whenever a link is added or removed, so cached analysis is rebuilt. */
export const importVersion = (): number => g.__tpImportVersion ?? 0;
export function invalidateAnalysisCache(): void {
  g.__tpImportVersion = importVersion() + 1;
}

/** The base source plus every link the team has added. This is what the app reads. */
export async function getActiveProvider(): Promise<SocialMediaProvider> {
  return withImports(getProvider(), await (await getRepository()).listImported());
}
