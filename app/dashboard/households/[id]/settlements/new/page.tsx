import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { verifyHouseholdMember } from "@/lib/household/dal";
import { db } from "@/lib/db";
import { householdMember, user } from "@/lib/db/schema";
import { SettlementForm } from "../settlement-form";

export const metadata: Metadata = {
  title: "Record settlement",
};

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{
  fromUserId?: string;
  toUserId?: string;
  amount?: string;
}>;

export default async function NewSettlementPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const session = await verifyHouseholdMember(id);

  const members = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(householdMember)
    .innerJoin(user, eq(user.id, householdMember.userId))
    .where(eq(householdMember.householdId, id))
    .orderBy(asc(user.name));

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-xl font-semibold">Record settlement</h1>
      <SettlementForm
        householdId={id}
        members={members}
        currentUserId={session.user.id}
        prefill={{
          fromUserId: sp.fromUserId,
          toUserId: sp.toUserId,
          amount: sp.amount,
        }}
      />
    </div>
  );
}
