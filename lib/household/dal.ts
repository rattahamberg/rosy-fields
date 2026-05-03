import "server-only";

import { forbidden } from "next/navigation";
import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { householdMember } from "@/lib/db/schema";
import { verifySession } from "@/lib/dal";

// Authorization gate for household-scoped routes (`/dashboard/households/[id]/*`).
// Admin role does NOT bypass — admins are for managing households, not snooping
// inside their finances. If an admin needs ledger access, they add themselves
// as a member first.
//
// Cached per-request via react.cache() so layout + page + child fetches share
// one membership lookup.
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
