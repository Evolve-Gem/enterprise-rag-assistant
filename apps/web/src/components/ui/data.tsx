"use client";

import { cn, formatCount, vizColor } from "@/lib/utils";

/* -------------------------------------------------------------- stat cards */

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  footer,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
  footer?: React.ReactNode;
  className?: string;
}) {
  const toneClass: Record<string, string> = {
    neutral: "text-[var(--color-ink-faint)]",
    accent: "text-[var(--color-accent)]",
    success: "text-[var(--color-success)]",
    warning: "text-[var(--color-warning)]",
    danger: "text-[var(--color-danger)]",
  };

  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
          {label}
        </p>
        {icon ? <span className={toneClass[tone]}>{icon}</span> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-[var(--color-ink)]">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs leading-relaxed text-[var(--color-ink-muted)]">{hint}</p>
      ) : null}
      {footer ? <div className="mt-3">{footer}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------- bars */

export function ProgressBar({
  value,
  tone = "accent",
  className,
  height = "h-1.5",
}: {
  value: number;
  tone?: "accent" | "success" | "warning" | "danger";
  className?: string;
  height?: string;
}) {
  const color: Record<string, string> = {
    accent: "bg-[var(--color-accent)]",
    success: "bg-[var(--color-success)]",
    warning: "bg-[var(--color-warning)]",
    danger: "bg-[var(--color-danger)]",
  };
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-[var(--color-surface-sunken)]", height, className)}
      role="progressbar"
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-300", color[tone])}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}

/** Horizontal bar list — the default chart for categorical counts. */
export function BarChart({
  data,
  max,
  valueFormatter = (value: number) => formatCount(value),
  className,
}: {
  data: { label: string; value: number; tone?: string }[];
  max?: number;
  valueFormatter?: (value: number) => string;
  className?: string;
}) {
  if (!data.length) {
    return (
      <p className="py-6 text-center text-xs text-[var(--color-ink-faint)]">暂无数据</p>
    );
  }
  const peak = max ?? Math.max(...data.map((item) => item.value), 1);

  return (
    <div className={cn("space-y-2.5", className)}>
      {data.map((item, index) => (
        <div key={item.label} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate text-[var(--color-ink-soft)]" title={item.label}>
              {item.label}
            </span>
            <span className="shrink-0 font-mono tabular-nums text-[var(--color-ink-muted)]">
              {valueFormatter(item.value)}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-sunken)]">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${Math.max((item.value / peak) * 100, item.value > 0 ? 3 : 0)}%`,
                backgroundColor: item.tone ?? vizColor(index),
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Single stacked bar, used for the covered/partial/missing split. */
export function StackedBar({
  segments,
  className,
  height = "h-2",
}: {
  segments: { label: string; value: number; color: string }[];
  className?: string;
  height?: string;
}) {
  const total = segments.reduce((sum, item) => sum + item.value, 0) || 1;
  return (
    <div className={cn("flex w-full overflow-hidden rounded-full bg-[var(--color-surface-sunken)]", height, className)}>
      {segments.map((segment) => (
        <div
          key={segment.label}
          className="h-full transition-[width] duration-500"
          style={{
            width: `${(segment.value / total) * 100}%`,
            backgroundColor: segment.color,
          }}
          title={`${segment.label}: ${segment.value}`}
        />
      ))}
    </div>
  );
}

/** Compact donut for ratio visualisation. */
export function Donut({
  value,
  size = 92,
  thickness = 9,
  label,
  sublabel,
  tone = "var(--color-accent)",
}: {
  value: number;
  size?: number;
  thickness?: number;
  label?: string;
  sublabel?: string;
  tone?: string;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * clamped;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface-sunken)"
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tone}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: "stroke-dasharray 500ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-semibold tabular-nums text-[var(--color-ink)]">
          {label ?? `${Math.round(clamped * 100)}%`}
        </span>
        {sublabel ? (
          <span className="text-2xs text-[var(--color-ink-faint)]">{sublabel}</span>
        ) : null}
      </div>
    </div>
  );
}

/** Minimal sparkline for latency / volume trends. */
export function Sparkline({
  values,
  width = 120,
  height = 32,
  tone = "var(--color-accent)",
}: {
  values: number[];
  width?: number;
  height?: number;
  tone?: string;
}) {
  if (values.length < 2) {
    return <div className="h-8 text-2xs text-[var(--color-ink-faint)]">数据不足</div>;
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const points = values
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / span) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={tone}
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ tables */

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function TH({
  children,
  className,
  align = "left",
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      className={cn(
        "border-b border-[var(--color-line)] px-3 py-2 text-2xs font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-faint)]",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TD({
  children,
  className,
  align = "left",
  mono = false,
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  mono?: boolean;
}) {
  return (
    <td
      className={cn(
        "border-b border-[var(--color-line-faint)] px-3 py-2.5 align-top text-[var(--color-ink-soft)]",
        align === "right" && "text-right tabular-nums",
        align === "center" && "text-center",
        mono && "font-mono text-xs",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function TR({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "transition-colors",
        onClick && "cursor-pointer hover:bg-[var(--color-surface-sunken)]",
        className,
      )}
    >
      {children}
    </tr>
  );
}
