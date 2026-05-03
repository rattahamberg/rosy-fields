import "server-only";

import { and, desc, eq, gt, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { session, user } from "@/lib/db/schema";
import { ADMIN_USER_PAGE_SIZE } from "@/lib/admin/config";

// Batched email lookup, keyed by user id. Used to render "added by" columns
// without N+1 queries. Returns an empty Map for empty input.
export async function resolveUserEmails(
  ids: readonly string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const rows = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(inArray(user.id, [...ids]));
  for (const r of rows) map.set(r.id, r.email);
  return map;
}

// Admin user-list query — extracted so the row type can be derived rather
// than hand-typed (the previous Promise.all empty-array placeholder was
// prone to drifting from the Drizzle inference). Limit returns N+1 rows so
// the page can detect "more available".
export function listUsersQuery(where: SQL | undefined) {
  return db
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
}

export type UserListRow = Awaited<ReturnType<typeof listUsersQuery>>[number];
