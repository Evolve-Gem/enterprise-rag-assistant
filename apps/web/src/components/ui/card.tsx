import { cn } from "@/lib/utils";

/** Surface container used for every panel in the app. */
export function Card({
  className,
  interactive = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)]",
        interactive &&
          "transition-colors duration-150 hover:border-[var(--color-line-strong)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  title,
  description,
  actions,
  icon,
  dense = false,
}: {
  className?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  dense?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-[var(--color-line)]",
        dense ? "px-4 py-3" : "px-5 py-4",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? (
          <span className="mt-0.5 text-[var(--color-ink-faint)]">{icon}</span>
        ) : null}
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-[var(--color-ink)]">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-ink-muted)]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-t border-[var(--color-line)] px-5 py-3",
        className,
      )}
      {...props}
    />
  );
}

/** Small uppercase section label. */
export function SectionLabel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "text-2xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Definition row: label on the left, value on the right. */
export function DefRow({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[var(--color-line-faint)] py-2 last:border-0">
      <span className="shrink-0 text-xs text-[var(--color-ink-muted)]">{label}</span>
      <span
        className={cn(
          "min-w-0 truncate text-right text-xs text-[var(--color-ink)]",
          mono && "font-mono",
        )}
      >
        {children}
      </span>
    </div>
  );
}
