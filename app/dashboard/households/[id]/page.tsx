import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { verifyHouseholdMember } from "@/lib/household/dal";
import { computeBalances, simplifyDebts } from "@/lib/household/balance";
import {
  listExpensesQuery,
  listSettlementsQuery,
} from "@/lib/household/queries";
import { centsToDecimalString, fromCentsToString } from "@/lib/household/money";
import { db } from "@/lib/db";
import { household } from "@/lib/db/schema";
import { PrimaryButton } from "@/app/_components/primary-button";

export const metadata: Metadata = {
  title: "Overview",
};

type Params = Promise<{ id: string }>;

const RECENT_LIMIT = 8;

// Hoisted out of HouseholdHome — type lives at module scope so it's
// findable and doesn't imply runtime-closure dependencies.
type ActivityItem = {
  kind: "expense" | "settlement";
  id: string;
  date: string;
  title: string;
  subtitle: string;
  amount: bigint;
  href: string;
};

export default async function HouseholdHome({ params }: { params: Params }) {
  const { id } = await params;
  const session = await verifyHouseholdMember(id);

  const [target, balances, recentExpenses, recentSettlements] =
    await Promise.all([
      db
        .select({ id: household.id, name: household.name })
        .from(household)
        .where(eq(household.id, id))
        .limit(1)
        .then((r) => r[0]),
      computeBalances(id),
      listExpensesQuery(id, RECENT_LIMIT),
      listSettlementsQuery(id, RECENT_LIMIT),
    ]);

  if (!target) notFound();

  const suggestions = simplifyDebts(balances);
  const balanceById = new Map(balances.map((b) => [b.userId, b]));

  const activity: ActivityItem[] = [
    ...recentExpenses.map((e) => ({
      kind: "expense" as const,
      id: e.id,
      date: e.spentAt,
      title: e.description,
      subtitle: `${e.paidByName} paid`,
      amount: e.amountCents,
      href: `/dashboard/households/${id}/expenses/${e.id}`,
    })),
    ...recentSettlements.map((s) => ({
      kind: "settlement" as const,
      id: s.id,
      date: s.settledAt,
      title: `${s.fromName} → ${s.toName}`,
      subtitle: s.note ?? "Settlement",
      amount: s.amountCents,
      href: `/dashboard/households/${id}/settlements`,
    })),
  ]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, RECENT_LIMIT);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{target.name}</h1>
        <Link
          href={`/dashboard/households/${id}/expenses/new`}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Add expense
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Balances
        </h2>
        <div className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
          {balances.length === 0 ? (
            <p className="px-4 py-3 text-sm text-zinc-500">
              No members yet.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {balances.map((b) => {
                const isYou = b.userId === session.user.id;
                const positive = b.balanceCents > 0n;
                const negative = b.balanceCents < 0n;
                return (
                  <li
                    key={b.userId}
                    className="flex items-center justify-between px-4 py-3 text-sm"
                  >
                    <span>
                      {b.name}
                      {isYou ? (
                        <span className="ml-2 text-xs text-zinc-500">(you)</span>
                      ) : null}
                    </span>
                    <span
                      className={
                        positive
                          ? "font-mono text-emerald-600 dark:text-emerald-400"
                          : negative
                            ? "font-mono text-red-600 dark:text-red-400"
                            : "font-mono text-zinc-500"
                      }
                    >
                      {b.balanceCents === 0n
                        ? "settled"
                        : positive
                          ? `+ ${fromCentsToString(b.balanceCents)} owed to them`
                          : `- ${fromCentsToString(-b.balanceCents)} owed by them`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {suggestions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Suggested settlements
          </h2>
          <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {suggestions.map((s, i) => {
                const from = balanceById.get(s.fromUserId);
                const to = balanceById.get(s.toUserId);
                return (
                  <li
                    key={`${s.fromUserId}-${s.toUserId}-${i}`}
                    className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                  >
                    <span>
                      <strong>{from?.name ?? "?"}</strong> pays{" "}
                      <strong>{to?.name ?? "?"}</strong>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="font-mono text-zinc-700 dark:text-zinc-300">
                        {fromCentsToString(s.amountCents)}
                      </span>
                      {s.fromUserId === session.user.id ||
                      s.toUserId === session.user.id ? (
                        <Link
                          href={`/dashboard/households/${id}/settlements/new?fromUserId=${s.fromUserId}&toUserId=${s.toUserId}&amount=${centsToDecimalString(s.amountCents)}`}
                          className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                        >
                          Record →
                        </Link>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <p className="text-xs text-zinc-500">
            Greedy pairing — minimum number of transfers to zero everyone out.
          </p>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Recent activity
          </h2>
          <Link
            href={`/dashboard/households/${id}/expenses`}
            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            All expenses →
          </Link>
        </div>
        {activity.length === 0 ? (
          <p className="rounded-md border border-zinc-200 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800">
            No activity yet.{" "}
            <Link
              href={`/dashboard/households/${id}/expenses/new`}
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Add the first expense.
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {activity.map((a) => (
              <li
                key={`${a.kind}-${a.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
              >
                <Link
                  href={a.href}
                  className="flex-1 truncate hover:underline"
                >
                  <span className="font-medium">{a.title}</span>
                  <span className="ml-2 text-xs text-zinc-500">
                    {a.kind === "expense" ? "expense" : "settlement"} ·{" "}
                    {a.subtitle}
                  </span>
                </Link>
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <span>{a.date}</span>
                  <span className="font-mono">
                    {fromCentsToString(a.amount)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex items-center justify-between text-xs">
        <Link
          href={`/dashboard/households/${id}/settlements/new`}
          className="text-blue-600 hover:underline dark:text-blue-400"
        >
          Record a settlement →
        </Link>
        <PrimaryButton size="sm" type="button" disabled>
          Manage members (admin)
        </PrimaryButton>
      </div>
    </div>
  );
}
