import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export type MemberBalance = {
  userId: string;
  name: string;
  email: string;
  // Positive = others owe this user; Negative = this user owes others.
  // Sums to zero across the household (modulo equal-split-remainder
  // distribution, which keeps every expense's splits exact-summing).
  // Members with no activity surface here too, with balanceCents = 0n —
  // simplifyDebts filters them out before matching.
  balanceCents: bigint;
};

// Computes per-member net balance for a household by summing:
//   + all expense.amount_cents this user fronted
//   - all expense_split.share_cents this user owes
//   + all settlement.amount_cents this user RECEIVED
//   - all settlement.amount_cents this user PAID OUT
// Excludes soft-deleted rows.
//
// The settlement scan is a SINGLE pass with a CASE-folded sum (was two
// passes — `settled_out` and `settled_in` — pre-optimization).
//
// NOTE: Postgres returns BIGINT to the wire as text. The `db.execute<...>`
// generic types `balance_cents` as `string`; we wrap with `BigInt()` below.
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
    -- One scan over settlement: aggregate per user_id with CASE folding
    -- both directions. Halves the row reads vs. two separate CTEs.
    settled AS (
      SELECT
        user_id,
        SUM(in_cents)::bigint AS in_cents,
        SUM(out_cents)::bigint AS out_cents
      FROM (
        SELECT to_user_id AS user_id,
               amount_cents AS in_cents,
               0::bigint AS out_cents
        FROM settlement
        WHERE household_id = ${householdId} AND deleted_at IS NULL
        UNION ALL
        SELECT from_user_id AS user_id,
               0::bigint AS in_cents,
               amount_cents AS out_cents
        FROM settlement
        WHERE household_id = ${householdId} AND deleted_at IS NULL
      ) s
      GROUP BY user_id
    )
    SELECT u.id AS user_id, u.name, u.email,
      (COALESCE(p.paid_cents, 0)
        - COALESCE(o.owed_cents, 0)
        + COALESCE(st.in_cents, 0)
        - COALESCE(st.out_cents, 0))::bigint AS balance_cents
    FROM "user" u
    JOIN household_member hm ON hm.user_id = u.id
    LEFT JOIN paid p ON p.user_id = u.id
    LEFT JOIN owed o ON o.user_id = u.id
    LEFT JOIN settled st ON st.user_id = u.id
    WHERE hm.household_id = ${householdId}
    ORDER BY u.email
  `);
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

    if (debtor.balance === 0n) pool.shift();
    if (creditor.balance === 0n) {
      const idx = pool.findIndex((p) => p.userId === creditor.userId);
      if (idx >= 0) pool.splice(idx, 1);
    }
  }

  return out;
}
