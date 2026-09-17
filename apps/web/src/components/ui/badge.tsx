import { cn } from "@/lib/utils";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

const TONE: Record<Tone, string> = {
  neutral:
    "bg-[var(--color-surface-sunken)] text-[var(--color-ink-muted)] border-[var(--color-line)]",
  accent:
    "bg-[var(--color-accent-soft)] text-[var(--color-accent-ink)] border-[var(--color-accent-line)]",
  success:
    "bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success-line)]",
  warning:
    "bg-[var(--color-warning-soft)] text-[var(--color-warning)] border-[var(--color-warning-line)]",
  danger:
    "bg-[var(--color-danger-soft)] text-[var(--color-danger)] border-[var(--color-danger-line)]",
  info: "bg-[var(--color-info-soft)] text-[var(--color-info)] border-[var(--color-info-line)]",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-2xs font-medium",
        TONE[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/** Status dot with an accessible label. */
export function StatusDot({
  tone = "neutral",
  pulse = false,
  className,
  label,
}: {
  tone?: Tone;
  pulse?: boolean;
  className?: string;
  label?: string;
}) {
  const color: Record<Tone, string> = {
    neutral: "bg-[var(--color-ink-faint)]",
    accent: "bg-[var(--color-accent)]",
    success: "bg-[var(--color-success)]",
    warning: "bg-[var(--color-warning)]",
    danger: "bg-[var(--color-danger)]",
    info: "bg-[var(--color-info)]",
  };
  return (
    <span className={cn("relative inline-flex size-2 shrink-0", className)} title={label}>
      {pulse ? (
        <span
          className={cn("absolute inset-0 rounded-full animate-pulse-ring", color[tone])}
          aria-hidden
        />
      ) : null}
      <span className={cn("relative size-2 rounded-full", color[tone])} aria-hidden />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}

/** Monospaced id / path chip. */
export function CodeChip({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <code
      className={cn(
        "rounded-[var(--radius-xs)] border border-[var(--color-line)] bg-[var(--color-surface-sunken)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--color-ink-muted)]",
        className,
      )}
    >
      {children}
    </code>
  );
}

/** `<kbd>` hint. */
export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-[var(--radius-xs)] border border-[var(--color-line-strong)] bg-[var(--color-surface-raised)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-ink-muted)]">
      {children}
    </kbd>
  );
}
