"use client";

import { forwardRef } from "react";

import { cn } from "@/lib/utils";

const CONTROL =
  "w-full rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] transition-colors duration-150 focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/15 disabled:cursor-not-allowed disabled:bg-[var(--color-surface-sunken)] disabled:text-[var(--color-ink-muted)]";

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
      {hint ? <span className="text-2xs font-normal text-[var(--color-ink-faint)]">{hint}</span> : null}
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
