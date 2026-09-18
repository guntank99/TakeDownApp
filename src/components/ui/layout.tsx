import Link from "next/link";
import { MockDataBadge } from "./MockDataBadge";

export function PageHeader({
  title,
  description,
  actions,
  mock = true,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Show the DATA MOCK badge (default; pages pass the real provider flag). */
  mock?: boolean;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-50">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-slate-400">{description}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {mock ? (
          <span className="flex items-center gap-2 text-xs text-slate-400">
            SUMBER DATA: MOCK / SIMULASI <MockDataBadge />
          </span>
        ) : null}
        {actions}
      </div>
    </div>
  );
}

export function Card({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-xl border border-slate-800 bg-slate-900/70 p-5 ${className}`}>
      {title ? (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function KeyValue({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-xs uppercase tracking-wider text-slate-500">{i.label}</dt>
          <dd className="mt-0.5 break-words text-sm text-slate-200">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LinkButton({
  href,
  children,
  variant = "secondary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const cls =
    variant === "primary"
      ? "bg-sky-500 text-slate-950 hover:bg-sky-400"
      : "border border-slate-700 text-slate-200 hover:bg-slate-800";
  return (
    <Link href={href} className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${cls}`}>
      {children}
    </Link>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warning" | "danger"; children: React.ReactNode }) {
  const cls = {
    info: "border-sky-500/30 bg-sky-500/5 text-sky-200",
    warning: "border-amber-500/30 bg-amber-500/5 text-amber-200",
    danger: "border-red-500/30 bg-red-500/5 text-red-200",
  }[tone];
  return (
    <p role="note" className={`rounded-lg border px-3 py-2 text-sm ${cls}`}>
      {children}
    </p>
  );
}

/** Shows the ?notice= / ?error= message left by a form action. */
export function Flash({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const pick = (k: string) => {
    const v = searchParams[k];
    return (Array.isArray(v) ? v[0] : v)?.slice(0, 300);
  };
  const error = pick("error");
  const notice = pick("notice");
  if (!error && !notice) return null;
  return (
    <div className="mb-4">
      {error ? <Notice tone="danger">{error}</Notice> : <Notice tone="info">{notice}</Notice>}
    </div>
  );
}
