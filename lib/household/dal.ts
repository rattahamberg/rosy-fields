import "server-only";

import { forbidden } from "next/navigation";
import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { householdMember } from "@/lib/db/schema";
import { verifySession } from "@/lib/dal";

// Authorization gates for household-scoped routes.
//
// Admin role does NOT bypass these — admins are for managing households,
// not snooping inside their finances. If an admin needs ledger access,
// they add themselves as a member first.
//
// Two flavors, picked by need:
//   verifyHouseholdMember(id)   — gate-only. Cheap SELECT 1 on the
//                                 (household_id, user_id) PK. Use in pages.
//   loadHouseholdContext(id)    — gate AND returns memberIds. Use in
//                                 mutation actions that need the member set.
// Both are react.cache()-wrapped so repeated calls in one render dedupe.

export type HouseholdContext = {
  session: Awaited<ReturnType<typeof verifySession>>;
  memberIds: Set<string>;
};

export const verifyHouseholdMember = cache(async (householdId: string) => {
  const session = await verifySession();
  const [row] = await db
    .select({ userId: householdMember.userId })
    .from(householdMember)
    .where(
      and(
        eq(householdMember.householdId, householdId),
        eq(householdMember.userId, session.user.id),
      ),
    )
    .limit(1);
  if (!row) forbidden();
  return session;
});

export const loadHouseholdContext = cache(
  async (householdId: string): Promise<HouseholdContext> => {
    const session = await verifySession();
    const rows = await db
      .select({ userId: householdMember.userId })
      .from(householdMember)
      .where(eq(householdMember.householdId, householdId));
    const memberIds = new Set(rows.map((r) => r.userId));
    if (!memberIds.has(session.user.id)) forbidden();
    return { session, memberIds };
  },
);
