export type DataGridRow = { label: string; value: React.ReactNode };

export function DataGrid({ rows }: { rows: DataGridRow[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[160px_1fr]">
      {rows.map(({ label, value }, i) => (
        // Label-first composite — stable across row reorderings while still
        // tolerating duplicate labels.
        <div key={`${label}-${i}`} className="contents">
          <dt className="text-xs uppercase tracking-wide text-zinc-500">
            {label}
          </dt>
          <dd className="break-all">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
