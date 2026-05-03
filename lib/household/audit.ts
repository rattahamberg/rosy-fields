import "server-only";

import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgDatabase, PgTransaction } from "drizzle-orm/pg-core";
import type { NeonQueryResultHKT } from "drizzle-orm/neon-serverless";
import { readNetworkContext, type NetworkContext } from "@/lib/admin/audit";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { householdAuditLog } from "@/lib/db/schema";

// Mirror of lib/admin/audit.ts but scoped to household-level events. Lives in
// its own table so admin-tier audit and household-tier audit don't pollute
// each other (admins shouldn't see household financials in admin_audit_log).

export type HouseholdAuditEntry = {
  householdId: string;
  actorUserId: string;
  actorEmail: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
};

type Schema = typeof schema;
type DrizzleClient =
  | PgDatabase<NeonQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>
  | PgTransaction<
      NeonQueryResultHKT,
      Schema,
      ExtractTablesWithRelations<Schema>
    >;

// Two-overload signature: net is REQUIRED when client (tx) is provided, so
// the lock-window invariant (no header reads inside an open txn) is enforced
// statically. See lib/admin/audit.ts for the longer rationale.
export function writeHouseholdAudit(
  entry: HouseholdAuditEntry,
  options: { client: DrizzleClient; net: NetworkContext },
): Promise<void>;
export function writeHouseholdAudit(
  entry: HouseholdAuditEntry,
  options?: { client?: never; net?: NetworkContext },
): Promise<void>;
// Implementation signature uses `client?: undefined` (not `never`) so the
// body's `options.client ?? db` fallback is typeable.
export async function writeHouseholdAudit(
  entry: HouseholdAuditEntry,
  options:
    | { client: DrizzleClient; net: NetworkContext }
    | { client?: undefined; net?: NetworkContext } = {},
): Promise<void> {
  const client = options.client ?? db;
  const net = options.net ?? (await readNetworkContext());
  await client.insert(householdAuditLog).values({
    id: crypto.randomUUID(),
    householdId: entry.householdId,
    actorUserId: entry.actorUserId,
    actorEmail: entry.actorEmail,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    metadata: entry.metadata ?? null,
    ipAddress: net.ipAddress,
    userAgent: net.userAgent,
  });
}
