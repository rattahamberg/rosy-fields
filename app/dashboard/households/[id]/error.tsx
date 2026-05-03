"use client";

import { AdminDetailError, type AdminDetailErrorProps } from "@/app/admin/_components";

// Reuses AdminDetailError — the visual styling is generic, not admin-specific.
// Rename this primitive to <DetailError> in a follow-up if it bothers anyone.
export default function HouseholdError(props: AdminDetailErrorProps) {
  return (
    <AdminDetailError
      {...props}
      label="household"
      logTag="household-detail error"
    />
  );
}
