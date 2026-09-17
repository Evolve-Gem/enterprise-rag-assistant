"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

import { Badge, CodeChip } from "@/components/ui/badge";
import type { TraceStep } from "@/lib/types";
import { cn, formatMs, TRACE_NODE_LABELS, TRACE_STATUS_TONE } from "@/lib/utils";

/** JSON-ish preview for structured step payloads. */
function PayloadBlock({ label, payload }: { label: string; payload: Record<string, unknown> }) {
  const entries = Object.entries(payload ?? {});
  if (entries.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
        {label}
      </p>
      <div className="space-y-0.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-sunken)] p-2.5">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-start gap-3 text-2xs">
            <span className="w-36 shrink-0 truncate font-mono text-[var(--color-ink-faint)]" title={key}>
              {key}
            </span>
            <span className="min-w-0 flex-1 break-words font-mono text-[var(--color-ink-soft)]">
              {typeof value === "object" && value !== null
                ? JSON.stringify(value)
                : String(value ?? "—")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TraceRow({ step, defaultOpen = false }: { step: TraceStep; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const tone = TRACE_STATUS_TONE[step.status] ?? TRACE_STATUS_TONE.pending;
  const hasDetail =
    Boolean(step.detail) ||
    Boolean(step.tool) ||
    Object.keys(step.inputs ?? {}).length > 0 ||
    Object.keys(step.outputs ?? {}).length > 0;

  return (
    <li className="relative pl-7">
      {/* rail */}
      <span className="absolute left-[9px] top-6 h-[calc(100%-1rem)] w-px bg-[var(--color-line)] last:hidden" aria-hidden />
      <span
        className={cn(
          "absolute left-[3px] top-[5px] flex size-[15px] items-center justify-center rounded-full border-2 border-[var(--color-surface)]",
          tone.dot,
        )}
        aria-hidden
      />

      <button
        type="button"
        onClick={() => hasDetail && setOpen((value) => !value)}
        className={cn(
          "group -ml-1 flex w-full items-start gap-2 rounded-[var(--radius-md)] px-1 py-1 text-left transition-colors",
          hasDetail && "hover:bg-[var(--color-surface-sunken)]",
        )}
        aria-expanded={open}
      >
        <ChevronRight
          className={cn(
            "mt-0.5 size-3 shrink-0 text-[var(--color-ink-faint)] transition-transform duration-150",
            open && "rotate-90",
            !hasDetail && "opacity-0",
          )}
        />

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-mono text-2xs text-[var(--color-ink-faint)]">
              {String(step.index).padStart(2, "0")}
            </span>
            <span className="text-[13px] font-medium text-[var(--color-ink)]">
              {TRACE_NODE_LABELS[step.node] ?? step.title}
            </span>
            {step.tool ? <CodeChip>{step.tool}</CodeChip> : null}
            <span className="ml-auto flex shrink-0 items-center gap-2">
              {step.status !== "success" ? (
                <Badge
                  tone={
                    step.status === "failed"
                      ? "danger"
                      : step.status === "warning"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {tone.label}
                </Badge>
              ) : null}
              <span className="font-mono text-2xs tabular-nums text-[var(--color-ink-faint)]">
                {formatMs(step.duration_ms)}
              </span>
            </span>
          </span>

          {step.summary ? (
            <span className="mt-0.5 block text-xs leading-relaxed text-[var(--color-ink-muted)]">
              {step.summary}
            </span>
          ) : null}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && hasDetail ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="ml-1 space-y-2.5 pb-3 pt-1.5">
              {step.detail ? (
                <p className="text-xs leading-relaxed text-[var(--color-ink-soft)]">{step.detail}</p>
              ) : null}
              <PayloadBlock label="输入" payload={step.inputs} />
              <PayloadBlock label="输出" payload={step.outputs} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  );
}

/**
 * Agent / RAG execution timeline.
 *
 * Each node the backend actually executed becomes one row with its real
 * duration and payloads — no reconstruction, no decoration.
 */
export function TraceTimeline({
  steps,
  className,
  emptyHint = "本次执行没有产生轨迹记录。",
}: {
  steps: TraceStep[];
  className?: string;
  emptyHint?: string;
}) {
  if (!steps.length) {
    return (
      <p className={cn("py-6 text-center text-xs text-[var(--color-ink-faint)]", className)}>
        {emptyHint}
      </p>
    );
  }

  return (
    <ul className={cn("space-y-0.5", className)}>
      {steps.map((step) => (
        <TraceRow key={`${step.index}-${step.node}`} step={step} />
      ))}
    </ul>
  );
}
