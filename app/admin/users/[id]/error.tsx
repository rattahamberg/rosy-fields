"use client";

import { AdminDetailError } from "@/app/admin/_components";

export default function UserDetailError(props: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <AdminDetailError
      {...props}
      label="user"
      logTag="admin user-detail error"
    />
  );
}
