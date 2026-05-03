import { peekSession } from "@/lib/dal";

// Renders the signed-in admin's email in the layout header. Uses the cached
// peekSession() (NOT verifyAdmin) so this component never throws
// `forbidden()` and never duplicates the page-level session lookup —
// both calls share the same react.cache() bucket. The page-level
// `verifyAdmin()` remains the authorization gate; this component just
// decorates the shell.
export async function AdminEmail() {
  const session = await peekSession();
  if (!session) return null;
  return <span>{session.user.email}</span>;
}
