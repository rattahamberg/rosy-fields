import "server-only";

import { headers } from "next/headers";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { NeonQueryResultHKT } from "drizzle-orm/neon-serverless";
import { db } from "@/lib/db";
import { adminAuditLog } from "@/lib/db/schema";

export type AuditEntry = {
  actorUserId: string;
  actorEmail: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
};

// Vercel injects `x-vercel-forwarded-for` containing the verified client IP
// — clients cannot spoof it because Vercel rewrites it at the edge. We
// prefer it over `x-real-ip` (which a client COULD set if no proxy strips
// it) and fall back to the leftmost `x-forwarded-for` value otherwise.
async function readNetworkContext(): Promise<{
  ipAddress: string | null;
  userAgent: string | null;
}> {
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
// `db.transaction(async (tx) => ...)`. Both extend PgDatabase, so widening to
// the base lets callers atomically commit a mutation and its audit row
// together.
type DrizzleClient = PgDatabase<
  NeonQueryResultHKT,
  Record<string, unknown>
>;

export async function writeAudit(
  entry: AuditEntry,
  client: DrizzleClient = db,
): Promise<void> {
  const { ipAddress, userAgent } = await readNetworkContext();
  await client.insert(adminAuditLog).values({
    id: crypto.randomUUID(),
    actorUserId: entry.actorUserId,
    actorEmail: entry.actorEmail,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    metadata: entry.metadata ?? null,
    ipAddress,
    userAgent,
  });
}
