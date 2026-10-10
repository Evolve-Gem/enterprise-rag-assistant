"use client";

import { Loader2 } from "lucide-react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "frame" | "stage";
type Size = "sm" | "md" | "lg" | "icon";

/**
 * Variant styling.
 *
 * V4.2 rebuilt each state rather than relying on `hover:opacity-90`. The
 * primary button now carries a soft brand-tinted shadow that deepens on hover,
 * so the feedback reads as light rather than as a colour swap; outline buttons
 * are elevated surfaces instead of bare borders.
 *
 * V5 adds `frame` — the ghost button for the ink chrome. It exists as its own
 * variant (rather than a call-site className) because hover colours conflict
 * with `ghost`, and conflicting Tailwind utilities resolve by stylesheet order,
 * not by the order they were concatenated.
 */
const VARIANT: Record<Variant, string> = {
  primary: cn(
    // Fill uses the *solid* token, not --color-accent: that one is lightened in
    // dark mode for text/border legibility, and white on it measured 2.63:1.
    "bg-[var(--color-accent-solid)] text-white",
    "shadow-[0_1px_2px_rgb(16_16_24/0.12),0_8px_18px_-10px_var(--color-brand-glow)]",
    "hover:bg-[var(--color-accent-solid-hover)]",
    "hover:shadow-[0_1px_2px_rgb(16_16_24/0.14),0_12px_24px_-10px_var(--color-brand-glow)]",
    "active:shadow-[0_1px_2px_rgb(16_16_24/0.12)]",
  ),
  outline: cn(
    "border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)]",
    "shadow-[var(--elevation-1)]",
    "hover:border-[var(--color-accent-line)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent-ink)]",
  ),
  secondary: cn(
    "border border-[var(--color-line)] bg-[var(--color-surface-inset)] text-[var(--color-ink)]",
    "hover:bg-[var(--color-surface-sunken)]",
  ),
  ghost: cn(
    "text-[var(--color-ink-soft)]",
    "hover:bg-[var(--color-surface-inset)] hover:text-[var(--color-ink)]",
  ),
  danger: cn(
    "bg-[var(--color-danger)] text-white",
    "shadow-[0_1px_2px_rgb(16_16_24/0.12)]",
    "hover:bg-[color-mix(in_oklab,var(--color-danger)_88%,black)]",
  ),
  frame: cn(
    "text-[var(--color-frame-ink-soft)]",
    "hover:bg-[var(--color-frame-hover)] hover:text-[var(--color-frame-ink)]",
  ),
  // The secondary button for stage surfaces: a glass chip of light, not a
  // white slab (white reads as a hole punched in the panel).
  stage: cn(
    "border border-[var(--color-stage-line-strong)] bg-[rgb(255_255_255/0.06)] text-[var(--color-stage-ink)]",
    "hover:border-[rgb(255_255_255/0.24)] hover:bg-[rgb(255_255_255/0.12)]",
  ),
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-[var(--radius-small)]",
  md: "h-9 px-3.5 text-sm gap-2 rounded-[var(--radius-small)]",
  lg: "h-11 px-5 text-sm gap-2 rounded-[var(--radius-medium)]",
  icon: "size-9 rounded-[var(--radius-small)]",
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
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-medium",
        "transition-[background-color,border-color,color,box-shadow,transform]",
        "duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
        // A 1.5% press. Enough to feel physical, small enough to never look
        // like the button moved to a different place.
        "active:scale-[0.985]",
        "disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="size-3.5 shrink-0 animate-spin" /> : null}
      {children}
    </button>
  );
});
