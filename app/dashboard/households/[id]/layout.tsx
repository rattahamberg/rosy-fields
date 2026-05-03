import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { verifyHouseholdMember } from "@/lib/household/dal";
import { db } from "@/lib/db";
import { household } from "@/lib/db/schema";

export const metadata: Metadata = {
  title: {
    default: "Household",
    template: "%s · Household",
  },
};

// `LayoutProps` is a Next 16 global helper that types `params` per route.
export default function HouseholdLayout(
  props: LayoutProps<"/dashboard/households/[id]">,
) {
  // Layout is sync; the header data streams in via Suspense so loading.tsx
  // can fire for child route segments.
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <Suspense fallback={<HeaderSkeleton />}>
          <HouseholdHeader params={props.params} />
        </Suspense>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        {props.children}
      </main>
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <nav className="mx-auto flex max-w-4xl items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
      <span>…</span>
      <Link href="/dashboard/households" className="text-xs">
        ← All households
      </Link>
    </nav>
  );
}

async function HouseholdHeader({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // verifyHouseholdMember gates and caches; the page-level checks reuse
  // the cached result.
  await verifyHouseholdMember(id);
  const [h] = await db
    .select({ name: household.name })
    .from(household)
    .where(eq(household.id, id))
    .limit(1);
  return (
    <nav className="mx-auto flex max-w-4xl items-center justify-between gap-6 text-sm">
      <div className="flex items-center gap-6">
        <Link
          href={`/dashboard/households/${id}`}
          className="font-semibold tracking-tight"
        >
          {h?.name ?? "Household"}
        </Link>
        <Link
          href={`/dashboard/households/${id}/expenses`}
          className="text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
        >
          Expenses
        </Link>
        <Link
          href={`/dashboard/households/${id}/settlements`}
          className="text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
        >
          Settlements
        </Link>
      </div>
      <Link
        href="/dashboard/households"
        className="text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← All households
      </Link>
    </nav>
  );
}
