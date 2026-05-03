import { redirect } from "next/navigation";
import { verifyAdmin } from "@/lib/admin/dal";

export default async function AdminIndexPage() {
  // Defensive: layout verifies too, but this page being a redirect-only
  // segment means belt-and-suspenders is free under react.cache.
  await verifyAdmin();
  redirect("/admin/users");
}
