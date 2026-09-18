import { Inbox } from "lucide-react";

export function EmptyState({
  message = "Tidak ada data.",
}: {
  message?: string;
}) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 px-6 py-12 text-center text-slate-400"
    >
      <Inbox className="size-8" aria-hidden="true" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
