export function MockDataBadge({ label = "DATA MOCK" }: { label?: string }) {
  return (
    <span
      className="inline-flex items-center rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold tracking-wider text-amber-300"
      title="Data simulasi. Bukan konten media sosial yang sebenarnya."
    >
      {label}
    </span>
  );
}
