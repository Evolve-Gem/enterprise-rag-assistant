"use client";

import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A slim stage strip: the "what will happen" flow, rendered on ink.
 *
 * V5 language: every workbench page (Agent, Solution) opens its task area with
 * the same dark strip showing the five steps the system will take. It doubles
 * as the page's stage moment — the one ink object each page is allowed — and as
 * the shortest possible explanation of what the machine is about to do. The
 * first step is highlighted because that is where the user is standing.
 */
export function StageStrip({
  steps,
  aside,
  className,
}: {
  /** The first step is highlighted as "you are here". */
  steps: string[];
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("stage-panel grain relative px-4 py-3.5 sm:px-5", className)}
      // The shared stage radius (24px) is tuned for hero-sized panels; a slim
      // strip narrows it so the ends do not look like a pill.
      style={{ borderRadius: "var(--radius-large)" }}
    >
      <div aria-hidden className="aurora-field aurora-field-subtle opacity-50" />
      <div className="relative flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {steps.map((step, index) => (
          <span key={step} className="flex items-center gap-2">
            {index > 0 ? (
              <ChevronRight aria-hidden className="size-3 text-[var(--color-stage-ink-faint)]" />
            ) : null}
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-2xs",
                index === 0
                  ? "bg-[var(--color-stage-accent-soft)] font-medium text-[var(--color-stage-accent)]"
                  : "text-[var(--color-stage-ink-muted)]",
              )}
            >
              {step}
            </span>
          </span>
        ))}
        {aside ? (
          <span className="ml-auto hidden shrink-0 items-center gap-2 text-2xs text-[var(--color-stage-ink-faint)] sm:flex">
            {aside}
          </span>
        ) : null}
      </div>
    </section>
  );
}
