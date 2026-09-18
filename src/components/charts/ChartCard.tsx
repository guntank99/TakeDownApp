import { Card } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/EmptyState";

/** Wraps a chart with a title and an accessible table alternative of the same data. */
export function ChartCard({
  title,
  description,
  table,
  empty,
  children,
  className,
}: {
  title: string;
  description?: string;
  table: { columns: string[]; rows: (string | number)[][] };
  empty?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card title={title} description={description} className={className}>
      {empty ? <EmptyState message="Tidak ada data." /> : children}
      {!empty ? (
        <details className="mt-3 text-xs text-slate-500">
          <summary className="cursor-pointer select-none text-slate-400 hover:text-slate-200">Lihat tabel data</summary>
          <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-slate-800">
            <table className="w-full text-left">
              <caption className="sr-only">Data {title}</caption>
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  {table.columns.map((c) => (
                    <th key={c} scope="col" className="px-2 py-1.5 font-medium">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {table.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((cell, j) => (
                      <td key={j} className="px-2 py-1 tabular-nums">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </Card>
  );
}
