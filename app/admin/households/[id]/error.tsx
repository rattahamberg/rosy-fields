"use client";

import {
  DetailError,
  type DetailErrorProps,
} from "@/app/_components/detail-error";

export default function HouseholdDetailError(props: DetailErrorProps) {
  return (
    <DetailError
      {...props}
      label="household"
      logTag="admin household-detail error"
    />
  );
}
