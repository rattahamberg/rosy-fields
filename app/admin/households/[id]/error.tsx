"use client";

import { AdminDetailError } from "@/app/admin/_components";

export default function HouseholdDetailError(props: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <AdminDetailError
      {...props}
      label="household"
      logTag="admin household-detail error"
    />
  );
}
