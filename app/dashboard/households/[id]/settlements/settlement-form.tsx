"use client";

import { useActionState } from "react";
import Link from "next/link";
import { recordSettlementAction } from "@/app/dashboard/households/[id]/settlements/actions";
import type { FormState } from "@/lib/forms";
import { PrimaryButton } from "@/app/_components/primary-button";
import { MoneyInput } from "@/app/_components/money-input";
import type { Member } from "@/lib/household/queries";

const TODAY = () => new Date().toISOString().slice(0, 10);

const INITIAL: FormState = { ok: false, error: "" };

export function SettlementForm({
  householdId,
  members,
  currentUserId,
  prefill,
}: {
  householdId: string;
  members: Member[];
  currentUserId: string;
  prefill?: { fromUserId?: string; toUserId?: string; amount?: string };
}) {
  const [state, formAction, pending] = useActionState(
    recordSettlementAction,
    INITIAL,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="householdId" value={householdId} />

      <label className="block space-y-1">
        <span className="text-xs uppercase tracking-wide text-zinc-500">
          From (paid)
        </span>
        <select
          name="fromUserId"
          defaultValue={prefill?.fromUserId ?? currentUserId}
          required
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-xs uppercase tracking-wide text-zinc-500">
          To (received)
        </span>
        <select
          name="toUserId"
          defaultValue={prefill?.toUserId ?? ""}
          required
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="" disabled>
            Pick a recipient
          </option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block space-y-1">
          <span className="text-xs uppercase tracking-wide text-zinc-500">
            Amount
          </span>
          <MoneyInput
            name="amount"
            defaultValue={prefill?.amount ?? ""}
            className="w-full"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs uppercase tracking-wide text-zinc-500">
            Date
          </span>
          <input
            type="date"
            name="settledAt"
            defaultValue={TODAY()}
            required
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-xs uppercase tracking-wide text-zinc-500">
          Note (optional)
        </span>
        <input
          type="text"
          name="note"
          maxLength={200}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      {!state.ok && state.error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <PrimaryButton disabled={pending}>
          {pending ? "Recording…" : "Record"}
        </PrimaryButton>
        <Link
          href={`/dashboard/households/${householdId}/settlements`}
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
