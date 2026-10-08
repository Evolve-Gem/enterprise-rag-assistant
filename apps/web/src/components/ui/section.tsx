"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Collapsible section with a self-describing header.
 *
 * Two rules from the V4.1 brief are encoded here rather than left to call sites:
 *
 * 1. `label` is required and must say what is hidden ("查看技术过程", not "更多").
 *    A collapsed section whose header does not name its contents just relocates
 *    the uncertainty instead of removing it.
 * 2. The header keeps a >=44px hit area at every breakpoint, so it stays usable
 *    on a phone without a separate mobile variant.
 *
 * V4.2 additions: open/close uses the shared motion tokens, the chevron rotates
 * on the standard easing, and the header tints on hover instead of swapping a
 * border colour.
 */
export function SectionAccordion({
  label,
  description,
  icon,
  children,
  defaultOpen = false,
  className,
  contentClassName,
}: {
  label: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[var(--radius-medium)] border border-[var(--color-line-faint)] bg-[var(--color-surface)]",
        "shadow-[var(--elevation-1)]",
        className,
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="group flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-[var(--motion-fast)] ease-[var(--ease-standard)] hover:bg-[var(--color-surface-subtle)]"
      >
        {icon ? (
          <span className="shrink-0 text-[var(--color-ink-muted)] transition-colors duration-[var(--motion-fast)] group-hover:text-[var(--color-accent)]">
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium text-[var(--color-ink)]">{label}</span>
          {description ? (
            <span className="mt-0.5 block text-2xs leading-relaxed text-[var(--color-ink-muted)]">
              {description}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-[var(--color-ink-faint)] transition-transform duration-[var(--motion-normal)] ease-[var(--ease-standard)] group-hover:text-[var(--color-ink-muted)]",
            open && "rotate-180",
          )}
        />
      </button>

      {/* min-h-0 on the grid item is what lets 0fr actually collapse to zero. */}
      <div
        id={panelId}
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows] duration-[var(--motion-normal)] ease-[var(--ease-standard)]",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={cn(
              "border-t border-[var(--color-line-faint)] px-4 py-4",
              contentClassName,
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The single raised card that owns a page's primary task.
 *
 * Radius 16 plus elevation-2 is the whole hierarchy trick: the eye lands on the
 * thing the page exists to do before it reads any of the chrome around it.
 */
export function MainTaskPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-large)] border border-[var(--color-line-faint)]",
        "bg-[var(--color-surface-raised)] shadow-[var(--elevation-2)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function MainTaskHeader({
  title,
  description,
  icon,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? (
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-[-0.008em] text-[var(--color-ink)]">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-xs leading-relaxed text-[var(--color-ink-muted)]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function MainTaskBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("px-4 py-4 sm:px-5", className)}>{children}</div>;
}

/**
 * Leads with the thing the user actually came for.
 *
 * Every result-bearing page renders one of these directly under the task panel,
 * so the answer is never below the explanation of the answer. It uses the
 * dedicated result surface — a 1% brand wash — so it reads as "this is what the
 * AI produced" rather than one more white card.
 */
export function ResultSection({
  label,
  meta,
  actions,
  icon,
  children,
  className,
}: {
  label: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[var(--radius-large)] border border-[var(--color-line-brand)]",
        "bg-[var(--color-surface-result)] shadow-[var(--elevation-2)]",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-line-brand)] px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          {icon ? (
            <span className="flex size-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
              {icon}
            </span>
          ) : null}
          <h2 className="text-sm font-semibold tracking-[-0.008em] text-[var(--color-ink)]">
            {label}
          </h2>
          {meta ? <span className="text-2xs text-[var(--color-ink-muted)]">{meta}</span> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className="px-4 py-4 sm:px-5">{children}</div>
    </section>
  );
}
