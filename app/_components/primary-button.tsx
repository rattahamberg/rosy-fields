// The "primary action" button is shared across login, signup, and admin
// surfaces. Lives at `app/_components/` (not `app/admin/_components/`) since
// non-admin routes consume it too.

type Size = "sm" | "md";

const SIZE_CLASS: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-sm",
  md: "px-3 py-2 text-sm",
};

// `formAction` / `formMethod` / `formEncType` / `formTarget` are legitimate
// HTML attributes on a submit button — but they let a caller redirect a
// form submission to an arbitrary endpoint, bypassing the bound Server
// Action. Keep them out of the public surface so the primitive is safe to
// share across the codebase.
type ButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  | "className"
  | "formAction"
  | "formMethod"
  | "formEncType"
  | "formTarget"
>;

export function PrimaryButton({
  type = "submit",
  size = "md",
  className,
  children,
  ...rest
}: ButtonProps & {
  size?: Size;
  // Allowed: callers can append spacing / width utilities (`w-full`,
  // `font-medium`). The base Tailwind classes always apply.
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type={type}
      className={`rounded-md bg-zinc-900 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 ${SIZE_CLASS[size]}${
        className ? ` ${className}` : ""
      }`}
      {...rest}
    >
      {children}
    </button>
  );
}
