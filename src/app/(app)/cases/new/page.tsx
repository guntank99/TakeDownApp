import type { Metadata } from "next";
import { createCaseAction } from "@/app/(app)/actions";
import { Card, Flash, PageHeader } from "@/components/ui/layout";
import { requireRole } from "@/lib/auth/dal";
import { getAnalysisContext } from "@/lib/services/analysis";
import { POLICY_CATEGORY_LABEL, PRIORITY_LABEL } from "@/lib/i18n/labels";
import { param } from "@/lib/utils/params";
import { PLATFORMS, PLATFORM_LABEL } from "@/lib/utils/platforms";
import { POLICY_CATEGORIES, PRIORITIES } from "@/lib/validation/schemas";

export const metadata: Metadata = { title: "Kasus baru" };

const field = "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500";

export default async function NewCasePage({ searchParams }: PageProps<"/cases/new">) {
  await requireRole("admin", "analyst");
  const sp = await searchParams;
  const postId = param(sp, "post").slice(0, 64);
  const ctx = await getAnalysisContext();
  const post = postId ? ctx.postById.get(postId) : undefined;
  const analysis = post ? ctx.postAnalysis.get(post.id) : undefined;
  const suggestedCategory = analysis?.policyMatches[0]?.category ?? "Other";

  return (
    <div className="max-w-3xl">
      <PageHeader title="Kasus baru" description="Jelaskan hal yang Anda selidiki. Postingan dapat dilampirkan sekarang atau nanti, dan bukti dapat diambil dari halaman kasus." />
      <Flash searchParams={sp} />
      <Card>
        <form action={createCaseAction} className="space-y-4">
          <div>
            <label htmlFor="title" className="mb-1 block text-sm text-slate-300">Judul</label>
            <input id="title" name="title" required minLength={3} maxLength={140} className={field} placeholder="Deskripsi singkat dan faktual" />
          </div>
          <div>
            <label htmlFor="description" className="mb-1 block text-sm text-slate-300">Deskripsi</label>
            <textarea id="description" name="description" rows={4} maxLength={2000} className={field} placeholder="Apa yang diamati dan mengapa perlu ditinjau. Tetap faktual; hindari kesimpulan tentang niat." />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="platform" className="mb-1 block text-sm text-slate-300">Platform</label>
              <select id="platform" name="platform" defaultValue={post?.platform ?? "x"} className={field}>
                {PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="category" className="mb-1 block text-sm text-slate-300">Kategori</label>
              <select id="category" name="category" defaultValue={suggestedCategory} className={field}>
                {POLICY_CATEGORIES.map((c) => <option key={c} value={c}>{POLICY_CATEGORY_LABEL[c]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="priority" className="mb-1 block text-sm text-slate-300">Prioritas</label>
              <select id="priority" name="priority" defaultValue="medium" className={field}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="postIds" className="mb-1 block text-sm text-slate-300">ID Postingan (opsional, pisahkan dengan koma)</label>
            <input id="postIds" name="postIds" defaultValue={post?.id ?? ""} className={field} placeholder="POST-001, POST-002" />
          </div>
          <button type="submit" className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400">Buat kasus</button>
        </form>
      </Card>
    </div>
  );
}
