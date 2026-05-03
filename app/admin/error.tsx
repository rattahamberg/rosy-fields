"use client";

import { useEffect } from "react";
import { PrimaryButton } from "@/app/_components/primary-button";
import { SHOW_DIGEST } from "@/lib/env";

// `unstable_retry` (Next 16.2.0+) re-fetches and re-renders the boundary's
// children — preferred over `reset`, which only re-renders without re-fetching.
// The `unstable_` prefix is canary-API; expect it to become `retry` once stable.
export default function AdminError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  // Declared because Next 16's ErrorComponent passes it; we use unstable_retry
  // (re-fetches Server Component data) and ignore reset (re-render only).
  reset: () => void;
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("admin route error", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          An admin operation failed.
          {SHOW_DIGEST && error.digest ? (
            <>
              {" "}
              Reference: <code className="text-xs">{error.digest}</code>
            </>
          ) : null}
        </p>
        <PrimaryButton type="button" onClick={() => unstable_retry()}>
          Try again
        </PrimaryButton>
      </div>
    </div>
  );
}
