// Centralized limits and tunables for the admin panel.

export const ADMIN_USER_PAGE_SIZE = 25;

// List ceilings — v2 should swap these for proper search comboboxes.
export const ADMIN_HOUSEHOLD_LIST_LIMIT = 200;
export const ADMIN_HOUSEHOLD_PICKER_LIMIT = 200;
export const ADMIN_USER_PICKER_LIMIT = 200;

// Trigram (`gin_trgm_ops`) requires at least 3 characters to use the index.
// Searches shorter than this fall back to a sequential scan, so we gate them.
export const ADMIN_SEARCH_MIN_LENGTH = 3;

// Cap displayed error text from the URL to avoid screen-junk attacks.
export const ADMIN_ERROR_DISPLAY_MAX = 200;

// Household name constraints — used by both the action validator and the
// HTML input maxLength so they stay in lockstep.
export const ADMIN_HOUSEHOLD_NAME_MIN = 1;
export const ADMIN_HOUSEHOLD_NAME_MAX = 100;
