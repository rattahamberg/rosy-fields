import type { Metadata } from "next";
import Link from "next/link";
import { verifyAdmin } from "@/lib/admin/dal";

export const metadata: Metadata = {
  title: {
    default: "Admin",
    template: "%s · Admin · Rosy Fields",
  },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifyAdmin();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-6 text-sm">
          <div className="flex items-center gap-6">
            <Link
              href="/admin"
              className="font-semibold tracking-tight"
            >
              Admin
            </Link>
            <Link
              href="/admin/users"
              className="text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
            >
              Users
            </Link>
            <Link
              href="/admin/households"
              className="text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
            >
              Households
            </Link>
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
            <span>{session.user.email}</span>
            <Link
              href="/dashboard"
              className="hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              ← Dashboard
            </Link>
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}
