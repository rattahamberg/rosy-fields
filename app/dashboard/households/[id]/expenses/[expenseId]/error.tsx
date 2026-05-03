"use client";

import { AdminDetailError, type AdminDetailErrorProps } from "@/app/admin/_components";

export default function ExpenseError(props: AdminDetailErrorProps) {
  return (
    <AdminDetailError
      {...props}
      label="expense"
      logTag="expense-detail error"
    />
  );
}
