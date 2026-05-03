import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq, notInArray } from "drizzle-orm";
import { verifyAdmin } from "@/lib/admin/dal";
import { resolveUserEmails } from "@/lib/admin/queries";
import {
  ADMIN_ERROR_DISPLAY_MAX,
  ADMIN_USER_PICKER_LIMIT,
} from "@/lib/admin/config";
import { DetailHeader } from "@/app/admin/_components/detail-header";
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

  const [target] = await db
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
    .limit(1);

  if (!target) notFound();

  const members = await db
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
    .orderBy(asc(user.email));

  const memberIds = members.map((m) => m.userId);

  const [candidates, addedByEmail] = await Promise.all([
    db
      .select({ id: user.id, email: user.email, name: user.name })
      .from(user)
      .where(
        memberIds.length > 0 ? notInArray(user.id, memberIds) : undefined,
      )
      .orderBy(desc(user.createdAt))
      .limit(ADMIN_USER_PICKER_LIMIT),
    resolveUserEmails(
      members
        .map((m) => m.addedByUserId)
        .filter((v): v is string => v !== null),
    ),
  ]);

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

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Rename
        </h2>
        <RenameHouseholdForm
          householdId={target.id}
          currentName={target.name}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Members ({members.length})
        </h2>
        <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Added</th>
                <th className="px-4 py-2 font-medium">Added by</th>
                <th className="px-4 py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {members.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-zinc-500"
                  >
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
            </tbody>
          </table>
        </div>

        {candidates.length > 0 ? (
          <form
            action={addMember}
            className="flex flex-wrap items-end gap-2 rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
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
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Add
            </button>
            {candidates.length === ADMIN_USER_PICKER_LIMIT && (
              <p className="basis-full text-xs text-zinc-500">
                Showing the {ADMIN_USER_PICKER_LIMIT} most-recent users not
                already in this household.
              </p>
            )}
          </form>
        ) : (
          <p className="text-xs text-zinc-500">
            All users are already in this household.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Danger zone
        </h2>
        <DeleteHouseholdForm
          householdId={target.id}
          householdName={target.name}
          memberCount={members.length}
        />
      </section>
    </div>
  );
}
