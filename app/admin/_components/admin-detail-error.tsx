"use client";

// Re-export of the now-shared DetailError. Kept here so the admin barrel
// continues to expose AdminDetailError + AdminDetailErrorProps without
// breaking import paths in the admin tree.
export {
  DetailError as AdminDetailError,
  type DetailErrorProps as AdminDetailErrorProps,
} from "@/app/_components/detail-error";
