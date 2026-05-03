"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { loadHouseholdContext } from "@/lib/household/dal";
import {
  readNetworkContext,
  type NetworkContext,
} from "@/lib/admin/audit";
import { writeHouseholdAudit } from "@/lib/household/audit";
import { db } from "@/lib/db";
import { expense, expenseSplit } from "@/lib/db/schema";
import {
  distributeByShares,
  distributeEqual,
  fromStringToCents,
  serializeMoney,
  validateExact,
} from "@/lib/household/money";
import type { FormState } from "@/lib/forms";
export type { FormState } from "@/lib/forms";
import type { loadHouseholdContext as LoadCtx } from "@/lib/household/dal";

type Session = Awaited<ReturnType<typeof LoadCtx>>["session"];

const SPLIT_MODES = ["equal", "shares", "exact"] as const;
type SplitMode = (typeof SPLIT_MODES)[number];
const SPLIT_MODE_SET = new Set<string>(SPLIT_MODES);

const DESCRIPTION_MAX = 200;

function getStringList(formData: FormData, name: string): string[] {
  const raw = formData.getAll(name);
  return raw.filter((v): v is string => typeof v === "string");
}

type Participant = { userId: string; shareCents: bigint };

function buildSplits(opts: {
  amountCents: bigint;
  splitMode: SplitMode;
  participantIds: string[];
  shares: Map<string, number>;
  exactCents: Map<string, bigint>;
  members: Set<string>;
}): { ok: true; participants: Participant[] } | { ok: false; error: string } {
  const { amountCents, splitMode, participantIds, shares, exactCents, members } =
    opts;
  if (participantIds.length === 0) {
    return { ok: false, error: "Pick at least one participant" };
  }
  for (const id of participantIds) {
    if (!members.has(id)) {
      return { ok: false, error: "A selected participant isn't in this household" };
    }
  }

  if (splitMode === "equal") {
    const portions = distributeEqual(amountCents, participantIds.length);
    return {
      ok: true,
      participants: participantIds.map((userId, i) => ({
        userId,
        shareCents: portions[i] ?? 0n,
      })),
    };
  }

  if (splitMode === "shares") {
    const shareValues = participantIds.map((id) => shares.get(id) ?? 0);
    // Tightened: every selected participant must have a positive share.
    // If you want "include without owing", uncheck them instead.
    if (shareValues.some((v) => v <= 0)) {
      return {
        ok: false,
        error: "Each selected participant needs a positive share (or uncheck them)",
      };
    }
    const portions = distributeByShares(amountCents, shareValues);
    return {
      ok: true,
      participants: participantIds.map((userId, i) => ({
        userId,
        shareCents: portions[i] ?? 0n,
      })),
    };
  }

  const parts = participantIds.map((id) => exactCents.get(id) ?? 0n);
  if (parts.some((c) => c <= 0n)) {
    return {
      ok: false,
      error: "Each selected participant needs a positive exact amount (or uncheck them)",
    };
  }
  if (!validateExact(amountCents, parts)) {
    return { ok: false, error: "Exact splits must sum to the total amount" };
  }
  return {
    ok: true,
    participants: participantIds.map((userId, i) => ({
      userId,
      shareCents: parts[i] ?? 0n,
    })),
  };
}

type ParsedForm =
  | { ok: true; data: ParsedFormData }
  | { ok: false; error: string };

type ParsedFormData = {
  householdId: string;
  description: string;
  amountCents: bigint;
  paidBy: string;
  spentAt: string;
  splitMode: SplitMode;
  participantIds: string[];
  shares: Map<string, number>;
  exactCents: Map<string, bigint>;
  notes: string | null;
};

function parseExpenseForm(formData: FormData): ParsedForm {
  const householdId = String(formData.get("householdId") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const paidBy = String(formData.get("paidBy") ?? "");
  const spentAtRaw = String(formData.get("spentAt") ?? "");
  const splitModeRaw = String(formData.get("splitMode") ?? "");
  const notesRaw = String(formData.get("notes") ?? "").trim();

  if (!householdId) return { ok: false, error: "Missing household id" };
  if (!description || description.length > DESCRIPTION_MAX) {
    return {
      ok: false,
      error: `Description is required (max ${DESCRIPTION_MAX} chars)`,
    };
  }
  if (!paidBy) return { ok: false, error: "Pick who paid" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(spentAtRaw)) {
    return { ok: false, error: "Date must be YYYY-MM-DD" };
  }
  if (!SPLIT_MODE_SET.has(splitModeRaw)) {
    return { ok: false, error: "Invalid split mode" };
  }
  const splitMode = splitModeRaw as SplitMode;

  let amountCents: bigint;
  try {
    amountCents = fromStringToCents(String(formData.get("amount") ?? ""));
  } catch {
    return { ok: false, error: "Amount must be a positive number" };
  }

  const participantIds = getStringList(formData, "participantIds");
  const shares = new Map<string, number>();
  const exactCents = new Map<string, bigint>();

  if (splitMode === "shares") {
    for (const id of participantIds) {
      const raw = String(formData.get(`shares:${id}`) ?? "1");
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        return { ok: false, error: `Invalid share for participant` };
      }
      shares.set(id, n);
    }
  } else if (splitMode === "exact") {
    for (const id of participantIds) {
      const raw = String(formData.get(`exact:${id}`) ?? "0");
      try {
        exactCents.set(id, raw === "0" || raw === "" ? 0n : fromStringToCents(raw));
      } catch {
        return { ok: false, error: `Invalid exact amount for participant` };
      }
    }
  }

  return {
    ok: true,
    data: {
      householdId,
      description,
      amountCents,
      paidBy,
      spentAt: spentAtRaw,
      splitMode,
      participantIds,
      shares,
      exactCents,
      notes: notesRaw || null,
    },
  };
}

function makeAuditMeta(d: ParsedFormData): Record<string, unknown> {
  return {
    description: d.description,
    amountCents: serializeMoney(d.amountCents),
    splitMode: d.splitMode,
    participantCount: d.participantIds.length,
  };
}

async function insertExpenseWithSplits(opts: {
  session: Session;
  net: NetworkContext;
  data: ParsedFormData;
  participants: Participant[];
  audit: { action: string; metadata: Record<string, unknown> };
}): Promise<string> {
  const id = crypto.randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(expense).values({
      id,
      householdId: opts.data.householdId,
      paidBy: opts.data.paidBy,
      amountCents: opts.data.amountCents,
      description: opts.data.description,
      spentAt: opts.data.spentAt,
      splitMode: opts.data.splitMode,
      notes: opts.data.notes,
      createdByUserId: opts.session.user.id,
    });
    if (opts.participants.length > 0) {
      await tx.insert(expenseSplit).values(
        opts.participants.map((p) => ({
          expenseId: id,
          userId: p.userId,
          shareCents: p.shareCents,
        })),
      );
    }
    await writeHouseholdAudit(
      {
        householdId: opts.data.householdId,
        actorUserId: opts.session.user.id,
        actorEmail: opts.session.user.email,
        action: opts.audit.action,
        targetType: "expense",
        targetId: id,
        metadata: opts.audit.metadata,
      },
      { client: tx, net: opts.net },
    );
  });
  return id;
}

// ---------- createExpenseAction ----------

export async function createExpenseAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseExpenseForm(formData);
  if (!parsed.ok) return parsed;
  const { data } = parsed;

  const { session, memberIds } = await loadHouseholdContext(data.householdId);

  if (!memberIds.has(data.paidBy)) {
    return { ok: false, error: "Payer isn't in this household" };
  }

  const split = buildSplits({
    amountCents: data.amountCents,
    splitMode: data.splitMode,
    participantIds: data.participantIds,
    shares: data.shares,
    exactCents: data.exactCents,
    members: memberIds,
  });
  if (!split.ok) return split;

  const net = await readNetworkContext();
  const id = await insertExpenseWithSplits({
    session,
    net,
    data,
    participants: split.participants,
    audit: { action: "expense.create", metadata: makeAuditMeta(data) },
  });

  revalidatePath(`/dashboard/households/${data.householdId}`);
  revalidatePath(`/dashboard/households/${data.householdId}/expenses`);
  redirect(`/dashboard/households/${data.householdId}/expenses/${id}`);
}

// ---------- editExpenseAction ----------
//
// v1 edit pattern: soft-delete the old row and insert a new row. The audit
// trail preserves the chain via metadata.previousId. The detail page links
// to the latest row only (queries filter on deleted_at IS NULL).
//
// SELECT-FOR-UPDATE inside the txn (was outside in the prior version) so two
// concurrent edits can't both pass auth + both produce a "live" successor.
// The UPDATE WHERE includes isNull(deletedAt) and the row count is checked
// — if 0 rows updated, another writer raced us first.

export async function editExpenseAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseExpenseForm(formData);
  if (!parsed.ok) return parsed;
  const { data } = parsed;
  const previousId = String(formData.get("previousId") ?? "");
  if (!previousId) return { ok: false, error: "Missing previous expense id" };

  const { session, memberIds } = await loadHouseholdContext(data.householdId);

  if (!memberIds.has(data.paidBy)) {
    return { ok: false, error: "Payer isn't in this household" };
  }
  const split = buildSplits({
    amountCents: data.amountCents,
    splitMode: data.splitMode,
    participantIds: data.participantIds,
    shares: data.shares,
    exactCents: data.exactCents,
    members: memberIds,
  });
  if (!split.ok) return split;

  const net = await readNetworkContext();
  const newId = crypto.randomUUID();

  const outcome = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: expense.id,
        paidBy: expense.paidBy,
        createdByUserId: expense.createdByUserId,
        householdId: expense.householdId,
      })
      .from(expense)
      .where(and(eq(expense.id, previousId), isNull(expense.deletedAt)))
      .for("update")
      .limit(1);
    if (!existing) return { status: "notFound" as const };
    if (existing.householdId !== data.householdId) {
      return { status: "notFound" as const };
    }
    const allowedEditors = new Set([
      existing.paidBy,
      existing.createdByUserId ?? "",
    ]);
    if (!allowedEditors.has(session.user.id)) {
      return { status: "forbidden" as const };
    }

    // Soft-delete old row by id AND deletedAt-null filter — defends against
    // a concurrent writer that already replaced this row.
    const updated = await tx
      .update(expense)
      .set({ deletedAt: new Date() })
      .where(and(eq(expense.id, previousId), isNull(expense.deletedAt)))
      .returning({ id: expense.id });
    if (updated.length === 0) return { status: "raced" as const };

    await tx.insert(expense).values({
      id: newId,
      householdId: data.householdId,
      paidBy: data.paidBy,
      amountCents: data.amountCents,
      description: data.description,
      spentAt: data.spentAt,
      splitMode: data.splitMode,
      notes: data.notes,
      createdByUserId: session.user.id,
    });
    if (split.participants.length > 0) {
      await tx.insert(expenseSplit).values(
        split.participants.map((p) => ({
          expenseId: newId,
          userId: p.userId,
          shareCents: p.shareCents,
        })),
      );
    }
    await writeHouseholdAudit(
      {
        householdId: data.householdId,
        actorUserId: session.user.id,
        actorEmail: session.user.email,
        action: "expense.edit",
        targetType: "expense",
        targetId: newId,
        metadata: { ...makeAuditMeta(data), previousId },
      },
      { client: tx, net },
    );
    return { status: "ok" as const };
  });

  if (outcome.status === "notFound") {
    return { ok: false, error: "Expense not found" };
  }
  if (outcome.status === "forbidden") {
    return { ok: false, error: "Only the payer or creator can edit" };
  }
  if (outcome.status === "raced") {
    return { ok: false, error: "Someone else just edited this expense — refresh and try again" };
  }

  revalidatePath(`/dashboard/households/${data.householdId}`);
  revalidatePath(`/dashboard/households/${data.householdId}/expenses`);
  redirect(`/dashboard/households/${data.householdId}/expenses/${newId}`);
}

// ---------- deleteExpense ----------

export async function deleteExpense(formData: FormData): Promise<void> {
  const householdId = String(formData.get("householdId") ?? "");
  const expenseId = String(formData.get("expenseId") ?? "");
  if (!householdId || !expenseId) {
    return redirect(`/dashboard/households/${householdId}`);
  }

  const { session } = await loadHouseholdContext(householdId);

  const net = await readNetworkContext();
  const outcome = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: expense.id,
        paidBy: expense.paidBy,
        createdByUserId: expense.createdByUserId,
        householdId: expense.householdId,
        description: expense.description,
        amountCents: expense.amountCents,
      })
      .from(expense)
      .where(and(eq(expense.id, expenseId), isNull(expense.deletedAt)))
      .for("update")
      .limit(1);
    if (!existing) return { status: "notFound" as const };
    if (existing.householdId !== householdId) {
      return { status: "notFound" as const };
    }
    const allowed = new Set([
      existing.paidBy,
      existing.createdByUserId ?? "",
    ]);
    if (!allowed.has(session.user.id)) {
      return { status: "forbidden" as const };
    }
    await tx
      .update(expense)
      .set({ deletedAt: new Date() })
      .where(eq(expense.id, expenseId));
    await writeHouseholdAudit(
      {
        householdId,
        actorUserId: session.user.id,
        actorEmail: session.user.email,
        action: "expense.delete",
        targetType: "expense",
        targetId: expenseId,
        metadata: {
          description: existing.description,
          amountCents: serializeMoney(existing.amountCents),
        },
      },
      { client: tx, net },
    );
    return { status: "ok" as const };
  });

  if (outcome.status === "notFound") {
    return redirect(
      `/dashboard/households/${householdId}/expenses?error=notFound`,
    );
  }
  if (outcome.status === "forbidden") {
    return redirect(
      `/dashboard/households/${householdId}/expenses/${expenseId}?error=forbidden`,
    );
  }

  revalidatePath(`/dashboard/households/${householdId}`);
  revalidatePath(`/dashboard/households/${householdId}/expenses`);
  redirect(`/dashboard/households/${householdId}/expenses`);
}
