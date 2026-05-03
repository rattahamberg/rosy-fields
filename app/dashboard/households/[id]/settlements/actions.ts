"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { loadHouseholdContext } from "@/lib/household/dal";
import { readNetworkContext } from "@/lib/admin/audit";
import { writeHouseholdAudit } from "@/lib/household/audit";
import { db } from "@/lib/db";
import { settlement } from "@/lib/db/schema";
import { fromStringToCents, serializeMoney } from "@/lib/household/money";
import type { FormState } from "@/lib/forms";

const NOTE_MAX = 200;

// ---------- recordSettlementAction ----------

export async function recordSettlementAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const householdId = String(formData.get("householdId") ?? "");
  const fromUserId = String(formData.get("fromUserId") ?? "");
  const toUserId = String(formData.get("toUserId") ?? "");
  const settledAtRaw = String(formData.get("settledAt") ?? "");
  const noteRaw = String(formData.get("note") ?? "").trim();

  if (!householdId) return { ok: false, error: "Missing household id" };
  if (!fromUserId || !toUserId) {
    return { ok: false, error: "Pick who paid and who was paid" };
  }
  if (fromUserId === toUserId) {
    return { ok: false, error: "Payer and payee must differ" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(settledAtRaw)) {
    return { ok: false, error: "Date must be YYYY-MM-DD" };
  }
  if (noteRaw.length > NOTE_MAX) {
    return { ok: false, error: `Note max ${NOTE_MAX} chars` };
  }

  let amountCents: bigint;
  try {
    amountCents = fromStringToCents(String(formData.get("amount") ?? ""));
  } catch {
    return { ok: false, error: "Amount must be a positive number" };
  }

  const { session, memberIds } = await loadHouseholdContext(householdId);
  if (!memberIds.has(fromUserId) || !memberIds.has(toUserId)) {
    return { ok: false, error: "Payer and payee must be household members" };
  }

  const net = await readNetworkContext();
  const id = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(settlement).values({
      id,
      householdId,
      fromUserId,
      toUserId,
      amountCents,
      settledAt: settledAtRaw,
      note: noteRaw || null,
      createdByUserId: session.user.id,
    });
    await writeHouseholdAudit(
      {
        householdId,
        actorUserId: session.user.id,
        actorEmail: session.user.email,
        action: "settlement.create",
        targetType: "settlement",
        targetId: id,
        metadata: {
          fromUserId,
          toUserId,
          amountCents: serializeMoney(amountCents),
        },
      },
      { client: tx, net },
    );
  });

  revalidatePath(`/dashboard/households/${householdId}`);
  revalidatePath(`/dashboard/households/${householdId}/settlements`);
  redirect(`/dashboard/households/${householdId}/settlements`);
}

// ---------- deleteSettlement ----------
//
// Permission: creator or either of the parties may delete (matches the
// "roommates self-police" stance documented in AGENTS.md).

export async function deleteSettlement(formData: FormData): Promise<void> {
  const householdId = String(formData.get("householdId") ?? "");
  const settlementId = String(formData.get("settlementId") ?? "");
  if (!householdId || !settlementId) {
    return redirect(`/dashboard/households/${householdId}`);
  }

  const { session } = await loadHouseholdContext(householdId);
  const net = await readNetworkContext();

  const outcome = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: settlement.id,
        householdId: settlement.householdId,
        fromUserId: settlement.fromUserId,
        toUserId: settlement.toUserId,
        amountCents: settlement.amountCents,
        createdByUserId: settlement.createdByUserId,
      })
      .from(settlement)
      .where(
        and(eq(settlement.id, settlementId), isNull(settlement.deletedAt)),
      )
      .for("update")
      .limit(1);
    if (!existing) return { status: "notFound" as const };
    if (existing.householdId !== householdId) {
      return { status: "notFound" as const };
    }
    const allowed = new Set([
      existing.createdByUserId ?? "",
      existing.fromUserId,
      existing.toUserId,
    ]);
    if (!allowed.has(session.user.id)) {
      return { status: "forbidden" as const };
    }
    // Re-check deletedAt in the UPDATE so a concurrent soft-delete doesn't
    // get its timestamp clobbered.
    const updated = await tx
      .update(settlement)
      .set({ deletedAt: new Date() })
      .where(
        and(eq(settlement.id, settlementId), isNull(settlement.deletedAt)),
      )
      .returning({ id: settlement.id });
    if (updated.length === 0) return { status: "raced" as const };
    await writeHouseholdAudit(
      {
        householdId,
        actorUserId: session.user.id,
        actorEmail: session.user.email,
        action: "settlement.delete",
        targetType: "settlement",
        targetId: settlementId,
        metadata: {
          fromUserId: existing.fromUserId,
          toUserId: existing.toUserId,
          amountCents: serializeMoney(existing.amountCents),
        },
      },
      { client: tx, net },
    );
    return { status: "ok" as const };
  });

  if (outcome.status === "notFound") {
    return redirect(
      `/dashboard/households/${householdId}/settlements?error=notFound`,
    );
  }
  if (outcome.status === "forbidden") {
    return redirect(
      `/dashboard/households/${householdId}/settlements?error=forbidden`,
    );
  }
  if (outcome.status === "raced") {
    return redirect(
      `/dashboard/households/${householdId}/settlements?error=raced`,
    );
  }

  revalidatePath(`/dashboard/households/${householdId}`);
  revalidatePath(`/dashboard/households/${householdId}/settlements`);
  redirect(`/dashboard/households/${householdId}/settlements`);
}
