import "server-only";

import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";

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
