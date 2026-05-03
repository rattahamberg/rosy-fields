// Centralized limits and tunables for the admin panel.

export const ADMIN_USER_PAGE_SIZE = 25;

// Picker selects (households on user-detail, users on household-detail).
// LIMIT 200 is the v1 ceiling; v2 should swap these for a search combobox.
export const ADMIN_HOUSEHOLD_PICKER_LIMIT = 200;
export const ADMIN_USER_PICKER_LIMIT = 200;

// Trigram (`gin_trgm_ops`) requires at least 3 characters to use the index.
// Searches shorter than this fall back to a sequential scan, so we gate them.
export const ADMIN_SEARCH_MIN_LENGTH = 3;

// Cap displayed error text from the URL to avoid screen-junk attacks.
export const ADMIN_ERROR_DISPLAY_MAX = 200;
