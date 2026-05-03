import "server-only";

import { headers } from "next/headers";
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

// Trust order: x-real-ip (set by Vercel/Cloudflare) > first hop in
// x-forwarded-for. Both are spoofable until the deployment is fronted by a
// proxy that overwrites them — note this in your deploy config.
async function readNetworkContext(): Promise<{
  ipAddress: string | null;
  userAgent: string | null;
}> {
  const h = await headers();
  const ipAddress =
    h.get("x-real-ip") ??
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  return { ipAddress, userAgent: h.get("user-agent") ?? null };
}

// Drizzle transaction handle — accepts the global `db` or a tx scope so
// callers can atomically commit a mutation and its audit row together.
type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function writeAudit(
  entry: AuditEntry,
  client: DbOrTx = db,
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
