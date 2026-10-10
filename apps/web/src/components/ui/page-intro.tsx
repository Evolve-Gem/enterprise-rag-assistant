import { cn } from "@/lib/utils";

/**
 * In-page page introduction.
 *
 * The sticky topbar carries the short title; this block carries the *guidance* —
 * what the page is for, in the language of the person using it.
 *
 * V5: promoted from a caption to an editorial header. A page used to open with
 * a 17px sentence that the eye skipped; it now opens with a tracked kicker, a
 * 20px title and a hairline — the same rhythm on every page, which is what
 * stops the product reading as separately-designed screens. The divider is
 * still a single faint line rather than a filled band: a header that shouts
 * costs first-screen height that this product cannot spare.
 */
export function PageIntro({
  kicker,
  title,
  subtitle,
  aside,
  className,
  divider = true,
}: {
  /** Small tracked label above the title, e.g. "Knowledge Base". */
  kicker?: React.ReactNode;
  title: React.ReactNode;
  subtitle: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
  divider?: boolean;
}) {
  return (
    <div className={cn("pb-3.5", divider && "border-b border-[var(--color-line-faint)]", className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          {kicker ? <p className="kicker mb-1.5">{kicker}</p> : null}
          <h2 className="text-[20px] font-semibold leading-7 tracking-[-0.018em] text-[var(--color-ink)]">
            {title}
          </h2>
          <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-[var(--color-ink-muted)]">
            {subtitle}
          </p>
        </div>
        {aside ? <div className="flex shrink-0 flex-wrap items-center gap-2">{aside}</div> : null}
      </div>
    </div>
  );
}

/**
 * "What you will get" / "what just happened" note.
 *
 * Used to explain an outcome in plain language *before* exposing the technical
 * trace, so a non-specialist is never forced through engineering vocabulary.
 *
 * V4.2: the step chain is a set of quiet pills rather than bare text with
 * arrow separators — it reads as a process at a glance, and the arrows are
 * demoted to spacing rather than glyphs.
 */
export function StepNote({
  label,
  steps,
  detail,
  className,
}: {
  label: string;
  steps: string[];
  detail?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-medium)] border border-[var(--color-line-faint)] bg-[var(--color-surface-subtle)] px-3.5 py-3",
        className,
      )}
    >
      <p className="text-2xs font-semibold tracking-[0.04em] text-[var(--color-ink-muted)]">
        {label}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {steps.map((step, index) => (
          <span key={step} className="flex items-center gap-1.5">
            {index > 0 ? (
              <span aria-hidden className="text-[10px] text-[var(--color-ink-faint)]">
                ›
              </span>
            ) : null}
            <span className="rounded-[var(--radius-xs)] bg-[var(--color-surface)] px-1.5 py-0.5 text-2xs text-[var(--color-ink-soft)] ring-1 ring-inset ring-[var(--color-line-faint)]">
              {step}
            </span>
          </span>
        ))}
      </div>
      {detail ? <div className="mt-2">{detail}</div> : null}
    </div>
  );
}
