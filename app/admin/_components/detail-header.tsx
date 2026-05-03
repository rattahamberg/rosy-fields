import Link from "next/link";

export function DetailHeader({
  title,
  subtitle,
  backHref,
  backLabel,
}: {
  title: string;
  subtitle?: React.ReactNode;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle ? (
          <p className="text-sm text-zinc-500">{subtitle}</p>
        ) : null}
      </div>
      <Link
        href={backHref}
        className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        ← {backLabel}
      </Link>
    </div>
  );
}
