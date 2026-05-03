import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { isSafePath } from "@/lib/safe-redirect";

// Optimistic auth gate: checks for session-cookie *presence* only.
// This is a UX/perf hint, NOT the authorization boundary. The real check
// happens in `lib/dal.ts` and `lib/admin/dal.ts`.
// Never rely on this layer alone — Next 16 docs flag exactly this pitfall.

const PROTECTED_PREFIXES = ["/dashboard", "/admin"];

function isProtectedPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    PROTECTED_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    )
  );
}

export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const { pathname, search } = request.nextUrl;

  if (sessionCookie) {
    if (pathname === "/" || pathname === "/login" || pathname === "/signup") {
      const next = request.nextUrl.searchParams.get("next");
      const dest = isSafePath(next) ? next! : "/dashboard";
      return NextResponse.redirect(new URL(dest, request.url));
    }
    return NextResponse.next();
  }

  // Unauthenticated. Bounce to /login but preserve where they were heading
  // so post-login can return them there.
  if (isProtectedPath(pathname)) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/" && pathname !== "/login") {
      loginUrl.searchParams.set("next", `${pathname}${search}`);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*", "/admin/:path*", "/login", "/signup"],
};
