import { ADMIN_SEARCH_MIN_LENGTH } from "./config";

export type SearchEval = {
  trimmedQ: string;
  searchActive: boolean;
  searchTooShort: boolean;
};

// Trigram (`gin_trgm_ops`) requires ≥ 3 characters. Shorter queries would
// seq-scan, so list pages use this to gate before issuing the SQL.
export function evalSearch(q: string | undefined): SearchEval {
  const trimmedQ = q?.trim() ?? "";
  const searchActive = trimmedQ.length >= ADMIN_SEARCH_MIN_LENGTH;
  const searchTooShort = trimmedQ.length > 0 && !searchActive;
  return { trimmedQ, searchActive, searchTooShort };
}
