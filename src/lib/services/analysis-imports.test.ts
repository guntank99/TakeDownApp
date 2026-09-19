import { describe, expect, it } from "vitest";
import type { SessionUser } from "@/types";
import { getAnalysisContext } from "./analysis";
import { importPost } from "./imports";

const analyst: SessionUser = { id: "USR-002", username: "analyst", name: "Analis Demo", role: "analyst" };
const fetchNothing = (async () => new Response("", { status: 400 })) as typeof fetch;

describe("analysis with links added by the team", () => {
  it("rebuilds the analysis so imported posts and their accounts are analysed, without false account signals", async () => {
    const before = await getAnalysisContext();
    const res = await importPost(analyst, { url: "https://x.com/akun_baru/status/777001", caption: "Cek promo resmi pemerintah, transfer dulu ya #promo" }, { fetch: fetchNothing, now: () => new Date() });
    expect(res.ok).toBe(true);

    const after = await getAnalysisContext();
    expect(after).not.toBe(before);
    const post = after.postById.get("IMP-X-777001");
    expect(post).toBeTruthy();
    expect(after.postAnalysis.get("IMP-X-777001")).toBeTruthy();

    const account = after.accountById.get(post!.authorId)!;
    const analysis = after.accountAnalysis.get(account.id)!;
    // profile numbers are unknown: none of the profile-based signals may be flagged
    const profileKeys = ["age", "frequency", "ratio", "engagement", "repetition", "spike", "completeness"];
    for (const s of analysis.signals.filter((x) => profileKeys.includes(x.key))) {
      expect(s.flagged, s.key).toBe(false);
      expect(s.value).toBe("tidak diketahui");
    }
    expect(analysis.impersonation.detected).toBe(false);
  });
});
