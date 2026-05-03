"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    setError(null);
    try {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            router.push("/login");
          },
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign out failed");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={() => void handleSignOut()}
        disabled={pending}
        className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
