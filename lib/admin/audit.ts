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
// `db.transaction(async (tx) => ...)`.
type Schema = typeof schema;
type DrizzleClient =
  | PgDatabase<NeonQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>
  | PgTransaction<
      NeonQueryResultHKT,
      Schema,
      ExtractTablesWithRelations<Schema>
    >;

// Two-overload signature enforces the lock-window rule at the type level:
//
// - Inside a transaction (client provided), `net` is REQUIRED — caller
//   must have pre-resolved it before opening the txn.
// - Outside a transaction (after()-style background audits), `net` is
//   optional and falls back to a header read.
//
// `client?: never` on Overload 2 is load-bearing: without it, calling
// `writeAudit(e, opts)` where `opts: { client: tx }` (a *variable*, not a
// literal) would resolve to Overload 2 and trigger a header read inside
// the open transaction — the very lock-window bug we want to prevent.
// `never` makes that variable case a hard type error.
//
// Examples:
//   writeAudit(e, { client: tx, net })  // OK   — Overload 1
//   writeAudit(e)                       // OK   — Overload 2 (after() use)
//   writeAudit(e, { client: tx })       // ERROR — both overloads reject
//   const opts = { client: tx };
//   writeAudit(e, opts);                // ERROR — `client?: never` blocks it
export function writeAudit(
  entry: AuditEntry,
  options: { client: DrizzleClient; net: NetworkContext },
): Promise<void>;
export function writeAudit(
  entry: AuditEntry,
  options?: { client?: never; net?: NetworkContext },
): Promise<void>;
// The implementation signature uses `client?: undefined` (not `never`)
// because the body needs `DrizzleClient | undefined` for the
// `options.client ?? db` fallback. The body would be untypeable with
// `client?: never`. The public overloads above carry the actual contract;
// the implementation signature is not callable directly.
export async function writeAudit(
  entry: AuditEntry,
  options:
    | { client: DrizzleClient; net: NetworkContext }
    | { client?: undefined; net?: NetworkContext } = {},
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
