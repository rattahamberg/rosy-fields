"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { verifyAdmin } from "@/lib/admin/dal";
import { writeAudit } from "@/lib/admin/audit";
import { db } from "@/lib/db";
import { household, householdMember } from "@/lib/db/schema";
import { safePath } from "@/lib/safe-redirect";
import {
  ADMIN_HOUSEHOLD_NAME_MAX,
  ADMIN_HOUSEHOLD_NAME_MIN,
} from "@/lib/admin/config";

// ---------- shared helpers ----------

export type FormState = { ok: true; id?: string } | { ok: false; error: string };

function normalizeName(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (
    trimmed.length < ADMIN_HOUSEHOLD_NAME_MIN ||
    trimmed.length > ADMIN_HOUSEHOLD_NAME_MAX
  ) {
    return null;
  }
  return trimmed;
}

// Postgres FK violation. Used to convert race-condition errors into clean
// user-facing redirects without needing a pre-check (avoids TOCTOU).
const PG_FK_VIOLATION = "23503";

function isFkViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === PG_FK_VIOLATION
  );
}

// ---------- useActionState-style: createHousehold ----------

export async function createHouseholdAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await verifyAdmin();
  const name = normalizeName(formData.get("name"));
  if (!name) {
    return {
      ok: false,
      error: `Name must be ${ADMIN_HOUSEHOLD_NAME_MIN}–${ADMIN_HOUSEHOLD_NAME_MAX} characters`,
    };
  }

  const id = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(household).values({
      id,
      name,
      createdByUserId: session.user.id,
    });
    await writeAudit(
      {
        actorUserId: session.user.id,
        actorEmail: session.user.email,
        action: "household.create",
        targetType: "household",
        targetId: id,
        metadata: { name },
      },
      tx,
    );
  });

  revalidatePath("/admin/households");
  return { ok: true, id };
}

// ---------- useActionState-style: renameHousehold ----------

export async function renameHouseholdAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await verifyAdmin();
  const householdId = String(formData.get("householdId") ?? "");
  const name = normalizeName(formData.get("name"));
  if (!householdId) return { ok: false, error: "Missing household id" };
  if (!name) {
    return {
      ok: false,
      error: `Name must be ${ADMIN_HOUSEHOLD_NAME_MIN}–${ADMIN_HOUSEHOLD_NAME_MAX} characters`,
    };
  }

  let updated = false;
  await db.transaction(async (tx) => {
    const result = await tx
      .update(household)
      .set({ name })
      .where(eq(household.id, householdId))
      .returning({ id: household.id });
    if (result.length === 0) return;
    updated = true;
    await writeAudit(
      {
        actorUserId: session.user.id,
        actorEmail: session.user.email,
        action: "household.rename",
        targetType: "household",
        targetId: householdId,
        metadata: { name },
      },
      tx,
    );
  });

  if (!updated) return { ok: false, error: "Household not found" };

  revalidatePath(`/admin/households/${householdId}`);
  revalidatePath("/admin/households");
  return { ok: true, id: householdId };
}

// ---------- redirect-style mutations ----------

export async function deleteHousehold(formData: FormData): Promise<void> {
  const session = await verifyAdmin();
  const householdId = String(formData.get("householdId") ?? "");
  const confirmName = String(formData.get("confirmName") ?? "").trim();
  if (!householdId) return redirect("/admin/households");

  // Lookup, name-check, and delete in one transaction with row lock — closes
  // the TOCTOU window where a concurrent rename could let an admin delete
  // the wrong household.
  let deletedName: string | null = null;
  let confirmFailed = false;
  let notFoundFlag = false;

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: household.id, name: household.name })
      .from(household)
      .where(eq(household.id, householdId))
      .for("update")
      .limit(1);
    if (!existing) {
      notFoundFlag = true;
      return;
    }
    if (confirmName !== existing.name) {
      confirmFailed = true;
      return;
    }
    await tx.delete(household).where(eq(household.id, householdId));
    deletedName = existing.name;
    await writeAudit(
      {
        actorUserId: session.user.id,
        actorEmail: session.user.email,
        action: "household.delete",
        targetType: "household",
        targetId: householdId,
        metadata: { name: existing.name },
      },
      tx,
    );
  });

  if (notFoundFlag) {
    return redirect(
      `/admin/households?error=${encodeURIComponent("Household not found")}`,
    );
  }
  if (confirmFailed) {
    return redirect(
      `/admin/households/${householdId}?error=${encodeURIComponent(
        "Confirmation name did not match",
      )}`,
    );
  }
  // Mark deletedName as used (lint defense; it's intentionally captured for
  // the audit metadata above).
  void deletedName;

  revalidatePath("/admin/households");
  return redirect("/admin/households");
}

export async function addMember(formData: FormData): Promise<void> {
  const session = await verifyAdmin();
  const householdId = String(formData.get("householdId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const redirectTo = safePath(
    formData.get("redirectTo")?.toString(),
    `/admin/households/${householdId}`,
  );
  if (!householdId || !userId) return redirect(redirectTo);

  // No SELECT pre-checks — relies on FK constraints. Eliminates TOCTOU race
  // where a household or user is deleted between the check and the insert.
  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(householdMember)
        .values({
          householdId,
          userId,
          addedByUserId: session.user.id,
        })
        .onConflictDoNothing();
      await writeAudit(
        {
          actorUserId: session.user.id,
          actorEmail: session.user.email,
          action: "household.member.add",
          targetType: "household_member",
          targetId: `${householdId}:${userId}`,
        },
        tx,
      );
    });
  } catch (err) {
    if (isFkViolation(err)) {
      return redirect(
        `${redirectTo}?error=${encodeURIComponent(
          "Household or user no longer exists",
        )}`,
      );
    }
    throw err;
  }

  revalidatePath(`/admin/households/${householdId}`);
  revalidatePath(`/admin/users/${userId}`);
  return redirect(redirectTo);
}

export async function removeMember(formData: FormData): Promise<void> {
  const session = await verifyAdmin();
  const householdId = String(formData.get("householdId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const redirectTo = safePath(
    formData.get("redirectTo")?.toString(),
    `/admin/households/${householdId}`,
  );
  if (!householdId || !userId) return redirect(redirectTo);

  await db.transaction(async (tx) => {
    await tx
      .delete(householdMember)
      .where(
        and(
          eq(householdMember.householdId, householdId),
          eq(householdMember.userId, userId),
        ),
      );
    await writeAudit(
      {
        actorUserId: session.user.id,
        actorEmail: session.user.email,
        action: "household.member.remove",
        targetType: "household_member",
        targetId: `${householdId}:${userId}`,
      },
      tx,
    );
  });

  revalidatePath(`/admin/households/${householdId}`);
  revalidatePath(`/admin/users/${userId}`);
  return redirect(redirectTo);
}
