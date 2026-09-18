"use client";

import { TriangleAlert } from "lucide-react";

export default function ErrorState({ reset }: { reset: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/5 px-6 py-12 text-center"
    >
      <TriangleAlert className="size-8 text-red-300" aria-hidden="true" />
      <p className="text-sm text-slate-300">
        Tidak dapat memuat data. Coba lagi.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg border border-slate-700 px-4 py-1.5 text-sm text-slate-200 transition-colors hover:bg-slate-800"
      >
        Coba lagi
      </button>
    </div>
  );
}
