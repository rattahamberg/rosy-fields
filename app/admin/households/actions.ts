"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { verifyAdmin } from "@/lib/admin/dal";
import { readNetworkContext, writeAudit } from "@/lib/admin/audit";
import { db } from "@/lib/db";
import { household, householdMember } from "@/lib/db/schema";
import { safePath } from "@/lib/safe-redirect";
import {
  ADMIN_HOUSEHOLD_NAME_MAX,
  ADMIN_HOUSEHOLD_NAME_MIN,
} from "@/lib/admin/config";

// ---------- shared helpers ----------

export type FormState = { ok: true } | { ok: false; error: string };

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
    err.code === PG_FK_VIOLATION
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

  // Resolve network context before opening the transaction so headers()
  // doesn't yield mid-lock-window.
  const net = await readNetworkContext();
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
      { client: tx, net },
    );
  });

  revalidatePath("/admin/households");
  // Server-side redirect keeps the action atomic — no client-side latch
  // needed in NewHouseholdForm. `redirect` throws a NEXT_REDIRECT signal.
  redirect(`/admin/households/${id}`);
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

  const net = await readNetworkContext();
  const result = await db.transaction(async (tx) => {
    // Lock the row and capture the old name before mutating, so the audit
    // row contains both old and new values.
    const [existing] = await tx
      .select({ id: household.id, name: household.name })
      .from(household)
      .where(eq(household.id, householdId))
      .for("update")
      .limit(1);
    if (!existing) return { found: false as const };
    if (existing.name === name) {
      // No change — skip the UPDATE and the audit row.
      return { found: true as const, changed: false as const };
    }
    await tx
      .update(household)
      .set({ name })
      .where(eq(household.id, householdId));
    await writeAudit(
      {
        actorUserId: session.user.id,
        actorEmail: session.user.email,
        action: "household.rename",
        targetType: "household",
        targetId: householdId,
        metadata: { oldName: existing.name, newName: name },
      },
      { client: tx, net },
    );
    return { found: true as const, changed: true as const };
  });

  if (!result.found) return { ok: false, error: "Household not found" };

  revalidatePath(`/admin/households/${householdId}`);
  revalidatePath("/admin/households");
  return { ok: true };
}

// ---------- redirect-style mutations ----------

type DeleteOutcome =
  | { status: "ok" }
  | { status: "notFound" }
  | { status: "confirmFailed" };

export async function deleteHousehold(formData: FormData): Promise<void> {
  const session = await verifyAdmin();
  const householdId = String(formData.get("householdId") ?? "");
  const confirmName = String(formData.get("confirmName") ?? "").trim();
  if (!householdId) return redirect("/admin/households");

  const net = await readNetworkContext();

  // SELECT-FOR-UPDATE, name-check, and DELETE in one transaction — closes
  // the TOCTOU window where a concurrent rename could let an admin delete
  // the wrong household. The transaction returns a discriminated union; the
  // caller dispatches on it after the txn closes.
  const outcome: DeleteOutcome = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: household.id, name: household.name })
      .from(household)
      .where(eq(household.id, householdId))
      .for("update")
      .limit(1);
    if (!existing) return { status: "notFound" };
    if (confirmName !== existing.name) return { status: "confirmFailed" };
    await tx.delete(household).where(eq(household.id, householdId));
    await writeAudit(
      {
        actorUserId: session.user.id,
        actorEmail: session.user.email,
        action: "household.delete",
        targetType: "household",
        targetId: householdId,
        metadata: { name: existing.name },
      },
      { client: tx, net },
    );
    return { status: "ok" };
  });

  if (outcome.status === "notFound") {
    return redirect(
      `/admin/households?error=${encodeURIComponent("Household not found")}`,
    );
  }
  if (outcome.status === "confirmFailed") {
    return redirect(
      `/admin/households/${householdId}?error=${encodeURIComponent(
        "Confirmation name did not match",
      )}`,
    );
  }

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

  const net = await readNetworkContext();

  // No SELECT pre-checks — relies on FK constraints. Eliminates TOCTOU race
  // where a household or user is deleted between the check and the insert.
  let mutated = false;
  try {
    await db.transaction(async (tx) => {
      // RETURNING tells us whether a row actually got inserted (vs the
      // conflict-do-nothing no-op case). Skip the audit row when no insert
      // happened — otherwise we'd write a phantom "member added" entry for
      // an already-member case.
      const inserted = await tx
        .insert(householdMember)
        .values({
          householdId,
          userId,
          addedByUserId: session.user.id,
        })
        .onConflictDoNothing()
        .returning({ userId: householdMember.userId });
      if (inserted.length === 0) return;
      mutated = true;
      await writeAudit(
        {
          actorUserId: session.user.id,
          actorEmail: session.user.email,
          action: "household.member.add",
          targetType: "household_member",
          targetId: `${householdId}:${userId}`,
        },
        { client: tx, net },
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

  // Only revalidate when something actually changed — saves a wasted RSC
  // cache invalidation on the already-member case.
  if (mutated) {
    revalidatePath(`/admin/households/${householdId}`);
    revalidatePath(`/admin/users/${userId}`);
  }
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

  const net = await readNetworkContext();

  let mutated = false;
  await db.transaction(async (tx) => {
    // RETURNING tells us whether a row actually got deleted. Skip the audit
    // row when nothing matched (already removed via race / double-submit).
    const deleted = await tx
      .delete(householdMember)
      .where(
        and(
          eq(householdMember.householdId, householdId),
          eq(householdMember.userId, userId),
        ),
      )
      .returning({ userId: householdMember.userId });
    if (deleted.length === 0) return;
    mutated = true;
    await writeAudit(
      {
        actorUserId: session.user.id,
        actorEmail: session.user.email,
        action: "household.member.remove",
        targetType: "household_member",
        targetId: `${householdId}:${userId}`,
      },
      { client: tx, net },
    );
  });

  if (mutated) {
    revalidatePath(`/admin/households/${householdId}`);
    revalidatePath(`/admin/users/${userId}`);
  }
  return redirect(redirectTo);
}
