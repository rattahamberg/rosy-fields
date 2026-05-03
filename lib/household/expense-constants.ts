// Canonical split modes. Imported by the action validator AND the edit-page
// runtime guard so they never drift apart.

export const SPLIT_MODES = ["equal", "shares", "exact"] as const;
export type SplitMode = (typeof SPLIT_MODES)[number];
export const SPLIT_MODE_SET: ReadonlySet<SplitMode> = new Set(SPLIT_MODES);

export function isSplitMode(s: string): s is SplitMode {
  return SPLIT_MODE_SET.has(s as SplitMode);
}
