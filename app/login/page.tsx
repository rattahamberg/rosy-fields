import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  // Suspense boundary required because LoginForm calls useSearchParams()
  // (to honor the `?next=` redirect captured by the proxy).
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
