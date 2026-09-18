export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 text-sm text-slate-400"
    >
      <span
        className="size-4 animate-spin rounded-full border-2 border-slate-700 border-t-sky-400"
        aria-hidden="true"
      />
      Memuat analisis...
    </div>
  );
}
