"use client";

import {
  DetailError,
  type DetailErrorProps,
} from "@/app/_components/detail-error";

export default function HouseholdError(props: DetailErrorProps) {
  return (
    <DetailError
      {...props}
      label="household"
      logTag="household-detail error"
    />
  );
}
