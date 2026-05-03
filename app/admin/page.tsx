import { redirect } from "next/navigation";
import { verifyAdmin } from "@/lib/admin/dal";

export default async function AdminIndexPage() {
  // Defensive: pages must independently verify under partial rendering. A
  // redirect-only segment costs one extra role lookup per request — cheap
  // and worth it to keep the convention "every admin page calls verifyAdmin".
  await verifyAdmin();
  redirect("/admin/users");
}
