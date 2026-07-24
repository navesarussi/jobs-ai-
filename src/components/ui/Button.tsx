import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--hero)] text-white shadow-[0_10px_24px_rgba(16,42,80,0.22)] hover:bg-[var(--accent-strong)] active:scale-[0.98]",
  secondary:
    "border border-[var(--stroke)] bg-[var(--surface)] text-[var(--ink)] shadow-[var(--shadow-soft)] hover:border-[var(--accent)] hover:text-[var(--accent)] active:scale-[0.98]",
  ghost:
    "text-[var(--muted)] hover:bg-[var(--chip)] hover:text-[var(--ink)] active:scale-[0.98]",
  danger: "text-[var(--warn)] hover:bg-[var(--warn-bg)] active:scale-[0.98]",
};

export function Button(
  props: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant },
) {
  const { variant = "primary", className = "", ...rest } = props;
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[var(--control-radius)] px-4 py-2.5 text-sm font-medium transition duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${variants[variant]} ${className}`}
    />
  );
}
