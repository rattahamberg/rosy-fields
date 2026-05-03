import "server-only";

import { aliasedTable, and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { expense, settlement, user } from "@/lib/db/schema";

// Recent expenses for a household, with paid-by user joined. Excludes
// soft-deleted. Paged by limit; cursor pagination is v2.
export function listExpensesQuery(householdId: string, limit: number) {
  return db
    .select({
      id: expense.id,
      description: expense.description,
      amountCents: expense.amountCents,
      currency: expense.currency,
      spentAt: expense.spentAt,
      splitMode: expense.splitMode,
      paidBy: expense.paidBy,
      paidByEmail: user.email,
      paidByName: user.name,
      createdAt: expense.createdAt,
    })
    .from(expense)
    .innerJoin(user, eq(user.id, expense.paidBy))
    .where(
      and(eq(expense.householdId, householdId), isNull(expense.deletedAt)),
    )
    .orderBy(desc(expense.spentAt), desc(expense.createdAt))
    .limit(limit);
}

export type ExpenseListRow = Awaited<
  ReturnType<typeof listExpensesQuery>
>[number];

// Recent settlements for a household. Aliased user joins because we need
// both from_user and to_user from the same table.
export function listSettlementsQuery(householdId: string, limit: number) {
  const fromUser = aliasedTable(user, "from_user");
  const toUser = aliasedTable(user, "to_user");
  return db
    .select({
      id: settlement.id,
      amountCents: settlement.amountCents,
      currency: settlement.currency,
      note: settlement.note,
      settledAt: settlement.settledAt,
      fromUserId: settlement.fromUserId,
      fromEmail: fromUser.email,
      fromName: fromUser.name,
      toUserId: settlement.toUserId,
      toEmail: toUser.email,
      toName: toUser.name,
      createdAt: settlement.createdAt,
    })
    .from(settlement)
    .innerJoin(fromUser, eq(fromUser.id, settlement.fromUserId))
    .innerJoin(toUser, eq(toUser.id, settlement.toUserId))
    .where(
      and(
        eq(settlement.householdId, householdId),
        isNull(settlement.deletedAt),
      ),
    )
    .orderBy(desc(settlement.settledAt), desc(settlement.createdAt))
    .limit(limit);
}

export type SettlementListRow = Awaited<
  ReturnType<typeof listSettlementsQuery>
>[number];
