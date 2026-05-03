import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";

// React's `cache` dedupes within a single render pass, so multiple
// components in the same request can call verifySession()/getUser()
// without re-hitting the auth API or DB.

export const verifySession = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    redirect("/login");
  }
  return session;
});

export const getUser = cache(async () => {
  const session = await verifySession();
  return session.user;
});
