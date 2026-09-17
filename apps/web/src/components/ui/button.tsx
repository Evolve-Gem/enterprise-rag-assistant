"use client";

import { Loader2 } from "lucide-react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] shadow-sm disabled:bg-[var(--color-accent)]",
  secondary:
    "bg-[var(--color-surface-sunken)] text-[var(--color-ink)] hover:bg-[var(--color-line-faint)] border border-[var(--color-line)]",
  ghost:
    "text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink)]",
  outline:
    "border border-[var(--color-line-strong)] text-[var(--color-ink)] hover:border-[var(--color-accent-line)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent-ink)]",
  danger:
    "bg-[var(--color-danger)] text-white hover:opacity-90 shadow-sm",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-[var(--radius-sm)]",
  md: "h-9 px-3.5 text-sm gap-2 rounded-[var(--radius-md)]",
  lg: "h-11 px-5 text-sm gap-2 rounded-[var(--radius-md)]",
  icon: "size-9 rounded-[var(--radius-md)]",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

/** The single button primitive. Every interactive control in the app uses it. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "md", loading = false, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center font-medium transition-[background-color,border-color,color,opacity] duration-150",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
      {children}
    </button>
  );
});
