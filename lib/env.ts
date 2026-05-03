// Build-time environment constants. Safe to import from client and server
// — `process.env.NODE_ENV` is statically replaced by Next during build.

// Whether to render diagnostic details (Error.digest, stack hints) in UI.
// Server logs always get the full error; this only gates what reaches the
// browser. Set to false in prod to avoid information disclosure.
export const SHOW_DIGEST = process.env.NODE_ENV !== "production";
