import Link from "next/link";

export interface FilterField {
  name: string;
  label: string;
  type?: "select" | "text" | "date";
  options?: { value: string; label: string }[];
  placeholder?: string;
}

const control =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500";

/** A plain GET form: filters live in the URL, so results are shareable and need no client state. */
export function FilterPanel({
  action,
  fields,
  values,
}: {
  action: string;
  fields: FilterField[];
  values: Record<string, string>;
}) {
  return (
    <form method="get" action={action} className="mb-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map((f) => (
          <div key={f.name}>
            <label htmlFor={`f-${f.name}`} className="mb-1 block text-xs font-medium text-slate-400">
              {f.label}
            </label>
            {f.type === "date" ? (
              <input id={`f-${f.name}`} name={f.name} type="date" defaultValue={values[f.name] ?? ""} className={control} />
            ) : f.type === "text" ? (
              <input id={`f-${f.name}`} name={f.name} defaultValue={values[f.name] ?? ""} placeholder={f.placeholder} className={control} maxLength={200} />
            ) : (
              <select id={`f-${f.name}`} name={f.name} defaultValue={values[f.name] ?? ""} className={control}>
                <option value="">All</option>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <button type="submit" className="rounded-lg bg-sky-500 px-4 py-1.5 text-sm font-semibold text-slate-950 hover:bg-sky-400">
          Apply filters
        </button>
        <Link href={action} className="rounded-lg border border-slate-700 px-4 py-1.5 text-sm text-slate-300 hover:bg-slate-800">
          Reset
        </Link>
      </div>
    </form>
  );
}
