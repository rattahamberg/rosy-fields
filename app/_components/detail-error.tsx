"use client";

import { useEffect } from "react";
import { SHOW_DIGEST } from "@/lib/env";

// Generic per-detail-page error boundary. Used by both admin and household
// detail pages — a row-level failure surfaces here without unmounting the
// outer shell + nav.
//
// Next 16 passes BOTH `reset` and `unstable_retry`; we use `unstable_retry`
// (re-fetches Server Component data) and accept `reset` for forwards-compat.
// `unstable_retry` is canary; expect a rename to `retry` once stable.
export type DetailErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  unstable_retry: () => void;
};

export function DetailError({
  error,
  unstable_retry,
  label,
  logTag,
}: DetailErrorProps & {
  label: string;
  logTag: string;
}) {
  useEffect(() => {
    console.error(logTag, error);
  }, [error, logTag]);

  return (
    <div className="space-y-4 rounded-md border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
      <h2 className="text-sm font-semibold text-red-900 dark:text-red-200">
        Couldn&apos;t load this {label}
      </h2>
      {SHOW_DIGEST && error.digest ? (
        <p className="text-xs text-red-800 dark:text-red-300">
          Reference: <code>{error.digest}</code>
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => unstable_retry()}
        className="rounded bg-red-600 px-3 py-1.5 text-sm text-white"
      >
        Try again
      </button>
    </div>
  );
}
