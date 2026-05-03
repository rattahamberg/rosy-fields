"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { verifyHouseholdMember } from "@/lib/household/dal";
import {
  readNetworkContext,
  type NetworkContext,
} from "@/lib/admin/audit";
import { writeHouseholdAudit } from "@/lib/household/audit";
import { db } from "@/lib/db";
import {
  expense,
  expenseSplit,
  household,
  householdMember,
} from "@/lib/db/schema";
import {
  distributeByShares,
  distributeEqual,
  fromStringToCents,
  validateExact,
} from "@/lib/household/money";
import type { verifyHouseholdMember as VerifyHM } from "@/lib/household/dal";

type Session = Awaited<ReturnType<typeof VerifyHM>>;

export type FormState = { ok: true } | { ok: false; error: string };

const SPLIT_MODES = ["equal", "shares", "exact"] as const;
type SplitMode = (typeof SPLIT_MODES)[number];

const DESCRIPTION_MAX = 200;

// Form payload shape (FormData has multiple values per name for checkboxes
// and per-participant numeric fields). Helper extractors below normalize.

function getStringList(formData: FormData, name: string): string[] {
  const raw = formData.getAll(name);
  return raw.filter((v): v is string => typeof v === "string");
}

async function loadHouseholdMembers(householdId: string): Promise<Set<string>> {
  const rows = await db
    .select({ userId: householdMember.userId })
    .from(householdMember)
    .where(eq(householdMember.householdId, householdId));
  return new Set(rows.map((r) => r.userId));
}

type Participant = { userId: string; shareCents: bigint };

function buildSplits(opts: {
  amountCents: bigint;
  splitMode: SplitMode;
  participantIds: string[];
  shares: Map<string, number>; // for shares mode
  exactCents: Map<string, bigint>; // for exact mode
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
    if (shareValues.every((v) => v <= 0)) {
      return { ok: false, error: "Each participant needs a positive share" };
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

  // exact
  const parts = participantIds.map((id) => exactCents.get(id) ?? 0n);
  if (!validateExact(amountCents, parts)) {
    return {
      ok: false,
      error: "Exact splits must sum to the total amount",
    };
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
  spentAt: string; // YYYY-MM-DD
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
  if (!SPLIT_MODES.includes(splitModeRaw as SplitMode)) {
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

type AuditMeta = {
  description: string;
  amountCents: string; // bigint serialized as string for JSONB
  splitMode: SplitMode;
  participantCount: number;
};

function makeAuditMeta(d: ParsedFormData): AuditMeta {
  return {
    description: d.description,
    amountCents: d.amountCents.toString(),
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

  const session = await verifyHouseholdMember(data.householdId);
  const members = await loadHouseholdMembers(data.householdId);

  if (!members.has(data.paidBy)) {
    return { ok: false, error: "Payer isn't in this household" };
  }

  const split = buildSplits({
    amountCents: data.amountCents,
    splitMode: data.splitMode,
    participantIds: data.participantIds,
    shares: data.shares,
    exactCents: data.exactCents,
    members,
  });
  if (!split.ok) return split;

  const net = await readNetworkContext();
  const id = await insertExpenseWithSplits({
    session,
    net,
    data,
    participants: split.participants,
    audit: {
      action: "expense.create",
      metadata: makeAuditMeta(data),
    },
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

export async function editExpenseAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseExpenseForm(formData);
  if (!parsed.ok) return parsed;
  const { data } = parsed;
  const previousId = String(formData.get("previousId") ?? "");
  if (!previousId) return { ok: false, error: "Missing previous expense id" };

  const session = await verifyHouseholdMember(data.householdId);
  const members = await loadHouseholdMembers(data.householdId);

  // Authorization: only creator or payer of the previous row may edit.
  const [existing] = await db
    .select({
      id: expense.id,
      paidBy: expense.paidBy,
      createdByUserId: expense.createdByUserId,
      householdId: expense.householdId,
    })
    .from(expense)
    .where(and(eq(expense.id, previousId), isNull(expense.deletedAt)))
    .limit(1);
  if (!existing) return { ok: false, error: "Expense not found" };
  if (existing.householdId !== data.householdId) {
    return { ok: false, error: "Household mismatch" };
  }
  const allowedEditors = new Set([
    existing.paidBy,
    existing.createdByUserId ?? "",
  ]);
  if (!allowedEditors.has(session.user.id)) {
    return { ok: false, error: "Only the payer or creator can edit" };
  }

  if (!members.has(data.paidBy)) {
    return { ok: false, error: "Payer isn't in this household" };
  }
  const split = buildSplits({
    amountCents: data.amountCents,
    splitMode: data.splitMode,
    participantIds: data.participantIds,
    shares: data.shares,
    exactCents: data.exactCents,
    members,
  });
  if (!split.ok) return split;

  const net = await readNetworkContext();
  const newId = crypto.randomUUID();

  await db.transaction(async (tx) => {
    // Soft-delete the old row first so a concurrent reader sees either old
    // or new, never both.
    await tx
      .update(expense)
      .set({ deletedAt: new Date() })
      .where(eq(expense.id, previousId));
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
  });

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

  const session = await verifyHouseholdMember(householdId);

  // Lock the row, verify household + permission, soft-delete in one txn.
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
          amountCents: existing.amountCents.toString(),
        },
      },
      { client: tx, net },
    );
    return { status: "ok" as const };
  });

  if (outcome.status === "notFound") {
    return redirect(
      `/dashboard/households/${householdId}/expenses?error=${encodeURIComponent("Expense not found")}`,
    );
  }
  if (outcome.status === "forbidden") {
    return redirect(
      `/dashboard/households/${householdId}/expenses/${expenseId}?error=${encodeURIComponent("Only the payer or creator can delete")}`,
    );
  }

  // Reference unused import to satisfy lint when no other code path uses it.
  void household;

  revalidatePath(`/dashboard/households/${householdId}`);
  revalidatePath(`/dashboard/households/${householdId}/expenses`);
  redirect(`/dashboard/households/${householdId}/expenses`);
}
