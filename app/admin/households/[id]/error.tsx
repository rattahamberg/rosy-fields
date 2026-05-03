"use client";

import {
  AdminDetailError,
  type AdminDetailErrorProps,
} from "@/app/admin/_components";

export default function HouseholdDetailError(props: AdminDetailErrorProps) {
  return (
    <AdminDetailError
      {...props}
      label="household"
      logTag="admin household-detail error"
    />
  );
}
