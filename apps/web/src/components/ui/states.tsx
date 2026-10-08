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
    <div className={cn("shimmer rounded-[var(--radius-sm)] bg-[var(--color-surface-inset)]", className)} />
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
          className="flex items-center gap-4 rounded-[var(--radius-medium)] border border-[var(--color-line-faint)] bg-[var(--color-surface)] px-4 py-3"
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

/**
 * Empty state.
 *
 * V4.2: the dashed-strong border was shouting "there is nothing here" louder
 * than the message inside it. It is now a quiet surface with a soft icon well,
 * so an empty panel reads as a calm resting state rather than as a warning.
 */
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
        "flex flex-col items-center justify-center gap-3.5 rounded-[var(--radius-medium)]",
        "border border-[var(--color-line-faint)] bg-[var(--color-surface-subtle)] px-6 py-12 text-center",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
        {icon ?? <Inbox className="size-5" />}
      </div>
      <div className="space-y-1.5">
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
 * Error state.
 *
 * A network failure gets a different message and icon from an application
 * error, because the fix is different: start the backend vs. retry.
 *
 * V4.2 follows the shared error language: a plain-language title, a short
 * explanation of what the reader can actually do, a retry affordance, and the
 * raw error tucked into a collapsed "technical detail" — never as a wall of red
 * text, and never for the network/auth cases where the message would be
 * meaningless to the person reading it.
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
  const showDetail = !isNetwork && !isAuth;

  // Written for whoever is looking at the page, not for whoever wrote it:
  // the public demo has no console, and "start uvicorn" is not an instruction a
  // visitor can act on. The actionable detail lives in the browser network tab.
  const title = isNetwork ? "暂时无法连接服务" : isAuth ? "需要访问密码" : "加载失败";

  const description = isNetwork
    ? "演示服务暂时连不上，请稍后重试。如果持续失败，说明后端实例当前没有在运行。"
    : isAuth
      ? "当前部署启用了演示访问密码，请重新登录后再试。"
      : "这次请求没有成功完成。可以先重试；失败只影响这一块内容，页面其他部分不受影响。";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3.5 rounded-[var(--radius-medium)]",
        "border border-[var(--color-danger-line)] bg-[var(--color-danger-soft)] text-center",
        compact ? "px-4 py-6" : "px-6 py-10",
        className,
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-full bg-[var(--color-surface)] text-[var(--color-danger)] shadow-[var(--elevation-1)]">
        {isNetwork ? <WifiOff className="size-5" /> : <AlertTriangle className="size-5" />}
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-[var(--color-ink)]">{title}</p>
        <p className="mx-auto max-w-md text-xs leading-relaxed text-[var(--color-ink-soft)]">
          {description}
        </p>
      </div>
      {onRetry ? (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw className="size-3.5" />
          重试
        </Button>
      ) : null}
      {showDetail && error.message ? (
        <details className="group w-full max-w-md text-left">
          <summary className="mx-auto w-fit cursor-pointer list-none text-2xs text-[var(--color-ink-muted)] transition-colors duration-[var(--motion-fast)] hover:text-[var(--color-ink-soft)]">
            查看技术细节
          </summary>
          <p className="mt-2 break-words rounded-[var(--radius-sm)] bg-[var(--color-surface)] px-2.5 py-2 font-mono text-2xs leading-relaxed text-[var(--color-ink-muted)]">
            {error.name ? `${error.name}: ` : ""}
            {error.message}
          </p>
        </details>
      ) : null}
    </div>
  );
}

/** Inline error banner for form submissions. */
export function InlineError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-[var(--radius-small)] border border-[var(--color-danger-line)] bg-[var(--color-danger-soft)] px-3 py-2">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[var(--color-danger)]" />
      <p className="text-xs leading-relaxed text-[var(--color-ink-soft)]">{message}</p>
    </div>
  );
}

/** Inline warning banner. */
export function InlineWarning({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-[var(--radius-small)] border border-[var(--color-warning-line)] bg-[var(--color-warning-soft)] px-3 py-2">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[var(--color-warning)]" />
      <p className="text-xs leading-relaxed text-[var(--color-ink-soft)]">{message}</p>
    </div>
  );
}

/** Inline info banner. */
export function InlineInfo({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-[var(--radius-small)] border border-[var(--color-info-line)] bg-[var(--color-info-soft)] px-3 py-2">
      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[var(--color-info)]" />
      <p className="text-xs leading-relaxed text-[var(--color-ink-soft)]">{message}</p>
    </div>
  );
}
