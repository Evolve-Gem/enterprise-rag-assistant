import { cn } from "@/lib/utils";

/**
 * Surface level.
 *
 * V4.2 replaced "white card + grey border" with an explicit hierarchy, because
 * when every layer is #ffffff the only thing that can express structure is a
 * border — which is exactly the wall-of-white-cards look. Each level now pairs
 * a distinct background with a distinct elevation.
 *
 * - `base`        ordinary content card           (surface + elev-1)
 * - `subtle`      secondary information, recedes  (subtle fill, no shadow)
 * - `raised`      the primary task panel          (surface-raised + elev-2)
 * - `result`      what the AI produced            (1% brand wash + elev-2)
 * - `interactive` list rows / clickable items     (tints on hover)
 * - `inset`       recessed wells: code, tables    (inset fill, no shadow)
 */
export type SurfaceLevel = "base" | "subtle" | "raised" | "result" | "interactive" | "inset";

const SURFACE: Record<SurfaceLevel, string> = {
  base: "surface-base",
  subtle: "surface-subtle",
  raised: "surface-raised",
  result: "surface-result",
  interactive: "surface-base surface-interactive",
  inset: "surface-inset",
};

/** Recessed levels carry no elevation and no border; they sit *inside* things. */
const RECESSED: SurfaceLevel[] = ["subtle", "inset"];

/** Surface container used for every panel in the app. */
export function Card({
  className,
  interactive = false,
  surface = "base",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean; surface?: SurfaceLevel }) {
  const level: SurfaceLevel = interactive ? "interactive" : surface;
  return (
    <div
      className={cn(
        "rounded-[var(--radius-medium)]",
        SURFACE[level],
        // A near-invisible hairline: it exists because dark mode needs some
        // edge definition where shadows read weakly, not to draw the card.
        !RECESSED.includes(level) && "border border-[var(--color-line-faint)]",
        interactive &&
          "lift cursor-pointer hover:border-[var(--color-line)]",
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
        "flex items-start justify-between gap-4 border-b border-[var(--color-line-faint)]",
        dense ? "px-4 py-3" : "px-5 py-4",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? (
          <span className="mt-0.5 shrink-0 text-[var(--color-ink-muted)]">{icon}</span>
        ) : null}
        <div className="min-w-0">
          <h2 className="truncate text-[13.5px] font-semibold leading-5 tracking-[-0.006em] text-[var(--color-ink)]">
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
        "flex items-center justify-between gap-3 border-t border-[var(--color-line-faint)] px-5 py-3",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Editorial kicker — the small tracked label that opens a section.
 *
 * V5: this is the element that gives pages a *rhythm* instead of another row of
 * identical headings. `index` renders a two-digit ordinal ("01") on long pages;
 * `tone="stage"` switches it to stage colours when it sits on ink; `rule`
 * draws a hairline out to the section edge.
 */
export function Kicker({
  index,
  tone = "light",
  rule = false,
  className,
  children,
}: {
  index?: string;
  tone?: "light" | "stage";
  rule?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "kicker",
        tone === "stage" && "kicker-stage",
        rule && "kicker-rule",
        rule && tone === "stage" && "kicker-rule-stage",
        className,
      )}
    >
      {index ? (
        <span className="font-mono tracking-[0.08em] opacity-80">{index}</span>
      ) : null}
      <span className="truncate">{children}</span>
    </p>
  );
}

/**
 * Small section label.
 *
 * Was uppercase + `ink-faint`; uppercase Latin tracking on a Chinese product
 * reads as decoration, and the faint tier was under AA. Now sentence-case,
 * medium weight, `ink-muted`.
 */
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
        "text-2xs font-semibold tracking-[0.04em] text-[var(--color-ink-muted)]",
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
