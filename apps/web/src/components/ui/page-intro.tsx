import { cn } from "@/lib/utils";

/**
 * In-page page introduction.
 *
 * The sticky topbar carries the short title; this block carries the *guidance* —
 * what the page is for, in the language of the person using it. Kept as a single
 * component so every page introduces itself the same way.
 */
export function PageIntro({
  title,
  subtitle,
  aside,
  className,
}: {
  title: React.ReactNode;
  subtitle: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between", className)}>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--color-ink)]">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[var(--color-ink-muted)]">
          {subtitle}
        </p>
      </div>
      {aside ? <div className="flex shrink-0 flex-wrap items-center gap-2">{aside}</div> : null}
    </div>
  );
}

/**
 * "What you will get" / "what just happened" note.
 *
 * Used to explain an outcome in plain language *before* exposing the technical
 * trace, so a non-specialist is never forced through engineering vocabulary.
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
        "rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-sunken)] px-3.5 py-3",
        className,
      )}
    >
      <p className="text-2xs font-semibold tracking-[0.08em] text-[var(--color-ink-faint)]">
        {label}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {steps.map((step, index) => (
          <span key={step} className="flex items-center gap-1.5">
            {index > 0 ? (
              <span aria-hidden className="text-[var(--color-ink-faint)]">
                →
              </span>
            ) : null}
            <span className="text-xs text-[var(--color-ink-soft)]">{step}</span>
          </span>
        ))}
      </div>
      {detail ? <div className="mt-1.5">{detail}</div> : null}
    </div>
  );
}
