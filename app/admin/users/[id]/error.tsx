"use client";

import {
  DetailError,
  type DetailErrorProps,
} from "@/app/_components/detail-error";

export default function UserDetailError(props: DetailErrorProps) {
  return (
    <DetailError
      {...props}
      label="user"
      logTag="admin user-detail error"
    />
  );
}
