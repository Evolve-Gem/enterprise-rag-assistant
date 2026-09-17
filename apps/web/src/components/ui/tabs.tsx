"use client";

import { cn } from "@/lib/utils";

/** Underline tab bar — matches the dense, document-like feel of the app. */
export function Tabs<T extends string>({
  value,
  options,
  onChange,
  className,
  size = "md",
}: {
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (next: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex items-center gap-1 overflow-x-auto border-b border-[var(--color-line)]",
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative whitespace-nowrap font-medium transition-colors duration-150",
              size === "sm" ? "px-2.5 py-2 text-xs" : "px-3 py-2.5 text-[13px]",
              active
                ? "text-[var(--color-ink)]"
                : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]",
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {option.label}
              {typeof option.count === "number" ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-2xs tabular-nums",
                    active
                      ? "bg-[var(--color-accent-soft)] text-[var(--color-accent-ink)]"
                      : "bg-[var(--color-surface-sunken)] text-[var(--color-ink-faint)]",
                  )}
                >
                  {option.count}
                </span>
              ) : null}
            </span>
            {active ? (
              <span className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-[var(--color-accent)]" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
