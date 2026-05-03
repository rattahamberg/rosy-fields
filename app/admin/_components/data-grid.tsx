export function DataGrid({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[160px_1fr]">
      {rows.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-xs uppercase tracking-wide text-zinc-500">{k}</dt>
          <dd className="break-all">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
