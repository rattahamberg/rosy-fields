"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import {
  createExpenseAction,
  editExpenseAction,
  type FormState,
} from "@/app/dashboard/households/[id]/expenses/actions";
import { PrimaryButton } from "@/app/_components/primary-button";
import { MoneyInput } from "@/app/_components/money-input";

export type Member = { id: string; name: string; email: string };

type SplitMode = "equal" | "shares" | "exact";

const TODAY = () => new Date().toISOString().slice(0, 10);

const INITIAL: FormState = { ok: false, error: "" };

type ExistingValues = {
  expenseId: string;
  description: string;
  amount: string; // already-formatted decimal e.g. "12.34"
  paidBy: string;
  spentAt: string;
  splitMode: SplitMode;
  notes: string;
  participantIds: string[];
  shares: Record<string, number>; // by user id
  exact: Record<string, string>; // by user id, decimal string
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

  const exactSum = useMemo(() => {
    let s = 0;
    for (const id of participantIds) {
      const v = Number(exact[id] ?? "0");
      if (Number.isFinite(v)) s += v;
    }
    return Math.round(s * 100) / 100;
  }, [participantIds, exact]);

  const amountNumber = Number(amount);
  const exactRemaining =
    Number.isFinite(amountNumber) && splitMode === "exact"
      ? Math.round((amountNumber - exactSum) * 100) / 100
      : 0;

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
            onChange={(e) => setAmount(e.currentTarget.value)}
            className="w-full"
          />
        </Field>
        <Field label="Date">
          <input
            type="date"
            name="spentAt"
            defaultValue={initial?.spentAt ?? TODAY()}
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
          {(["equal", "shares", "exact"] as const).map((m) => (
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

        {splitMode === "exact" && amountNumber > 0 ? (
          <p
            className={`text-xs font-mono ${
              exactRemaining === 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-700 dark:text-amber-300"
            }`}
          >
            Remaining: {exactRemaining.toFixed(2)} (must reach 0.00 to submit)
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
