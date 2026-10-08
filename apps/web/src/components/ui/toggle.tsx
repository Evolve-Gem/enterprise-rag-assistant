"use client";

import { cn } from "@/lib/utils";

/** Accessible switch, styled as a compact track + knob. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  id?: string;
}) {
  const control = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-[var(--motion-fast)] ease-[var(--ease-standard)] disabled:cursor-not-allowed disabled:opacity-50",
        checked
          // The knob is near-white, so the track is a UI component that needs
          // 3:1 against it (WCAG 1.4.11) — the lightened --color-accent gave
          // only ~2.5:1 in dark mode. Same root cause as the primary button.
          ? "border-[var(--color-accent-solid)] bg-[var(--color-accent-solid)]"
          : "border-[var(--color-line-strong)] bg-[var(--color-surface-sunken)]",
      )}
    >
      <span
        className={cn(
          "inline-block size-3.5 rounded-full bg-[var(--color-switch-knob)] shadow-sm transition-transform duration-[var(--motion-normal)] ease-[var(--ease-standard)]",
          checked ? "translate-x-[1.15rem]" : "translate-x-[0.15rem]",
        )}
      />
    </button>
  );

  if (!label && !description) return control;

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        {label ? (
          <label htmlFor={id} className="text-sm text-[var(--color-ink)]">
            {label}
          </label>
        ) : null}
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-ink-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {control}
    </div>
  );
}

/** Segmented control for small mutually-exclusive option sets. */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  size = "md",
  className,
  disabled = false,
}: {
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (next: T) => void;
  size?: "sm" | "md";
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-[var(--radius-small)] border border-[var(--color-line-faint)] bg-[var(--color-surface-inset)] p-0.5",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="radio"
            aria-checked={active}
            type="button"
            disabled={disabled}
            title={option.hint}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-[var(--radius-xs)] font-medium transition-colors duration-[var(--motion-fast)] ease-[var(--ease-standard)] disabled:cursor-not-allowed",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-[13px]",
              active
                ? "bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[var(--elevation-1)]"
                : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
