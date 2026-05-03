import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { verifyAdmin } from "@/lib/admin/dal";

export const metadata: Metadata = {
  title: {
    default: "Admin",
    template: "%s · Admin · Rosy Fields",
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Layout itself is sync — auth happens in the Suspense-wrapped header.
  // This unblocks loading.tsx fallbacks for child routes (per Next 16 docs:
  // "If the layout accesses uncached or runtime data… loading.js will not
  // show a fallback for it"). Each page calls verifyAdmin() itself, so
  // gating only happens server-side at the page boundary; the layout's
  // verifyAdmin is only used to render the email in the header.
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-6 text-sm">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="font-semibold tracking-tight">
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
            <Suspense fallback={<span className="text-zinc-400">…</span>}>
              <AdminEmail />
            </Suspense>
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

async function AdminEmail() {
  const session = await verifyAdmin();
  return <span>{session.user.email}</span>;
}
