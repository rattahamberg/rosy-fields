import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Enables `forbidden()` / `unauthorized()` from `next/navigation`.
    // The admin DAL uses `forbidden()` so non-admins land on `app/forbidden.tsx`
    // instead of the generic 404 (which would hide that the route exists at all,
    // but also denies the user any explanation).
    authInterrupts: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
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
        ],
      },
    ];
  },
};

export default nextConfig;
