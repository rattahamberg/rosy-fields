import type { Metadata } from "next";
import Link from "next/link";
import {
  and,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { verifyAdmin } from "@/lib/admin/dal";
import {
  ADMIN_HOUSEHOLD_NAME_MAX,
  ADMIN_SEARCH_MIN_LENGTH,
  ADMIN_USER_PAGE_SIZE,
} from "@/lib/admin/config";
import { resolveSearch } from "@/lib/admin/search";
import { AdminTable } from "@/app/admin/_components";
import { PrimaryButton } from "@/app/_components/primary-button";
import { db } from "@/lib/db";
import {
  household,
  householdMember,
  session,
  user,
} from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Users",
};

type SearchParams = Promise<{
  q?: string;
  cursor?: string;
  householdId?: string;
}>;

function buildCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString("base64url");
}

function parseCursor(
  cursor: string | undefined,
): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  try {
    const [iso, id] = Buffer.from(cursor, "base64url")
      .toString("utf-8")
      .split("|");
    if (!iso || !id) return null;
    const createdAt = new Date(iso);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Layout-only auth checks are unsafe under partial rendering.
  await verifyAdmin();

  const { q, cursor, householdId } = await searchParams;
  const cursorParsed = parseCursor(cursor);
  const { trimmedQ, searchActive, searchTooShort } = resolveSearch(q);

  const conditions: SQL[] = [];
  if (searchActive) {
    const pattern = `%${trimmedQ}%`;
    const expr = or(ilike(user.email, pattern), ilike(user.name, pattern));
    if (expr) conditions.push(expr);
  }
  if (cursorParsed) {
    // Explicit OR form (rather than row-value `(a,b) < (x,y)`) so the planner
    // can use the (created_at DESC, id DESC) composite index.
    const expr = or(
      lt(user.createdAt, cursorParsed.createdAt),
      and(
        eq(user.createdAt, cursorParsed.createdAt),
        lt(user.id, cursorParsed.id),
      ),
    );
    if (expr) conditions.push(expr);
  }

  if (householdId) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM ${householdMember} hm WHERE hm.user_id = ${user.id} AND hm.household_id = ${householdId})`,
    );
  }

  const whereExpr = conditions.length > 0 ? and(...conditions) : undefined;

  // Extract the user-list query so its row type can be derived rather than
  // hand-typed (the previous Promise.all empty-array placeholder was prone
  // to drifting from the Drizzle inference).
  const listUsersQuery = (where: SQL | undefined) =>
    db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        role: user.role,
        createdAt: user.createdAt,
        activeSessions: sql<number>`count(${session.id})::int`.as(
          "active_sessions",
        ),
      })
      .from(user)
      .leftJoin(
        session,
        and(eq(session.userId, user.id), gt(session.expiresAt, sql`now()`)),
      )
      .where(where)
      .groupBy(user.id)
      .orderBy(desc(user.createdAt), desc(user.id))
      .limit(ADMIN_USER_PAGE_SIZE + 1);

  type UserListRow = Awaited<ReturnType<typeof listUsersQuery>>[number];

  // Main user list and the filter-label lookup are independent — fan out.
  const [rows, filterLabel] = await Promise.all([
    searchTooShort
      ? Promise.resolve([] as UserListRow[])
      : listUsersQuery(whereExpr),
    householdId
      ? db
          .select({ name: household.name })
          .from(household)
          .where(eq(household.id, householdId))
          .limit(1)
          .then((r) => r[0]?.name ?? "Unknown household")
      : Promise.resolve(null as string | null),
  ]);

  const hasMore = rows.length > ADMIN_USER_PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, ADMIN_USER_PAGE_SIZE) : rows;
  const lastRow = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && lastRow ? buildCursor(lastRow.createdAt, lastRow.id) : null;

  // Memberships depends on pageRows so it stays in a second stage.
  const membershipsByUser = new Map<
    string,
    { householdId: string; name: string }[]
  >();
  if (pageRows.length > 0) {
    const memberships = await db
      .select({
        userId: householdMember.userId,
        householdId: household.id,
        name: household.name,
      })
      .from(householdMember)
      .innerJoin(household, eq(household.id, householdMember.householdId))
      .where(
        inArray(
          householdMember.userId,
          pageRows.map((r) => r.id),
        ),
      );
    for (const m of memberships) {
      const list = membershipsByUser.get(m.userId) ?? [];
      list.push({ householdId: m.householdId, name: m.name });
      membershipsByUser.set(m.userId, list);
    }
  }

  const baseQuery = new URLSearchParams();
  if (trimmedQ) baseQuery.set("q", trimmedQ);
  if (householdId) baseQuery.set("householdId", householdId);

  const nextHref = nextCursor
    ? (() => {
        const p = new URLSearchParams(baseQuery);
        p.set("cursor", nextCursor);
        return `/admin/users?${p.toString()}`;
      })()
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Users</h1>
      </div>

      <form className="flex flex-wrap items-center gap-3" method="get">
        <input
          type="search"
          name="q"
          defaultValue={trimmedQ}
          placeholder={`Search by email or name (≥${ADMIN_SEARCH_MIN_LENGTH} chars)…`}
          className="w-full max-w-sm rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        {householdId ? (
          <input type="hidden" name="householdId" value={householdId} />
        ) : null}
        <PrimaryButton>Search</PrimaryButton>
        {(trimmedQ || householdId) && (
          <Link
            href="/admin/users"
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

      {filterLabel && (
        <div className="text-xs text-zinc-500">
          Filtered to household:{" "}
          <strong>{filterLabel.slice(0, ADMIN_HOUSEHOLD_NAME_MAX)}</strong>
        </div>
      )}

      <AdminTable
        headers={[
          "Email",
          "Name",
          "Role",
          "Verified",
          "Households",
          "Sessions",
          "Created",
        ]}
      >
        {pageRows.length === 0 && (
          <tr>
            <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
              No users match.
            </td>
          </tr>
        )}
        {pageRows.map((row) => {
          const memberships = membershipsByUser.get(row.id) ?? [];
          return (
            <tr key={row.id}>
              <td className="px-4 py-2">
                <Link
                  href={`/admin/users/${row.id}`}
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {row.email}
                </Link>
              </td>
              <td className="px-4 py-2">{row.name}</td>
              <td className="px-4 py-2">
                {row.role === "admin" ? (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
                    admin
                  </span>
                ) : (
                  <span className="text-zinc-500">user</span>
                )}
              </td>
              <td className="px-4 py-2 text-xs">
                {row.emailVerified ? "✓" : "—"}
              </td>
              <td className="px-4 py-2 text-xs">
                {memberships.length === 0 ? (
                  <span className="text-zinc-400">—</span>
                ) : (
                  memberships.map((m, i) => (
                    <span key={m.householdId}>
                      {i > 0 && ", "}
                      <Link
                        href={`/admin/households/${m.householdId}`}
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {m.name}
                      </Link>
                    </span>
                  ))
                )}
              </td>
              <td className="px-4 py-2 text-xs">{row.activeSessions}</td>
              <td className="px-4 py-2 text-xs text-zinc-500">
                {row.createdAt.toISOString().slice(0, 10)}
              </td>
            </tr>
          );
        })}
      </AdminTable>

      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>
          Showing {pageRows.length} {hasMore ? "(more available)" : ""}
        </span>
        {nextHref && (
          <Link
            href={nextHref}
            className="rounded border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Next page →
          </Link>
        )}
      </div>
    </div>
  );
}
