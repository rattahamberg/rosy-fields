"use client";

import { useState } from "react";

// Money input. Stores a string locally so the user can type "12.5" without
// fighting normalization. The form posts the raw string; the Server Action
// normalizes via fromStringToCents() in lib/household/money.ts.
//
// Pass `onValueChange` to observe edits — the native `onChange` handler is
// owned internally and would be silently overwritten if the spread leaked it.
export function MoneyInput({
  name,
  defaultValue = "",
  required = true,
  placeholder = "0.00",
  className = "",
  onValueChange,
  ...rest
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  onValueChange?: (value: string) => void;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  | "name"
  | "defaultValue"
  | "type"
  | "required"
  | "placeholder"
  | "className"
  | "value"
  | "onChange"
>) {
  const [value, setValue] = useState(defaultValue);
  return (
    <input
      type="text"
      inputMode="decimal"
      name={name}
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        onValueChange?.(e.target.value);
      }}
      required={required}
      placeholder={placeholder}
      className={`rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono dark:border-zinc-700 dark:bg-zinc-900 ${className}`}
      {...rest}
    />
  );
}
