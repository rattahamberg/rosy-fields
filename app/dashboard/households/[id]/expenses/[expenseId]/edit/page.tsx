import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { verifyHouseholdMember } from "@/lib/household/dal";
import { db } from "@/lib/db";
import {
  expense,
  expenseSplit,
  householdMember,
  user,
} from "@/lib/db/schema";
import { ExpenseForm } from "../../expense-form";

export const metadata: Metadata = {
  title: "Edit expense",
};

type Params = Promise<{ id: string; expenseId: string }>;

export default async function EditExpensePage({
  params,
}: {
  params: Params;
}) {
  const { id, expenseId } = await params;
  const session = await verifyHouseholdMember(id);

  const [target] = await db
    .select({
      id: expense.id,
      householdId: expense.householdId,
      description: expense.description,
      amountCents: expense.amountCents,
      spentAt: expense.spentAt,
      splitMode: expense.splitMode,
      notes: expense.notes,
      paidBy: expense.paidBy,
      createdByUserId: expense.createdByUserId,
    })
    .from(expense)
    .where(and(eq(expense.id, expenseId), isNull(expense.deletedAt)))
    .limit(1);

  if (!target || target.householdId !== id) notFound();

  const canEdit =
    session.user.id === target.paidBy ||
    session.user.id === target.createdByUserId;
  if (!canEdit) notFound(); // hides the route from non-editors

  const splits = await db
    .select({ userId: expenseSplit.userId, shareCents: expenseSplit.shareCents })
    .from(expenseSplit)
    .where(eq(expenseSplit.expenseId, expenseId));

  const members = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(householdMember)
    .innerJoin(user, eq(user.id, householdMember.userId))
    .where(eq(householdMember.householdId, id))
    .orderBy(asc(user.name));

  const exact: Record<string, string> = {};
  const shares: Record<string, number> = {};
  for (const m of members) {
    shares[m.id] = 1;
    exact[m.id] = "";
  }
  for (const s of splits) {
    const n = Number(s.shareCents) / 100;
    exact[s.userId] = n.toFixed(2);
  }

  const initial = {
    expenseId,
    description: target.description,
    amount: (Number(target.amountCents) / 100).toFixed(2),
    paidBy: target.paidBy,
    spentAt: target.spentAt,
    splitMode: target.splitMode as "equal" | "shares" | "exact",
    notes: target.notes ?? "",
    participantIds: splits.map((s) => s.userId),
    shares,
    exact,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Edit expense</h1>
      <ExpenseForm
        mode="edit"
        householdId={id}
        members={members}
        currentUserId={session.user.id}
        initial={initial}
      />
    </div>
  );
}
