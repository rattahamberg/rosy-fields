import { headers } from "next/headers";
import { auth } from "@/lib/auth";

// Renders the signed-in admin's email in the layout header. Reads the session
// directly (NOT verifyAdmin) so this component never throws `forbidden()` —
// the page-level `verifyAdmin()` calls handle the actual gate, while this
// component just decorates the shell. If the session is gone (logged out
// mid-render) we render nothing and let the proxy/page redirect.
export async function AdminEmail() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  return <span>{session.user.email}</span>;
}
