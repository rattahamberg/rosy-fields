// Shared `useActionState` form state shape. Both admin and household
// Server Actions return this discriminated union. Don't redeclare it
// locally — import from here.
export type FormState = { ok: true } | { ok: false; error: string };
