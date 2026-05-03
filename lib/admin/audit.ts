import "server-only";

import { headers } from "next/headers";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgDatabase, PgTransaction } from "drizzle-orm/pg-core";
import type { NeonQueryResultHKT } from "drizzle-orm/neon-serverless";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { adminAuditLog } from "@/lib/db/schema";

export type AuditEntry = {
  actorUserId: string;
  actorEmail: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
};

export type NetworkContext = {
  ipAddress: string | null;
  userAgent: string | null;
};

// Vercel injects `x-vercel-forwarded-for` containing the verified client IP
// — clients cannot spoof it because Vercel rewrites it at the edge. We
// prefer it over `x-real-ip` (which a client COULD set if no proxy strips
// it) and fall back to the leftmost `x-forwarded-for` value otherwise.
//
// Callers should resolve this BEFORE opening a transaction so the lock
// window doesn't include the (cheap but yieldy) header read.
export async function readNetworkContext(): Promise<NetworkContext> {
  const h = await headers();
  const ipAddress =
    h.get("x-vercel-forwarded-for") ??
    h.get("cf-connecting-ip") ??
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  return { ipAddress, userAgent: h.get("user-agent") ?? null };
}

// Common base type for both the global `db` and a transaction handle from
// `db.transaction(async (tx) => ...)`. The schema generic is the actual
// project schema so callers can pass `tx` from inside a transaction without
// fighting the type checker.
type Schema = typeof schema;
type DrizzleClient =
  | PgDatabase<NeonQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>
  | PgTransaction<
      NeonQueryResultHKT,
      Schema,
      ExtractTablesWithRelations<Schema>
    >;

export type WriteAuditOptions = {
  client?: DrizzleClient;
  net?: NetworkContext;
};

export async function writeAudit(
  entry: AuditEntry,
  options: WriteAuditOptions = {},
): Promise<void> {
  const client = options.client ?? db;
  const net = options.net ?? (await readNetworkContext());
  await client.insert(adminAuditLog).values({
    id: crypto.randomUUID(),
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
