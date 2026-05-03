import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq, ilike, sql } from "drizzle-orm";
import { verifyAdmin } from "@/lib/admin/dal";
import {
  ADMIN_HOUSEHOLD_LIST_LIMIT,
  ADMIN_SEARCH_MIN_LENGTH,
} from "@/lib/admin/config";
import { resolveSearch } from "@/lib/admin/search";
import { AdminTable, PrimaryButton } from "@/app/admin/_components";
import { db } from "@/lib/db";
import { household, householdMember, user } from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Households",
};

type SearchParams = Promise<{ q?: string }>;

export default async function AdminHouseholdsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await verifyAdmin();

  const { q } = await searchParams;
  const { trimmedQ, searchActive, searchTooShort } = resolveSearch(q);

  const rows = searchTooShort
    ? []
    : await db
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
        .where(searchActive ? ilike(household.name, `%${trimmedQ}%`) : undefined)
        .groupBy(household.id, user.email)
        .orderBy(asc(household.name))
        .limit(ADMIN_HOUSEHOLD_LIST_LIMIT);

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
          placeholder={`Search by name (≥${ADMIN_SEARCH_MIN_LENGTH} chars)…`}
          className="w-full max-w-sm rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <PrimaryButton>Search</PrimaryButton>
        {trimmedQ && (
          <Link
            href="/admin/households"
            className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Clear
          </Link>
        )}
      </form>

      {searchTooShort && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Search needs at least {ADMIN_SEARCH_MIN_LENGTH} characters.
        </p>
      )}

      <AdminTable headers={["Name", "Members", "Created by", "Created"]}>
        {rows.length === 0 && (
          <tr>
            <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
              {searchTooShort ? (
                "Type more to search."
              ) : (
                <>
                  No households yet.{" "}
                  <Link
                    href="/admin/households/new"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Create the first one.
                  </Link>
                </>
              )}
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
      </AdminTable>
    </div>
  );
}
