"use client";

import { AlertTriangle, Inbox, RefreshCw, WifiOff } from "lucide-react";

import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Card } from "./card";

/* --------------------------------------------------------------- skeletons */

/** Shimmering placeholder block. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "shimmer rounded-[var(--radius-sm)] bg-[var(--color-surface-sunken)]",
        className,
      )}
    />
  );
}

/** Skeleton shaped like a metric card grid. */
export function SkeletonGrid({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} className="p-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-7 w-24" />
          <Skeleton className="mt-3 h-3 w-32" />
        </Card>
      ))}
    </div>
  );
}

/** Skeleton shaped like a list of rows. */
export function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 rounded-[var(--radius-md)] border border-[var(--color-line)] px-4 py-3"
        >
          <Skeleton className="size-8 shrink-0 rounded-[var(--radius-sm)]" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="h-3 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ states */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface)] px-6 py-12 text-center",
        className,
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-surface-sunken)] text-[var(--color-ink-faint)]">
        {icon ?? <Inbox className="size-5" />}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-[var(--color-ink)]">{title}</p>
        {description ? (
          <p className="mx-auto max-w-md text-xs leading-relaxed text-[var(--color-ink-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

/**
 * Error state that never shows a stack trace.
 *
 * A network failure gets a different message and icon from an application
 * error, because the fix is different: start the backend vs. retry.
 */
export function ErrorState({
  error,
  onRetry,
  className,
  compact = false,
}: {
  error: Error;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}) {
  const isNetwork = error instanceof ApiError && error.status === 0;
  const isAuth = error instanceof ApiError && error.isUnauthorized;

  const title = isNetwork
    ? "无法连接后端服务"
    : isAuth
      ? "需要访问密码"
      : "加载失败";

  const description = isNetwork
    ? "请确认 FastAPI 后端已启动（uvicorn app.main:app --port 8000）。"
    : isAuth
      ? "当前部署启用了演示访问密码，请重新登录后再试。"
      : error.message;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-danger-line)] bg-[var(--color-danger-soft)] text-center",
        compact ? "px-4 py-6" : "px-6 py-10",
        className,
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-surface)] text-[var(--color-danger)]">
        {isNetwork ? <WifiOff className="size-5" /> : <AlertTriangle className="size-5" />}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-[var(--color-ink)]">{title}</p>
        <p className="mx-auto max-w-md text-xs leading-relaxed text-[var(--color-ink-muted)]">
          {description}
        </p>
      </div>
      {onRetry ? (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw className="size-3.5" />
          重试
        </Button>
      ) : null}
    </div>
  );
}

/** Inline error banner for form submissions. */
export function InlineError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-danger-line)] bg-[var(--color-danger-soft)] px-3 py-2">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[var(--color-danger)]" />
      <p className="text-xs leading-relaxed text-[var(--color-ink-soft)]">{message}</p>
    </div>
  );
}

/** Inline warning banner. */
export function InlineWarning({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-warning-line)] bg-[var(--color-warning-soft)] px-3 py-2">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[var(--color-warning)]" />
      <p className="text-xs leading-relaxed text-[var(--color-ink-soft)]">{message}</p>
    </div>
  );
}

/** Inline info banner. */
export function InlineInfo({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--color-info-line)] bg-[var(--color-info-soft)] px-3 py-2">
      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[var(--color-info)]" />
      <p className="text-xs leading-relaxed text-[var(--color-ink-soft)]">{message}</p>
    </div>
  );
}
