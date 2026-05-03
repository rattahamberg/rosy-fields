import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { verifyHouseholdMember } from "@/lib/household/dal";
import { db } from "@/lib/db";
import { expense, expenseSplit, user } from "@/lib/db/schema";
import { fromCentsToString } from "@/lib/household/money";
import { deleteExpense } from "@/app/dashboard/households/[id]/expenses/actions";

export const metadata: Metadata = {
  title: "Expense",
};

type Params = Promise<{ id: string; expenseId: string }>;
type SearchParams = Promise<{ error?: string }>;

export default async function ExpenseDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id, expenseId } = await params;
  const { error } = await searchParams;
  const session = await verifyHouseholdMember(id);

  const [target] = await db
    .select({
      id: expense.id,
      householdId: expense.householdId,
      description: expense.description,
      amountCents: expense.amountCents,
      currency: expense.currency,
      spentAt: expense.spentAt,
      splitMode: expense.splitMode,
      notes: expense.notes,
      paidBy: expense.paidBy,
      paidByEmail: user.email,
      paidByName: user.name,
      createdByUserId: expense.createdByUserId,
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt,
    })
    .from(expense)
    .innerJoin(user, eq(user.id, expense.paidBy))
    .where(and(eq(expense.id, expenseId), isNull(expense.deletedAt)))
    .limit(1);

  if (!target || target.householdId !== id) notFound();

  const splits = await db
    .select({
      userId: expenseSplit.userId,
      shareCents: expenseSplit.shareCents,
      email: user.email,
      name: user.name,
    })
    .from(expenseSplit)
    .innerJoin(user, eq(user.id, expenseSplit.userId))
    .where(eq(expenseSplit.expenseId, expenseId));

  const canEdit =
    session.user.id === target.paidBy ||
    session.user.id === target.createdByUserId;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{target.description}</h1>
          <p className="text-sm text-zinc-500">
            {target.paidByName} paid {fromCentsToString(target.amountCents, target.currency)}{" "}
            on {target.spentAt}
          </p>
        </div>
        <Link
          href={`/dashboard/households/${id}/expenses`}
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          ← All expenses
        </Link>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
        >
          {error}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Split ({target.splitMode})
        </h2>
        <div className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {splits.map((s) => (
              <li
                key={s.userId}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span>{s.name}</span>
                <span className="font-mono text-zinc-700 dark:text-zinc-300">
                  {fromCentsToString(s.shareCents, target.currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {target.notes && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Notes
          </h2>
          <p className="rounded-md border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800">
            {target.notes}
          </p>
        </section>
      )}

      <section className="flex items-center gap-3 border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-zinc-800">
        <span>Recorded {target.createdAt.toISOString()}</span>
        {canEdit ? (
          <>
            <Link
              href={`/dashboard/households/${id}/expenses/${expenseId}/edit`}
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Edit
            </Link>
            <form action={deleteExpense}>
              <input type="hidden" name="householdId" value={id} />
              <input type="hidden" name="expenseId" value={expenseId} />
              <button
                type="submit"
                className="text-red-600 hover:underline dark:text-red-400"
              >
                Delete
              </button>
            </form>
          </>
        ) : null}
      </section>
    </div>
  );
}
