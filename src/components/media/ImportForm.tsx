import { Plus } from "lucide-react";
import { importPostAction } from "@/app/(app)/actions";

const input = "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500";

const METRICS = [
  { name: "views", label: "Tayangan" },
  { name: "likes", label: "Suka" },
  { name: "comments", label: "Komentar" },
  { name: "shares", label: "Bagikan" },
] as const;

/** Adds a post/video by pasting its public link. Optional fields are for what the platform does not tell us. */
export function ImportForm({ returnTo = "/video" }: { returnTo?: string }) {
  return (
    <form action={importPostAction} className="space-y-3">
      <input type="hidden" name="returnTo" value={returnTo} />
      <div className="flex flex-wrap gap-2">
        <div className="min-w-0 flex-1 basis-80">
          <label htmlFor="import-url" className="sr-only">Tautan postingan atau video</label>
          <input
            id="import-url"
            name="url"
            type="url"
            required
            maxLength={500}
            placeholder="Tempel tautan video/postingan YouTube, Instagram, Facebook, X, TikTok, atau Threads"
            className={input}
          />
        </div>
        <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400">
          <Plus className="size-4" aria-hidden="true" /> Tambahkan
        </button>
      </div>
      <details className="text-sm text-slate-400">
        <summary className="cursor-pointer select-none text-xs text-slate-400 hover:text-slate-200">Isi manual (opsional): keterangan, tanggal, dan angka interaksi</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-4">
            <label htmlFor="import-caption" className="mb-1 block text-xs text-slate-400">Teks/keterangan postingan (agar dapat dianalisis; Instagram &amp; Threads tidak menyediakannya otomatis)</label>
            <textarea id="import-caption" name="caption" rows={2} maxLength={1000} className={input} />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <label htmlFor="import-note" className="mb-1 block text-xs text-slate-400">Catatan Anda</label>
            <input id="import-note" name="note" maxLength={500} className={input} />
          </div>
          <div>
            <label htmlFor="import-postedAt" className="mb-1 block text-xs text-slate-400">Tanggal tayang</label>
            <input id="import-postedAt" name="postedAt" type="date" className={input} />
          </div>
          {METRICS.map((m) => (
            <div key={m.name}>
              <label htmlFor={`import-${m.name}`} className="mb-1 block text-xs text-slate-400">{m.label}</label>
              <input id={`import-${m.name}`} name={m.name} type="number" min={0} inputMode="numeric" className={input} />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">Angka yang Anda isi dicatat sebagai input manual. Yang dikosongkan tetap &ldquo;tidak diketahui&rdquo; dan tidak dianggap sebagai bukti apa pun.</p>
      </details>
    </form>
  );
}
