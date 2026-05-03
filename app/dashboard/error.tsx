"use client";

import { useEffect } from "react";
import { PrimaryButton } from "@/app/_components/primary-button";

const SHOW_DIGEST = process.env.NODE_ENV !== "production";

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("dashboard route error", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          We couldn&apos;t load your dashboard.
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
