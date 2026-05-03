import type { NextConfig } from "next";

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
  // Conservative CSP. Permits inline styles (Tailwind) and Next.js's required
  // inline scripts via 'self' + 'unsafe-inline'. Tighten with a nonce-based
  // policy if you start serving sensitive PII or accept third-party content.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' wss: https:",
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
