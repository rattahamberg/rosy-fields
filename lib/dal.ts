import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";

// React's `cache` dedupes within a single render pass, so multiple
// components in the same request can call peekSession()/verifySession()/getUser()
// without re-hitting the auth API or DB. peekSession is the cached primitive;
// the others build on it.

// Returns the session if present, null otherwise. Never redirects. Use this
// when the layout or a decoration component just wants to display session
// data without enforcing auth.
export const peekSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export const verifySession = cache(async () => {
  const session = await peekSession();
  if (!session) {
    redirect("/login");
  }
  return session;
});

export const getUser = cache(async () => {
  const session = await verifySession();
  return session.user;
});
