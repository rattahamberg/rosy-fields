import type { Metadata } from "next";
import Link from "next/link";
import { verifyHouseholdMember } from "@/lib/household/dal";
import { listExpensesQuery } from "@/lib/household/queries";
import { fromCentsToString } from "@/lib/household/money";

export const metadata: Metadata = {
  title: "Expenses",
};

type Params = Promise<{ id: string }>;

const PAGE_LIMIT = 50;

export default async function ExpensesListPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  await verifyHouseholdMember(id);
  const expenses = await listExpensesQuery(id, PAGE_LIMIT);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Expenses</h1>
        <Link
          href={`/dashboard/households/${id}/expenses/new`}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Add expense
        </Link>
      </div>
      {expenses.length === 0 ? (
        <p className="rounded-md border border-zinc-200 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800">
          No expenses yet.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {expenses.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
            >
              <Link
                href={`/dashboard/households/${id}/expenses/${e.id}`}
                className="flex-1 truncate"
              >
                <span className="font-medium hover:underline">
                  {e.description}
                </span>
                <span className="ml-2 text-xs text-zinc-500">
                  {e.paidByName} paid · {e.splitMode}
                </span>
              </Link>
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <span>{e.spentAt}</span>
                <span className="font-mono text-zinc-800 dark:text-zinc-200">
                  {fromCentsToString(e.amountCents, e.currency)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {expenses.length === PAGE_LIMIT && (
        <p className="text-xs text-zinc-500">
          Showing the most recent {PAGE_LIMIT}. Older entries aren&apos;t paged
          in v1.
        </p>
      )}
    </div>
  );
}
