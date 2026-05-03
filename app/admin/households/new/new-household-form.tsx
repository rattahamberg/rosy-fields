"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  createHouseholdAction,
  type FormState,
} from "@/app/admin/households/actions";
import { ADMIN_HOUSEHOLD_NAME_MAX } from "@/lib/admin/config";
import { PrimaryButton } from "@/app/_components/primary-button";

const INITIAL: FormState = { ok: false, error: "" };

export function NewHouseholdForm() {
  // The action calls `redirect(...)` itself on success — control never
  // returns to the client in that case, so there's no "ok" branch to handle.
  // `state` only flips when validation fails.
  const [state, formAction, pending] = useActionState(
    createHouseholdAction,
    INITIAL,
  );

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
          maxLength={ADMIN_HOUSEHOLD_NAME_MAX}
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
        <PrimaryButton disabled={pending}>
          {pending ? "Creating…" : "Create"}
        </PrimaryButton>
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
