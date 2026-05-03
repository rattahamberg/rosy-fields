import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Forbidden",
};

export default function Forbidden() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Forbidden</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          You don&apos;t have access to this page. If you think you should,
          contact an admin.
        </p>
        <div className="flex items-center justify-center gap-4 text-sm">
          <Link
            href="/dashboard"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
