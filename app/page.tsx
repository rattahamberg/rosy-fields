import { redirect } from "next/navigation";

// Fallback only — `proxy.ts` matches `/` and routes based on session cookie
// before this page renders. Kept as a safety net.
export default function Home() {
  redirect("/dashboard");
}
