import type { Metadata } from "next";
import Link from "next/link";
import { verifyHouseholdMember } from "@/lib/household/dal";
import { listSettlementsQuery } from "@/lib/household/queries";
import { fromCentsToString } from "@/lib/household/money";
import { resolveErrorCode } from "@/lib/household/error-codes";
import { deleteSettlement } from "@/app/dashboard/households/[id]/settlements/actions";

export const metadata: Metadata = {
  title: "Settlements",
};

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string }>;

const PAGE_LIMIT = 50;

export default async function SettlementsListPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const session = await verifyHouseholdMember(id);
  const settlements = await listSettlementsQuery(id, PAGE_LIMIT);

  const errorMessage = resolveErrorCode(error, {
    notFound: "Settlement not found",
    forbidden: "Only the parties or creator can delete",
    raced: "Someone else just changed this settlement — refresh and try again",
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Settlements</h1>
        <Link
          href={`/dashboard/households/${id}/settlements/new`}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Record payment
        </Link>
      </div>

      {errorMessage && (
        <p
          role="alert"
          className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
        >
          {errorMessage}
        </p>
      )}

      {settlements.length === 0 ? (
        <p className="rounded-md border border-zinc-200 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800">
          No settlements recorded yet.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {settlements.map((s) => {
            const involved =
              s.fromUserId === session.user.id ||
              s.toUserId === session.user.id;
            return (
              <li
                key={s.id}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
              >
                <div className="flex-1 truncate">
                  <span className="font-medium">
                    {s.fromName} → {s.toName}
                  </span>
                  {s.note ? (
                    <span className="ml-2 text-xs text-zinc-500">
                      “{s.note}”
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <span>{s.settledAt}</span>
                  <span className="font-mono text-zinc-800 dark:text-zinc-200">
                    {fromCentsToString(s.amountCents, s.currency)}
                  </span>
                  {involved ? (
                    <form action={deleteSettlement}>
                      <input type="hidden" name="householdId" value={id} />
                      <input type="hidden" name="settlementId" value={s.id} />
                      <button
                        type="submit"
                        className="text-red-600 hover:underline dark:text-red-400"
                      >
                        Delete
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
