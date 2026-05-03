// The "primary action" button is repeated across admin forms and the login
// path. Extracted so the visual style stays in one place.

type Size = "sm" | "md";

const SIZE_CLASS: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-sm",
  md: "px-3 py-2 text-sm",
};

type ButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "className"
>;

export function PrimaryButton({
  type = "submit",
  size = "md",
  className,
  children,
  ...rest
}: ButtonProps & {
  size?: Size;
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
