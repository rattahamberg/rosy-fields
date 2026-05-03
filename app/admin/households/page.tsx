import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq, ilike, sql } from "drizzle-orm";
import { verifyAdmin } from "@/lib/admin/dal";
import { db } from "@/lib/db";
import { household, householdMember, user } from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Households",
};

const LIST_LIMIT = 200;

type SearchParams = Promise<{ q?: string }>;

export default async function AdminHouseholdsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await verifyAdmin();

  const { q } = await searchParams;
  const trimmedQ = q?.trim() ?? "";

  const rows = await db
    .select({
      id: household.id,
      name: household.name,
      createdAt: household.createdAt,
      memberCount: sql<number>`count(${householdMember.userId})::int`.as(
        "member_count",
      ),
      createdByEmail: user.email,
    })
    .from(household)
    .leftJoin(
      householdMember,
      eq(householdMember.householdId, household.id),
    )
    .leftJoin(user, eq(user.id, household.createdByUserId))
    .where(trimmedQ ? ilike(household.name, `%${trimmedQ}%`) : undefined)
    .groupBy(household.id, user.email)
    .orderBy(asc(household.name))
    .limit(LIST_LIMIT);

  // Surface duplicate-name groups as an admin warning — names are not unique
  // (per spec) but the delete-by-name confirmation gets risky if duplicates
  // exist (you might confirm the wrong one).
  const nameCounts = new Map<string, number>();
  for (const r of rows) nameCounts.set(r.name, (nameCounts.get(r.name) ?? 0) + 1);
  const duplicates = [...nameCounts.entries()]
    .filter(([, n]) => n > 1)
    .map(([name]) => name);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Households</h1>
        <Link
          href="/admin/households/new"
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          New household
        </Link>
      </div>

      {duplicates.length > 0 && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          ⚠ Duplicate household name(s):{" "}
          <strong>{duplicates.join(", ")}</strong>. Be careful with delete — the
          confirm-by-name prompt cannot distinguish between them.
        </p>
      )}

      <form className="flex items-center gap-3" method="get">
        <input
          type="search"
          name="q"
          defaultValue={trimmedQ}
          placeholder="Search by name…"
          className="w-full max-w-sm rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
        >
          Search
        </button>
        {trimmedQ && (
          <Link
            href="/admin/households"
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Clear
          </Link>
        )}
      </form>

      <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Members</th>
              <th className="px-4 py-2 font-medium">Created by</th>
              <th className="px-4 py-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center text-zinc-500"
                >
                  No households yet.{" "}
                  <Link
                    href="/admin/households/new"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Create the first one.
                  </Link>
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-2">
                  <Link
                    href={`/admin/households/${row.id}`}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {row.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-xs">{row.memberCount}</td>
                <td className="px-4 py-2 text-xs text-zinc-500">
                  {row.createdByEmail ?? "—"}
                </td>
                <td className="px-4 py-2 text-xs text-zinc-500">
                  {row.createdAt.toISOString().slice(0, 10)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
