// Date utilities — small helpers used across forms.

// Today as a YYYY-MM-DD string (UTC). Used as the default value for
// `<input type="date">` fields in expense and settlement forms.
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
