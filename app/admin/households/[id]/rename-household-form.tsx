"use client";

import { useActionState } from "react";
import {
  renameHouseholdAction,
  type FormState,
} from "@/app/admin/households/actions";
import { ADMIN_HOUSEHOLD_NAME_MAX } from "@/lib/admin/config";

const INITIAL: FormState = { ok: false, error: "" };

export function RenameHouseholdForm({
  householdId,
  currentName,
}: {
  householdId: string;
  currentName: string;
}) {
  const [state, formAction, pending] = useActionState(
    renameHouseholdAction,
    INITIAL,
  );

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="householdId" value={householdId} />
      <label className="flex flex-1 flex-col gap-1 text-xs text-zinc-500">
        Name
        <input
          type="text"
          name="name"
          defaultValue={currentName}
          required
          maxLength={ADMIN_HOUSEHOLD_NAME_MAX}
          className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {!state.ok && state.error ? (
        <p
          role="alert"
          className="basis-full text-xs text-red-600 dark:text-red-400"
        >
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="basis-full text-xs text-emerald-600 dark:text-emerald-400">
          Saved.
        </p>
      ) : null}
    </form>
  );
}
