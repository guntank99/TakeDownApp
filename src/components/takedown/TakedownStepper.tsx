import { Check } from "lucide-react";
import { TAKEDOWN_STEPS, type TakedownProgress } from "@/lib/takedown/steps";

/** Five-step take-down path with the current step highlighted. Display only. */
export function TakedownStepper({ progress }: { progress: TakedownProgress }) {
  return (
    <ol aria-label="Tahapan take down" className="grid gap-2 sm:grid-cols-5">
      {TAKEDOWN_STEPS.map((step, i) => {
        const done = i < progress.index;
        const current = i === progress.index;
        return (
          <li
            key={step.key}
            aria-current={current ? "step" : undefined}
            className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${
              done
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-200"
                : current
                  ? "border-sky-500 bg-sky-500/10 text-sky-200"
                  : "border-slate-800 text-slate-500"
            }`}
          >
            <span
              className={`mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                done ? "bg-emerald-500 text-slate-950" : current ? "bg-sky-500 text-slate-950" : "bg-slate-800 text-slate-400"
              }`}
            >
              {done ? <Check className="size-3" aria-hidden="true" /> : i + 1}
            </span>
            <span className="leading-snug">
              {step.label}
              <span className="sr-only">{done ? " (selesai)" : current ? " (tahap saat ini)" : " (belum)"}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
