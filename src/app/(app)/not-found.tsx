import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div role="status" className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-700 px-6 py-14 text-center">
      <SearchX className="size-8 text-slate-500" aria-hidden="true" />
      <p className="text-sm text-slate-300">Data tersebut tidak ditemukan.</p>
      <Link href="/dashboard" className="text-sm text-sky-400 hover:underline">Kembali ke dasbor</Link>
    </div>
  );
}
