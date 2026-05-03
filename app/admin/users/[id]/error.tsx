"use client";

import { useEffect } from "react";

const SHOW_DIGEST = process.env.NODE_ENV !== "production";

// Per-detail-page error boundary: a throw inside the user-detail page
// surfaces here without unmounting the admin shell + nav.
export default function UserDetailError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("admin user-detail error", error);
  }, [error]);

  return (
    <div className="space-y-4 rounded-md border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
      <h2 className="text-sm font-semibold text-red-900 dark:text-red-200">
        Couldn&apos;t load this user
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
