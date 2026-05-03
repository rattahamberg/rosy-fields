import type { Metadata } from "next";
import { verifyAdmin } from "@/lib/admin/dal";
import { NewHouseholdForm } from "./new-household-form";

export const metadata: Metadata = {
  title: "New household",
};

export default async function NewHouseholdPage() {
  await verifyAdmin();

  return (
    <div className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-xl font-semibold">New household</h1>
        <p className="mt-1 text-sm text-zinc-500">
          You can add members after creation.
        </p>
      </div>
      <NewHouseholdForm />
    </div>
  );
}
