"use client";

import { useState } from "react";
import { deleteHousehold } from "@/app/admin/households/actions";

export function DeleteHouseholdForm({
  householdId,
  householdName,
  memberCount,
}: {
  householdId: string;
  householdName: string;
  memberCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-red-600 hover:underline dark:text-red-400"
      >
        Delete household…
      </button>
    );
  }

  const matches = confirmName === householdName;

  return (
    <form
      action={deleteHousehold}
      className="space-y-3 rounded-md border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30"
    >
      <input type="hidden" name="householdId" value={householdId} />
      <p className="text-sm">
        Delete <strong>{householdName}</strong>? This removes the household and
        its {memberCount} member link{memberCount === 1 ? "" : "s"}. User
        accounts are <em>not</em> deleted.
      </p>
      <p className="text-xs text-zinc-500">
        Type <code>{householdName}</code> to confirm.
      </p>
      <input
        type="text"
        name="confirmName"
        value={confirmName}
        onChange={(e) => setConfirmName(e.target.value)}
        className="w-full rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        autoFocus
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!matches}
          className="rounded bg-red-600 px-3 py-1.5 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Confirm delete
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setConfirmName("");
          }}
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
