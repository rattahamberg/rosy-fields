import type { Metadata } from "next";
import Link from "next/link";
import { getUser } from "@/lib/dal";
import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const user = await getUser();

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{user.email}</p>
        <Link
          href="/dashboard/households"
          className="inline-block rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Your households →
        </Link>
        <div className="pt-2">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
