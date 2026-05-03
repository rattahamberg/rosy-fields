// Typed error codes used in `?error=...` redirects. Pages map the code to a
// human-readable message via `resolveErrorCode`; arbitrary codes (or no
// code) fall through to null. This is a closed enum — every action that
// redirects with an error must pick a code from this set.

export type LedgerErrorCode = "notFound" | "forbidden" | "raced";

const CODES: ReadonlySet<LedgerErrorCode> = new Set<LedgerErrorCode>([
  "notFound",
  "forbidden",
  "raced",
]);

export function isLedgerErrorCode(s: string): s is LedgerErrorCode {
  return CODES.has(s as LedgerErrorCode);
}

// Default messages. Pages can override per code via the `overrides` arg
// (e.g. "Expense not found" vs the default "Item not found").
export const DEFAULT_ERROR_MESSAGES: Record<LedgerErrorCode, string> = {
  notFound: "Item not found",
  forbidden: "You don't have permission to do that",
  raced: "Someone else just changed this — refresh and try again",
};

export function resolveErrorCode(
  code: string | undefined,
  overrides: Partial<Record<LedgerErrorCode, string>> = {},
): string | null {
  if (!code || !isLedgerErrorCode(code)) return null;
  return overrides[code] ?? DEFAULT_ERROR_MESSAGES[code];
}
