import "server-only";

import { forbidden } from "next/navigation";
import { cache } from "react";
import { eq } from "drizzle-orm";
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
  const result = await loadHouseholdContext(householdId);
  return result.session;
});

// Combined gate + member-set fetch in a single SELECT. Use this in mutation
// actions that need the member set (to validate participants etc.) — avoids
// the two-roundtrip pattern of calling verifyHouseholdMember + then loading
// the members separately.
export const loadHouseholdContext = cache(async (householdId: string) => {
  const session = await verifySession();
  const rows = await db
    .select({ userId: householdMember.userId })
    .from(householdMember)
    .where(eq(householdMember.householdId, householdId));
  const memberIds = new Set(rows.map((r) => r.userId));
  if (!memberIds.has(session.user.id)) forbidden();
  return { session, memberIds };
});
