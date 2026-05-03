import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { verifyHouseholdMember } from "@/lib/household/dal";
import { db } from "@/lib/db";
import { householdMember, user } from "@/lib/db/schema";
import { ExpenseForm } from "../expense-form";

export const metadata: Metadata = {
  title: "New expense",
};

type Params = Promise<{ id: string }>;

export default async function NewExpensePage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const session = await verifyHouseholdMember(id);

  const members = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(householdMember)
    .innerJoin(user, eq(user.id, householdMember.userId))
    .where(eq(householdMember.householdId, id))
    .orderBy(asc(user.name));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">New expense</h1>
      <ExpenseForm
        mode="create"
        householdId={id}
        members={members}
        currentUserId={session.user.id}
      />
    </div>
  );
}
