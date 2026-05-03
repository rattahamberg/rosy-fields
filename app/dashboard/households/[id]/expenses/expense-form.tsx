"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import {
  createExpenseAction,
  editExpenseAction,
} from "@/app/dashboard/households/[id]/expenses/actions";
import type { FormState } from "@/lib/forms";
import { PrimaryButton } from "@/app/_components/primary-button";
import { MoneyInput } from "@/app/_components/money-input";
import {
  centsToDecimalString,
  fromStringToCents,
} from "@/lib/household/money";
import type { Member } from "@/lib/household/queries";
import { SPLIT_MODES, type SplitMode } from "@/lib/household/expense-constants";
import { todayISO } from "@/lib/dates";

const INITIAL: FormState = { ok: false, error: "" };

export type ExistingValues = {
  expenseId: string;
  description: string;
  amount: string; // decimal string e.g. "12.34"
  paidBy: string;
  spentAt: string;
  splitMode: SplitMode;
  notes: string;
  participantIds: string[];
  shares: Record<string, number>;
  exact: Record<string, string>;
};

export function ExpenseForm({
  mode,
  householdId,
  members,
  currentUserId,
  initial,
}: {
  mode: "create" | "edit";
  householdId: string;
  members: Member[];
  currentUserId: string;
  initial?: ExistingValues;
}) {
  const [state, formAction, pending] = useActionState(
    mode === "edit" ? editExpenseAction : createExpenseAction,
    INITIAL,
  );

  const [splitMode, setSplitMode] = useState<SplitMode>(
    initial?.splitMode ?? "equal",
  );
  const [participantIds, setParticipantIds] = useState<Set<string>>(
    new Set(initial?.participantIds ?? members.map((m) => m.id)),
  );
  const [shares, setShares] = useState<Record<string, number>>(
    initial?.shares ?? Object.fromEntries(members.map((m) => [m.id, 1])),
  );
  const [exact, setExact] = useState<Record<string, string>>(
    initial?.exact ?? Object.fromEntries(members.map((m) => [m.id, ""])),
  );
  const [amount, setAmount] = useState(initial?.amount ?? "");

  // Bigint accumulation: parse each row's exact value into cents (skipping
  // unparseable / empty), sum, compare against the total. Avoids the
  // 0.1+0.2=0.30000000000000004 floating-point trap on the display hint.
  const remainingCents = useMemo(() => {
    if (splitMode !== "exact" || !amount) return 0n;
    let amountCents: bigint;
    try {
      amountCents = fromStringToCents(amount);
    } catch {
      // User is mid-typing or input is invalid — treat amount as 0.
      return 0n;
    }
    let sum = 0n;
    for (const id of participantIds) {
      const raw = exact[id];
      if (!raw) continue;
      try {
        sum += fromStringToCents(raw);
      } catch {
        // Skip rows the user is mid-typing.
      }
    }
    return amountCents - sum;
  }, [splitMode, amount, participantIds, exact]);

  function toggleParticipant(id: string) {
    setParticipantIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="householdId" value={householdId} />
      {mode === "edit" && initial ? (
        <input type="hidden" name="previousId" value={initial.expenseId} />
      ) : null}

      <Field label="Description">
        <input
          type="text"
          name="description"
          defaultValue={initial?.description ?? ""}
          required
          maxLength={200}
          autoFocus
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Amount">
          <MoneyInput
            name="amount"
            defaultValue={amount}
            onValueChange={setAmount}
            className="w-full"
          />
        </Field>
        <Field label="Date">
          <input
            type="date"
            name="spentAt"
            defaultValue={initial?.spentAt ?? todayISO()}
            required
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </Field>
      </div>

      <Field label="Paid by">
        <select
          name="paidBy"
          defaultValue={initial?.paidBy ?? currentUserId}
          required
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="space-y-3">
        <span className="text-xs uppercase tracking-wide text-zinc-500">
          Split
        </span>
        <input type="hidden" name="splitMode" value={splitMode} />
        <div className="inline-flex rounded-md border border-zinc-300 dark:border-zinc-700">
          {SPLIT_MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setSplitMode(m)}
              className={`px-3 py-1.5 text-sm capitalize ${
                splitMode === m
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-700 dark:text-zinc-300"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {members.map((m) => {
              const checked = participantIds.has(m.id);
              return (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-4 px-4 py-2 text-sm"
                >
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleParticipant(m.id)}
                    />
                    {checked ? (
                      <input
                        type="hidden"
                        name="participantIds"
                        value={m.id}
                      />
                    ) : null}
                    <span>{m.name}</span>
                  </label>
                  {splitMode === "shares" && checked ? (
                    <input
                      type="number"
                      name={`shares:${m.id}`}
                      min={0}
                      step={1}
                      value={shares[m.id] ?? 1}
                      onChange={(e) =>
                        setShares((prev) => ({
                          ...prev,
                          [m.id]: Number(e.target.value),
                        }))
                      }
                      className="w-20 rounded border border-zinc-300 px-2 py-1 text-right text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  ) : null}
                  {splitMode === "exact" && checked ? (
                    <input
                      type="text"
                      inputMode="decimal"
                      name={`exact:${m.id}`}
                      placeholder="0.00"
                      value={exact[m.id] ?? ""}
                      onChange={(e) =>
                        setExact((prev) => ({
                          ...prev,
                          [m.id]: e.target.value,
                        }))
                      }
                      className="w-24 rounded border border-zinc-300 px-2 py-1 text-right font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>

        {splitMode === "exact" && amount.length > 0 ? (
          <p
            className={`text-xs font-mono ${
              remainingCents === 0n
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-700 dark:text-amber-300"
            }`}
          >
            Remaining: {centsToDecimalString(remainingCents)} (must reach 0.00 to submit)
          </p>
        ) : null}
      </div>

      <Field label="Notes (optional)">
        <textarea
          name="notes"
          defaultValue={initial?.notes ?? ""}
          rows={2}
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </Field>

      {!state.ok && state.error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <PrimaryButton disabled={pending}>
          {pending
            ? mode === "edit"
              ? "Saving…"
              : "Adding…"
            : mode === "edit"
              ? "Save changes"
              : "Add expense"}
        </PrimaryButton>
        <Link
          href={
            mode === "edit" && initial
              ? `/dashboard/households/${householdId}/expenses/${initial.expenseId}`
              : `/dashboard/households/${householdId}/expenses`
          }
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}
