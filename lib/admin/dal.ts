import "server-only";

import { forbidden } from "next/navigation";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { verifySession } from "@/lib/dal";

// Role lives on `user`, not on the session payload — fetched server-side so
// a role change takes effect immediately without waiting for a session refresh.
// `cache()` dedupes within a render pass so repeated calls cost zero.
export const getCurrentRole = cache(async () => {
  const session = await verifySession();
  const [row] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);
  return row?.role ?? "user";
});

// `forbidden()` triggers `app/forbidden.tsx` (Next 16 authInterrupts).
// Layouts don't re-execute on soft navigations, so every admin page MUST
// call this — the layout call alone leaves a window where a freshly-demoted
// user can keep navigating between admin pages.
export const verifyAdmin = cache(async () => {
  const session = await verifySession();
  const role = await getCurrentRole();
  if (role !== "admin") forbidden();
  return session;
});
