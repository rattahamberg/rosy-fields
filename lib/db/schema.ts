import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  index,
  uniqueIndex,
  primaryKey,
  jsonb,
  bigint,
  date,
  check,
} from "drizzle-orm/pg-core";

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    role: text("role").notNull().default("user"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // Composite supports the admin user-list keyset pagination
    // (ORDER BY created_at DESC, id DESC).
    index("user_created_at_id_idx").on(t.createdAt.desc(), t.id.desc()),
    // Trigram GIN indexes power the substring search on the admin users page.
    // Requires the pg_trgm extension (see drizzle/0002_user_search_trgm.sql).
    index("user_email_trgm_idx")
      .using("gin", sql`email gin_trgm_ops`),
    index("user_name_trgm_idx")
      .using("gin", sql`name gin_trgm_ops`),
  ],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("session_user_id_idx").on(t.userId),
    // Speeds up both the admin user-list LEFT JOIN (active sessions filter)
    // and the cron purge in setup-cron.sql.
    index("session_expires_at_idx").on(t.expiresAt),
  ],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("account_user_id_idx").on(t.userId),
    uniqueIndex("account_provider_account_idx").on(t.providerId, t.accountId),
  ],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

export const household = pgTable(
  "household",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    // FK index — household-list LEFT JOINs user via this column.
    index("household_created_by_user_id_idx").on(t.createdByUserId),
    // Trigram search on household name (mirrors user search).
    index("household_name_trgm_idx")
      .using("gin", sql`name gin_trgm_ops`),
  ],
);

export const householdMember = pgTable(
  "household_member",
  {
    householdId: text("household_id")
      .notNull()
      .references(() => household.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    addedByUserId: text("added_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    primaryKey({ columns: [t.householdId, t.userId] }),
    index("household_member_user_id_idx").on(t.userId),
    // FK index — added_by_user_id is set null on user deletion, which
    // requires a scan otherwise.
    index("household_member_added_by_user_id_idx").on(t.addedByUserId),
  ],
);

export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    // Denormalized so the audit trail survives admin-user deletion.
    actorEmail: text("actor_email"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("admin_audit_log_actor_idx").on(t.actorUserId),
    index("admin_audit_log_created_at_idx").on(t.createdAt),
  ],
);

// ---------- Household expense ledger (v1) ----------

export const expense = pgTable(
  "expense",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => household.id, { onDelete: "cascade" }),
    paidBy: text("paid_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    amountCents: bigint("amount_cents", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull().default("USD"),
    description: text("description").notNull(),
    spentAt: date("spent_at").notNull(),
    splitMode: text("split_mode").notNull(),
    notes: text("notes"),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    // Soft-delete: edits create a new row and flip the old row's deleted_at.
    // All read paths filter on deleted_at IS NULL.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    // Composite partial covers active-list reads (filter + sort) in one
    // index — replaces the two prior indexes (`spent_at_idx` and the
    // partial `active_idx`).
    index("expense_household_active_sorted_idx")
      .on(t.householdId, t.spentAt.desc(), t.createdAt.desc())
      .where(sql`${t.deletedAt} IS NULL`),
    index("expense_paid_by_idx").on(t.paidBy),
    index("expense_created_by_idx").on(t.createdByUserId),
    check("expense_amount_positive", sql`${t.amountCents} > 0`),
    check(
      "expense_split_mode_valid",
      sql`${t.splitMode} IN ('equal', 'shares', 'exact')`,
    ),
  ],
);

export const expenseSplit = pgTable(
  "expense_split",
  {
    expenseId: text("expense_id")
      .notNull()
      .references(() => expense.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    shareCents: bigint("share_cents", { mode: "bigint" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.expenseId, t.userId] }),
    index("expense_split_user_id_idx").on(t.userId),
    // Defense-in-depth: app code already rejects 0-share participants
    // (uncheck them instead). Keeping the DB constraint > 0 means a direct
    // INSERT can't corrupt balances by inserting a free-rider split.
    check("expense_split_share_positive", sql`${t.shareCents} > 0`),
  ],
);

export const settlement = pgTable(
  "settlement",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => household.id, { onDelete: "cascade" }),
    fromUserId: text("from_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    toUserId: text("to_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    amountCents: bigint("amount_cents", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull().default("USD"),
    note: text("note"),
    settledAt: date("settled_at").notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    // Composite partial — same rationale as the expense version above.
    index("settlement_household_active_sorted_idx")
      .on(t.householdId, t.settledAt.desc(), t.createdAt.desc())
      .where(sql`${t.deletedAt} IS NULL`),
    index("settlement_from_user_idx").on(t.fromUserId),
    index("settlement_to_user_idx").on(t.toUserId),
    // FK index — created_by_user_id is SET NULL on user delete; without
    // an index Postgres scans on every user removal.
    index("settlement_created_by_idx").on(t.createdByUserId),
    check("settlement_amount_positive", sql`${t.amountCents} > 0`),
    check(
      "settlement_distinct_parties",
      sql`${t.fromUserId} <> ${t.toUserId}`,
    ),
  ],
);

export const householdAuditLog = pgTable(
  "household_audit_log",
  {
    id: text("id").primaryKey(),
    householdId: text("household_id")
      .notNull()
      .references(() => household.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    actorEmail: text("actor_email"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("household_audit_log_household_idx").on(
      t.householdId,
      t.createdAt.desc(),
    ),
    index("household_audit_log_actor_idx").on(t.actorUserId),
    // Standalone created_at index for the cron purge — the composite above
    // can't serve a `WHERE created_at < ?` query without a household filter.
    index("household_audit_log_created_at_idx").on(t.createdAt),
  ],
);
