import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export type MemberBalance = {
  userId: string;
  name: string;
  email: string;
  // Positive = others owe this user; Negative = this user owes others.
  // Sums to zero across the household (modulo the equal-split-remainder
  // distribution which keeps every expense's splits exact-summing).
  balanceCents: bigint;
};

// Computes per-member net balance for a household by summing:
//   + all expense.amount_cents this user fronted
//   - all expense_split.share_cents this user owes
//   + all settlement.amount_cents this user RECEIVED
//   - all settlement.amount_cents this user PAID OUT
// Excludes soft-deleted rows.
export async function computeBalances(
  householdId: string,
): Promise<MemberBalance[]> {
  const rows = await db.execute<{
    user_id: string;
    name: string;
    email: string;
    balance_cents: string;
  }>(sql`
    WITH owed AS (
      SELECT es.user_id, SUM(es.share_cents)::bigint AS owed_cents
      FROM expense_split es
      JOIN expense e ON e.id = es.expense_id
      WHERE e.household_id = ${householdId} AND e.deleted_at IS NULL
      GROUP BY es.user_id
    ),
    paid AS (
      SELECT paid_by AS user_id, SUM(amount_cents)::bigint AS paid_cents
      FROM expense
      WHERE household_id = ${householdId} AND deleted_at IS NULL
      GROUP BY paid_by
    ),
    settled_out AS (
      SELECT from_user_id AS user_id, SUM(amount_cents)::bigint AS settled_out_cents
      FROM settlement
      WHERE household_id = ${householdId} AND deleted_at IS NULL
      GROUP BY from_user_id
    ),
    settled_in AS (
      SELECT to_user_id AS user_id, SUM(amount_cents)::bigint AS settled_in_cents
      FROM settlement
      WHERE household_id = ${householdId} AND deleted_at IS NULL
      GROUP BY to_user_id
    )
    SELECT u.id AS user_id, u.name, u.email,
      (COALESCE(p.paid_cents, 0)
        - COALESCE(o.owed_cents, 0)
        + COALESCE(si.settled_in_cents, 0)
        - COALESCE(so.settled_out_cents, 0))::bigint AS balance_cents
    FROM "user" u
    JOIN household_member hm ON hm.user_id = u.id
    LEFT JOIN paid p ON p.user_id = u.id
    LEFT JOIN owed o ON o.user_id = u.id
    LEFT JOIN settled_in si ON si.user_id = u.id
    LEFT JOIN settled_out so ON so.user_id = u.id
    WHERE hm.household_id = ${householdId}
    ORDER BY u.email
  `);
  // pg returns bigints as strings via text protocol; convert.
  return rows.rows.map((r) => ({
    userId: r.user_id,
    name: r.name,
    email: r.email,
    balanceCents: BigInt(r.balance_cents),
  }));
}

export type SettleSuggestion = {
  fromUserId: string;
  toUserId: string;
  amountCents: bigint;
};

// Greedy "simplify debts": repeatedly match the largest debtor with the
// largest creditor and settle the smaller of the two. Produces at most
// (n - 1) suggested transfers — the minimum guaranteed by linear-algebra
// arguments to zero out an n-party balance vector.
export function simplifyDebts(
  balances: MemberBalance[],
): SettleSuggestion[] {
  // Work on a mutable copy of {userId, balance} pairs.
  const pool = balances
    .map((b) => ({ userId: b.userId, balance: b.balanceCents }))
    .filter((b) => b.balance !== 0n);

  const out: SettleSuggestion[] = [];

  while (pool.length > 1) {
    // Sort each iteration: cheap for hobby-scale member counts.
    pool.sort((a, b) => {
      if (a.balance < b.balance) return -1;
      if (a.balance > b.balance) return 1;
      return 0;
    });
    const debtor = pool[0]; // most negative
    const creditor = pool[pool.length - 1]; // most positive
    if (!debtor || !creditor) break;
    if (debtor.balance >= 0n || creditor.balance <= 0n) break;

    const owe = -debtor.balance;
    const transfer = owe < creditor.balance ? owe : creditor.balance;
    out.push({
      fromUserId: debtor.userId,
      toUserId: creditor.userId,
      amountCents: transfer,
    });
    debtor.balance += transfer;
    creditor.balance -= transfer;

    // Remove zeroed entries from the pool.
    if (debtor.balance === 0n) pool.shift();
    if (creditor.balance === 0n) {
      const idx = pool.findIndex((p) => p.userId === creditor.userId);
      if (idx >= 0) pool.splice(idx, 1);
    }
  }

  return out;
}
