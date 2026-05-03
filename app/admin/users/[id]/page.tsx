import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { verifyAdmin } from "@/lib/admin/dal";
import { writeAudit } from "@/lib/admin/audit";
import { resolveUserEmails } from "@/lib/admin/queries";
import { ADMIN_HOUSEHOLD_PICKER_LIMIT } from "@/lib/admin/config";
import {
  AdminTable,
  DataGrid,
  DetailHeader,
  Section,
} from "@/app/admin/_components";
import { PrimaryButton } from "@/app/_components/primary-button";
import { db } from "@/lib/db";
import {
  account,
  household,
  householdMember,
  session,
  user,
  verification,
} from "@/lib/db/schema";
import { addMember, removeMember } from "@/app/admin/households/actions";

export const metadata: Metadata = {
  title: "User detail",
};

type Params = Promise<{ id: string }>;

export default async function AdminUserDetailPage({
  params,
}: {
  params: Params;
}) {
  const adminSession = await verifyAdmin();
  const { id } = await params;

  const [target] = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      image: user.image,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .where(eq(user.id, id))
    .limit(1);

  if (!target) notFound();

  // Independent reads — fan out in parallel rather than waterfall. The
  // available-households query uses NOT EXISTS so it doesn't depend on the
  // memberships query result first (avoids a sequential round trip).
  const [accounts, sessions, pendingVerifications, memberships, availableHouseholds] =
    await Promise.all([
      // Whitelisted columns only — never select tokens, passwords, or
      // verification values. The Neon driver returns native JS booleans for
      // boolean SQL expressions, so no cast is needed.
      db
        .select({
          providerId: account.providerId,
          accountId: account.accountId,
          hasPassword: sql<boolean>`${account.password} IS NOT NULL`.as(
            "has_password",
          ),
          scope: account.scope,
          createdAt: account.createdAt,
        })
        .from(account)
        .where(eq(account.userId, id))
        .orderBy(desc(account.createdAt)),
      db
        .select({
          id: session.id,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
        })
        .from(session)
        .where(and(eq(session.userId, id), gt(session.expiresAt, sql`now()`)))
        .orderBy(desc(session.createdAt)),
      db
        .select({
          identifier: verification.identifier,
          expiresAt: verification.expiresAt,
          createdAt: verification.createdAt,
        })
        .from(verification)
        .where(
          and(
            eq(verification.identifier, target.email),
            gt(verification.expiresAt, sql`now()`),
          ),
        )
        .orderBy(desc(verification.createdAt)),
      db
        .select({
          householdId: household.id,
          name: household.name,
          addedAt: householdMember.addedAt,
          addedByUserId: householdMember.addedByUserId,
        })
        .from(householdMember)
        .innerJoin(household, eq(household.id, householdMember.householdId))
        .where(eq(householdMember.userId, id))
        .orderBy(asc(household.name)),
      db
        .select({ id: household.id, name: household.name })
        .from(household)
        .where(
          // NOT EXISTS anti-join — scales to large household counts where a
          // `NOT IN ($1, $2, ...)` would balloon the query text.
          sql`NOT EXISTS (SELECT 1 FROM ${householdMember} hm WHERE hm.household_id = ${household.id} AND hm.user_id = ${id})`,
        )
        .orderBy(asc(household.name))
        .limit(ADMIN_HOUSEHOLD_PICKER_LIMIT),
    ]);

  const addedByEmail = await resolveUserEmails(
    memberships
      .map((m) => m.addedByUserId)
      .filter((v): v is string => v !== null),
  );

  // `after()` runs post-response so view tracking doesn't add to TTFB.
  // Failures here just become server logs instead of 500ing the page.
  after(() => {
    writeAudit({
      actorUserId: adminSession.user.id,
      actorEmail: adminSession.user.email,
      action: "user.view",
      targetType: "user",
      targetId: id,
    }).catch((err) => {
      console.error("audit:user.view failed", err);
    });
  });

  return (
    <div className="space-y-8">
      <DetailHeader
        title={target.name}
        subtitle={target.email}
        backHref="/admin/users"
        backLabel="All users"
      />

      <Section title="Identity">
        <DataGrid
          rows={[
            { label: "ID", value: <code>{target.id}</code> },
            { label: "Email", value: target.email },
            {
              label: "Email verified",
              value: target.emailVerified ? "Yes" : "No",
            },
            { label: "Name", value: target.name },
            { label: "Role", value: target.role },
            { label: "Image URL", value: target.image ?? "—" },
            { label: "Created", value: target.createdAt.toISOString() },
            { label: "Updated", value: target.updatedAt.toISOString() },
          ]}
        />
      </Section>

      <Section title={`Households (${memberships.length})`}>
        {memberships.length === 0 ? (
          <p className="text-sm text-zinc-500">Not a member of any household.</p>
        ) : (
          <AdminTable headers={["Household", "Added", "Added by", null]}>
            {memberships.map((m) => (
              <tr key={m.householdId}>
                <td className="px-4 py-2">
                  <Link
                    href={`/admin/households/${m.householdId}`}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {m.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-xs text-zinc-500">
                  {m.addedAt.toISOString()}
                </td>
                <td className="px-4 py-2 text-xs text-zinc-500">
                  {m.addedByUserId
                    ? addedByEmail.get(m.addedByUserId) ?? m.addedByUserId
                    : "—"}
                </td>
                <td className="px-4 py-2 text-right">
                  <form action={removeMember}>
                    <input
                      type="hidden"
                      name="householdId"
                      value={m.householdId}
                    />
                    <input type="hidden" name="userId" value={target.id} />
                    <input
                      type="hidden"
                      name="redirectTo"
                      value={`/admin/users/${target.id}`}
                    />
                    <button
                      type="submit"
                      className="text-xs text-red-600 hover:underline dark:text-red-400"
                    >
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </AdminTable>
        )}

        {availableHouseholds.length > 0 ? (
          <form
            action={addMember}
            className="mt-4 flex flex-wrap items-end gap-2"
          >
            <input type="hidden" name="userId" value={target.id} />
            <input
              type="hidden"
              name="redirectTo"
              value={`/admin/users/${target.id}`}
            />
            <label className="flex flex-col gap-1 text-xs text-zinc-500">
              Add to household
              <select
                name="householdId"
                required
                className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {availableHouseholds.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </label>
            <PrimaryButton size="sm">Add</PrimaryButton>
          </form>
        ) : (
          <p className="mt-4 text-xs text-zinc-500">
            No more households available.{" "}
            <Link
              href="/admin/households/new"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Create one
            </Link>
            .
          </p>
        )}
      </Section>

      <Section title={`Auth methods (${accounts.length})`}>
        {accounts.length === 0 ? (
          <p className="text-sm text-zinc-500">None.</p>
        ) : (
          <AdminTable
            headers={["Provider", "Account ID", "Password", "Scope", "Created"]}
          >
            {accounts.map((a) => (
              <tr key={`${a.providerId}:${a.accountId}`}>
                <td className="px-4 py-2">{a.providerId}</td>
                <td className="px-4 py-2 text-xs">
                  <code>{a.accountId}</code>
                </td>
                <td className="px-4 py-2 text-xs">
                  {a.hasPassword ? "Set" : "—"}
                </td>
                <td className="px-4 py-2 text-xs">{a.scope ?? "—"}</td>
                <td className="px-4 py-2 text-xs text-zinc-500">
                  {a.createdAt.toISOString()}
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </Section>

      <Section title={`Active sessions (${sessions.length})`}>
        {sessions.length === 0 ? (
          <p className="text-sm text-zinc-500">No active sessions.</p>
        ) : (
          <AdminTable headers={["IP", "User agent", "Issued", "Expires"]}>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2 text-xs">{s.ipAddress ?? "—"}</td>
                <td className="px-4 py-2 text-xs">
                  <span className="line-clamp-1" title={s.userAgent ?? ""}>
                    {s.userAgent ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-2 text-xs text-zinc-500">
                  {s.createdAt.toISOString()}
                </td>
                <td className="px-4 py-2 text-xs text-zinc-500">
                  {s.expiresAt.toISOString()}
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </Section>

      <Section title={`Pending verifications (${pendingVerifications.length})`}>
        {pendingVerifications.length === 0 ? (
          <p className="text-sm text-zinc-500">None pending.</p>
        ) : (
          <AdminTable headers={["Identifier", "Issued", "Expires"]}>
            {pendingVerifications.map((v) => (
              <tr key={`${v.identifier}|${v.createdAt.toISOString()}`}>
                <td className="px-4 py-2 text-xs">{v.identifier}</td>
                <td className="px-4 py-2 text-xs text-zinc-500">
                  {v.createdAt.toISOString()}
                </td>
                <td className="px-4 py-2 text-xs text-zinc-500">
                  {v.expiresAt.toISOString()}
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </Section>
    </div>
  );
}
