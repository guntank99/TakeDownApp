import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: number;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "danger";
}

const numberFormat = new Intl.NumberFormat("id-ID");

export function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: MetricCardProps) {
  const iconClass =
    tone === "danger"
      ? "bg-red-500/10 text-red-300"
      : "bg-sky-500/10 text-sky-300";

  return (
    <article className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-xs font-medium uppercase tracking-wider text-slate-400">
          {label}
        </h3>
        <span className={`rounded-lg p-2 ${iconClass}`}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums text-slate-50">
        {numberFormat.format(value)}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </article>
  );
}
