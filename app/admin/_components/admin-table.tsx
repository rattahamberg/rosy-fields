// Shell for admin data tables — locks the outer wrapper, header style, and
// row divider so individual pages don't drift visually.
//
// `headers` accepts `null` for unlabelled action columns (e.g. a column of
// "Remove" buttons). The cell renders empty so the layout reserves the
// space without showing a label.

export function AdminTable({
  headers,
  children,
}: {
  headers: (string | null)[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
          <tr>
            {headers.map((h, i) => (
              // Always composite — guards against duplicate non-null headers.
              <th
                key={h != null ? `${h}-${i}` : `__col-${i}`}
                className="px-4 py-2 font-medium"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {children}
        </tbody>
      </table>
    </div>
  );
}
