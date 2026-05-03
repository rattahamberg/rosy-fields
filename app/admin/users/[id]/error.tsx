"use client";

import {
  AdminDetailError,
  type AdminDetailErrorProps,
} from "@/app/admin/_components";

export default function UserDetailError(props: AdminDetailErrorProps) {
  return (
    <AdminDetailError
      {...props}
      label="user"
      logTag="admin user-detail error"
    />
  );
}
