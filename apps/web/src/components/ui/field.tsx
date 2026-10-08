"use client";

import { forwardRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Form control surface.
 *
 * V4.2 restyles every state instead of leaving them to the browser:
 *
 *   rest      a recessed well, so the field reads as "type here" rather than as
 *             one more white box with a border
 *   hover     the border firms up
 *   focus     the well lifts back to the surface colour and gets a soft brand
 *             halo — the ring is a glow, not a hard 2px outline, because a hard
 *             outline on a dense form reads as an error
 *   filled    unchanged surface (the value itself is the signal)
 *   disabled  inset + muted, cursor not-allowed
 *
 * The `:focus-visible` outline from globals.css still applies for keyboard
 * users; these rules add the mouse-focus treatment on top of it.
 */
const CONTROL = cn(
  "w-full rounded-[var(--radius-small)] border px-3 text-sm text-[var(--color-ink)]",
  "border-[var(--color-line)] bg-[var(--color-surface-inset)]",
  "placeholder:text-[var(--color-ink-faint)]",
  "transition-[background-color,border-color,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
  "hover:border-[var(--color-line-strong)]",
  // `focus-visible:outline-none` here would be wrong: this rule lives in the
  // utilities layer and would beat the global :focus-visible outline in the base
  // layer, leaving keyboard users with only a low-alpha glow as the indicator.
  // The border + halo are the *mouse* focus treatment; the outline stays for
  // keyboard focus on top of it.
  "focus:border-[var(--color-accent)] focus:bg-[var(--color-surface)]",
  "focus:shadow-[0_0_0_3px_var(--color-brand-glow-soft)]",
  "disabled:cursor-not-allowed disabled:border-[var(--color-line-faint)] disabled:bg-[var(--color-surface-sunken)] disabled:text-[var(--color-ink-muted)]",
  "aria-[invalid=true]:border-[var(--color-danger)] aria-[invalid=true]:bg-[var(--color-danger-soft)]",
);

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(CONTROL, "h-9", className)} {...props} />;
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(CONTROL, "resize-y py-2 leading-relaxed", className)}
      {...props}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(CONTROL, "h-9 cursor-pointer pr-8", className)}
      {...props}
    >
      {children}
    </select>
  );
});

export function Label({
  className,
  children,
  hint,
  htmlFor,
}: {
  className?: string;
  children: React.ReactNode;
  hint?: string;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "flex items-baseline justify-between gap-2 text-xs font-medium text-[var(--color-ink-soft)]",
        className,
      )}
    >
      <span>{children}</span>
      {hint ? (
        <span className="text-2xs font-normal text-[var(--color-ink-muted)]">{hint}</span>
      ) : null}
    </label>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} hint={hint}>
        {label}
      </Label>
      {children}
    </div>
  );
}
