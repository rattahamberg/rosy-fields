import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// `unsafe-eval` is required by React's dev tooling but NOT in production —
// per Next 16 CSP guide. Gate it on the env so prod gets the stricter policy.
const SCRIPT_SRC = `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`;

const COMMON_HEADERS = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // Conservative CSP. `'unsafe-inline'` is permitted for Next.js's required
  // inline bootstrap scripts; tighten with a nonce-based policy via proxy if
  // you start serving sensitive PII or accept third-party content. The
  // browser does not need to talk to Neon directly — Neon WebSocket is
  // server-side only — so connect-src stays at 'self'.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      SCRIPT_SRC,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  experimental: {
    // Enables `forbidden()` / `unauthorized()` from `next/navigation`.
    authInterrupts: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: COMMON_HEADERS,
      },
      {
        // Admin pages render per-user data. Force `no-store` so no upstream
        // proxy / CDN can ever cache and serve another admin's view.
        // Different keys merge additively with the global rule above.
        source: "/admin/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, max-age=0",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
