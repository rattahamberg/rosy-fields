import type { Metadata } from "next";
import Link from "next/link";
import { asc, count, eq, sql } from "drizzle-orm";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { household, householdMember } from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Your households",
};

export default async function HouseholdsListPage() {
  const session = await verifySession();
  // Single SELECT: groupBy + count() aggregate. The IN-subquery scopes to
  // households the current user belongs to; the outer count gets every
  // member of those households.
  const rows = await db
    .select({
      id: household.id,
      name: household.name,
      memberCount: count(householdMember.userId),
    })
    .from(household)
    .innerJoin(
      householdMember,
      eq(householdMember.householdId, household.id),
    )
    .where(
      sql`${household.id} IN (
        SELECT household_id FROM household_member WHERE user_id = ${session.user.id}
      )`,
    )
    .groupBy(household.id, household.name)
    .orderBy(asc(household.name));

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-8">
      <h1 className="text-xl font-semibold">Your households</h1>
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          You aren&apos;t in any households yet. Ask an admin to add you.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {rows.map((h) => (
            <li
              key={h.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <Link
                href={`/dashboard/households/${h.id}`}
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                {h.name}
              </Link>
              <span className="text-xs text-zinc-500">
                {h.memberCount} member{h.memberCount === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
