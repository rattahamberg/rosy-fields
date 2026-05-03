"use client";

import {
  DetailError,
  type DetailErrorProps,
} from "@/app/_components/detail-error";

export default function ExpenseError(props: DetailErrorProps) {
  return (
    <DetailError
      {...props}
      label="expense"
      logTag="expense-detail error"
    />
  );
}
