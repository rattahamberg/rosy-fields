// Barrel for admin shared components — keeps page imports tidy.
//
// Intentionally excludes:
// - `AdminEmail` (server-only, transitively imports `lib/db` which has
//   `import "server-only"`). Client components like the error boundaries
//   import from this barrel — re-exporting AdminEmail would pull
//   `server-only` into the client bundle and break the build. Layout
//   imports AdminEmail directly from `./admin-email`.
// - `PrimaryButton` lives at `@/app/_components/primary-button` because
//   non-admin surfaces (login, signup) consume it too.

export { AdminDetailError, type AdminDetailErrorProps } from "./admin-detail-error";
export { AdminTable } from "./admin-table";
export { DataGrid } from "./data-grid";
export { DetailHeader } from "./detail-header";
export { Section } from "./section";
