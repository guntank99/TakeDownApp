"use client";

import { useActionState } from "react";
import { analyzeTextAction, type AnalyzeState } from "@/app/(app)/actions";
import { AnalysisCard } from "./AnalysisCard";

const initial: AnalyzeState = {};

/** Manual analysis tool: paste any text and see exactly what the engine flags and why. */
export function TextAnalyzer() {
  const [state, action, pending] = useActionState(analyzeTextAction, initial);
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3">
        <label htmlFor="text" className="block text-sm font-medium text-slate-300">
          Teks yang akan dianalisis
        </label>
        <textarea
          id="text"
          name="text"
          rows={4}
          maxLength={5000}
          required
          defaultValue={state.text}
          placeholder="Tempel postingan atau komentar (bahasa Indonesia atau Inggris)…"
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
        {state.error ? <p role="alert" className="text-sm text-red-300">{state.error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-sky-500 px-4 py-1.5 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-60"
        >
          {pending ? "Menganalisis..." : "Analisis"}
        </button>
      </form>
      {state.analysis ? <AnalysisCard analysis={state.analysis} title="Hasil" /> : null}
    </div>
  );
}
