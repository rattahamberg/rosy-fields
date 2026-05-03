"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createHouseholdAction,
  type FormState,
} from "@/app/admin/households/actions";

const INITIAL: FormState = { ok: false, error: "" };

export function NewHouseholdForm() {
  const [state, formAction, pending] = useActionState(
    createHouseholdAction,
    INITIAL,
  );
  const router = useRouter();

  // Successful creates return { ok: true, id } — navigate to the detail page.
  useEffect(() => {
    if (state.ok && state.id) router.push(`/admin/households/${state.id}`);
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="text-xs uppercase tracking-wide text-zinc-500">
          Name
        </span>
        <input
          type="text"
          name="name"
          required
          maxLength={100}
          autoFocus
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      {!state.ok && state.error ? (
        <p
          role="alert"
          className="text-sm text-red-600 dark:text-red-400"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? "Creating…" : "Create"}
        </button>
        <Link
          href="/admin/households"
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
