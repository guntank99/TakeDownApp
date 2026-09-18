import Link from "next/link";
import { buildQuery } from "@/lib/utils/params";
import { EmptyState } from "@/components/ui/EmptyState";

export interface Column<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
}

export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  empty = "Tidak ada data.",
}: {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: string;
}) {
  if (rows.length === 0) return <EmptyState message={empty} />;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full min-w-max border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-slate-900 text-xs uppercase tracking-wider text-slate-400">
          <tr>
            {columns.map((c) => (
              <th key={c.header} scope="col" className={`whitespace-nowrap px-3 py-2.5 font-medium ${c.className ?? ""}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/80">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="hover:bg-slate-900/60">
              {columns.map((c) => (
                <td key={c.header} className={`px-3 py-2.5 align-top text-slate-200 ${c.className ?? ""}`}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({
  page,
  pages,
  total,
  basePath,
  params,
}: {
  page: number;
  pages: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  if (pages <= 1) {
    return <p className="mt-3 text-xs text-slate-500">{total} hasil</p>;
  }
  const href = (p: number) => `${basePath}${buildQuery({ ...params, page: p === 1 ? undefined : p })}`;
  const link = "rounded-md border border-slate-700 px-3 py-1 text-sm text-slate-200 hover:bg-slate-800";
  const off = "rounded-md border border-slate-800 px-3 py-1 text-sm text-slate-600";
  return (
    <nav aria-label="Halaman" className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
      <span>
        {total} hasil · halaman {page} dari {pages}
      </span>
      <span className="flex gap-2">
        {page > 1 ? <Link href={href(page - 1)} className={link}>Sebelumnya</Link> : <span className={off} aria-disabled="true">Sebelumnya</span>}
        {page < pages ? <Link href={href(page + 1)} className={link}>Berikutnya</Link> : <span className={off} aria-disabled="true">Berikutnya</span>}
      </span>
    </nav>
  );
}
