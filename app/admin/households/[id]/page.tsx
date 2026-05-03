import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq, sql } from "drizzle-orm";
import { verifyAdmin } from "@/lib/admin/dal";
import { resolveUserEmails } from "@/lib/admin/queries";
import {
  ADMIN_ERROR_DISPLAY_MAX,
  ADMIN_USER_PICKER_LIMIT,
} from "@/lib/admin/config";
import {
  AdminTable,
  DetailHeader,
  PrimaryButton,
  Section,
} from "@/app/admin/_components";
import { db } from "@/lib/db";
import { household, householdMember, user } from "@/lib/db/schema";
import { addMember, removeMember } from "@/app/admin/households/actions";
import { RenameHouseholdForm } from "./rename-household-form";
import { DeleteHouseholdForm } from "./delete-household-form";

export const metadata: Metadata = {
  title: "Household",
};

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string }>;

export default async function HouseholdDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  await verifyAdmin();
  const { id } = await params;
  const { error } = await searchParams;

  // Three independent reads — fan out in parallel. The candidates query uses
  // NOT EXISTS so it doesn't need the members list to compute exclusions first.
  const [[target], members, candidates] = await Promise.all([
    db
      .select({
        id: household.id,
        name: household.name,
        createdAt: household.createdAt,
        createdByUserId: household.createdByUserId,
        createdByEmail: user.email,
      })
      .from(household)
      .leftJoin(user, eq(user.id, household.createdByUserId))
      .where(eq(household.id, id))
      .limit(1),
    db
      .select({
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        addedAt: householdMember.addedAt,
        addedByUserId: householdMember.addedByUserId,
      })
      .from(householdMember)
      .innerJoin(user, eq(user.id, householdMember.userId))
      .where(eq(householdMember.householdId, id))
      .orderBy(asc(user.email)),
    db
      .select({ id: user.id, email: user.email, name: user.name })
      .from(user)
      .where(
        sql`NOT EXISTS (SELECT 1 FROM ${householdMember} hm WHERE hm.user_id = ${user.id} AND hm.household_id = ${id})`,
      )
      .orderBy(desc(user.createdAt))
      .limit(ADMIN_USER_PICKER_LIMIT),
  ]);

  if (!target) notFound();

  const addedByEmail = await resolveUserEmails(
    members
      .map((m) => m.addedByUserId)
      .filter((v): v is string => v !== null),
  );

  const trimmedError = error?.slice(0, ADMIN_ERROR_DISPLAY_MAX);

  return (
    <div className="space-y-8">
      <DetailHeader
        title={target.name}
        subtitle={
          <>
            Created {target.createdAt.toISOString()} by{" "}
            {target.createdByEmail ?? "—"}
          </>
        }
        backHref="/admin/households"
        backLabel="All households"
      />

      {trimmedError && (
        <p
          role="alert"
          className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
        >
          {trimmedError}
        </p>
      )}

      <Section title="Rename">
        <RenameHouseholdForm
          householdId={target.id}
          currentName={target.name}
        />
      </Section>

      <Section title={`Members (${members.length})`}>
        <AdminTable
          headers={["Email", "Name", "Role", "Added", "Added by", null]}
        >
          {members.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                No members yet.
              </td>
            </tr>
          )}
          {members.map((m) => (
            <tr key={m.userId}>
              <td className="px-4 py-2">
                <Link
                  href={`/admin/users/${m.userId}`}
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {m.email}
                </Link>
              </td>
              <td className="px-4 py-2">{m.name}</td>
              <td className="px-4 py-2 text-xs text-zinc-500">{m.role}</td>
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
                  <input type="hidden" name="householdId" value={target.id} />
                  <input type="hidden" name="userId" value={m.userId} />
                  <input
                    type="hidden"
                    name="redirectTo"
                    value={`/admin/households/${target.id}`}
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

        {candidates.length > 0 ? (
          <form
            action={addMember}
            className="mt-4 flex flex-wrap items-end gap-2"
          >
            <input type="hidden" name="householdId" value={target.id} />
            <input
              type="hidden"
              name="redirectTo"
              value={`/admin/households/${target.id}`}
            />
            <label className="flex flex-1 flex-col gap-1 text-xs text-zinc-500">
              Add member
              <select
                name="userId"
                required
                className="rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.email} ({c.name})
                  </option>
                ))}
              </select>
            </label>
            <PrimaryButton size="sm">Add</PrimaryButton>
            {candidates.length === ADMIN_USER_PICKER_LIMIT && (
              <p className="basis-full text-xs text-zinc-500">
                Showing the {ADMIN_USER_PICKER_LIMIT} most-recent users not
                already in this household.
              </p>
            )}
          </form>
        ) : (
          <p className="mt-4 text-xs text-zinc-500">
            All users are already in this household.
          </p>
        )}
      </Section>

      <Section title="Danger zone">
        <DeleteHouseholdForm
          householdId={target.id}
          householdName={target.name}
          memberCount={members.length}
        />
      </Section>
    </div>
  );
}
