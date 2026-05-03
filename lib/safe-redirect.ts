// Same-origin redirect validation. Used by the login form and Server Actions
// that accept a `redirectTo` field. Blocks `//evil.com` and absolute URLs.
//
// The proxy keeps its own copy of this logic — the proxy runs in the edge
// runtime where importing from `lib/` is allowed but adds complexity.

export function isSafePath(target: string | null | undefined): boolean {
  if (!target) return false;
  return target.startsWith("/") && !target.startsWith("//");
}

export function safePath(
  target: string | null | undefined,
  fallback: string,
): string {
  return isSafePath(target) ? (target as string) : fallback;
}
