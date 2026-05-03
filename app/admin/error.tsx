"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to whatever's wired up — for now just the browser console.
    console.error("admin route error", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          An admin operation failed.
          {error.digest ? (
            <>
              {" "}
              Reference: <code className="text-xs">{error.digest}</code>
            </>
          ) : null}
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
