// Same-origin redirect validation. Used by the proxy, the login form, and
// Server Actions that accept a `redirectTo` field. Blocks `//evil.com` and
// absolute URLs.
//
// The proxy can import from `lib/` because Next 16 Proxy defaults to the
// Node.js runtime — no edge-runtime constraint forcing duplication.

export function isSafePath(target: string | null | undefined): target is string {
  if (!target) return false;
  return target.startsWith("/") && !target.startsWith("//");
}

export function safePath(
  target: string | null | undefined,
  fallback: string,
): string {
  return isSafePath(target) ? target : fallback;
}
