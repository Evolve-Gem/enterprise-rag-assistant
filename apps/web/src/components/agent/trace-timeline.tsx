"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Blocks,
  BookOpen,
  ChevronRight,
  Compass,
  Flag,
  Inbox,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";

import { Badge, CodeChip } from "@/components/ui/badge";
import type { TraceStep } from "@/lib/types";
import { cn, formatMs, TRACE_NODE_LABELS, TRACE_STATUS_TONE } from "@/lib/utils";

/* ------------------------------------------------------------------ stages */

/**
 * Semantic stage of a backend trace node.
 *
 * The backend ships fine-grained node ids (`understand`, `rerank`, `finalize`
 * …); the timeline groups them into the seven phases a reader actually thinks
 * in. This is a pure presentation mapping — the trace data is untouched.
 */
type Stage = "receive" | "intent" | "skill" | "tool" | "evidence" | "generate" | "complete";

const NODE_STAGE: Record<string, Stage> = {
  guard: "receive",
  understand: "receive",
  analyze_question: "receive",
  route_intent: "intent",
  plan: "skill",
  execute_tools: "tool",
  retrieve: "evidence",
  fuse: "evidence",
  rerank: "evidence",
  context: "evidence",
  generate: "generate",
  grounding: "generate",
  human_check: "complete",
  finalize: "complete",
  fallback: "complete",
};

const STAGE_META: Record<Stage, { label: string; icon: LucideIcon }> = {
  receive: { label: "接收", icon: Inbox },
  intent: { label: "意图", icon: Compass },
  skill: { label: "能力", icon: Blocks },
  tool: { label: "工具", icon: Wrench },
  evidence: { label: "证据", icon: BookOpen },
  generate: { label: "生成", icon: Sparkles },
  complete: { label: "完成", icon: Flag },
};

function stageOf(node: string): Stage {
  return NODE_STAGE[node] ?? "complete";
}

/* ------------------------------------------------------------------ payload */

/** Recessed key/value block for structured step payloads. */
function PayloadBlock({ label, payload }: { label: string; payload: Record<string, unknown> }) {
  const entries = Object.entries(payload ?? {});
  if (entries.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="text-2xs font-medium tracking-[0.04em] text-[var(--color-ink-muted)]">{label}</p>
      <div className="space-y-0.5 rounded-[var(--radius-medium)] border border-[var(--color-line-faint)] surface-inset p-2.5">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-start gap-3 text-2xs">
            <span
              className="w-32 shrink-0 truncate font-mono text-[var(--color-ink-faint)]"
              title={key}
            >
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

/* --------------------------------------------------------------------- row */

/** A tiny metadata pair used inside the expanded detail. */
function Meta({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-[var(--color-ink-faint)]">{label}</span>
      <span className={cn("text-[var(--color-ink-soft)]", mono && "font-mono")}>{value}</span>
    </span>
  );
}

function TraceRow({
  step,
  isLast,
  showStage,
}: {
  step: TraceStep;
  isLast: boolean;
  showStage: boolean;
}) {
  const [open, setOpen] = useState(false);

  const stage = stageOf(step.node);
  const StageIcon = STAGE_META[stage].icon;
  const tone = TRACE_STATUS_TONE[step.status] ?? TRACE_STATUS_TONE.pending;
  const failed = step.status === "failed";
  const done = step.status === "success";

  const nodeLabel = TRACE_NODE_LABELS[step.node] ?? step.title;
  const hasDetail =
    Boolean(step.detail) ||
    Boolean(step.tool) ||
    Object.keys(step.inputs ?? {}).length > 0 ||
    Object.keys(step.outputs ?? {}).length > 0;

  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3">
      {/* rail: node dot + connector */}
      <div className="flex flex-col items-center" aria-hidden>
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full border border-[var(--color-line-faint)]",
            tone.bg,
            tone.text,
          )}
        >
          <StageIcon className="size-3.5" />
        </span>
        {!isLast ? (
          <span
            className={cn(
              "mt-1 w-px flex-1",
              done ? "bg-[var(--color-accent-line)]" : "bg-[var(--color-line)]",
            )}
          />
        ) : null}
      </div>

      {/* content */}
      <div className={cn("min-w-0", !isLast && "pb-4")}>
        {showStage ? (
          <p className="mb-1 text-[10px] font-medium tracking-[0.06em] text-[var(--color-ink-faint)]">
            {STAGE_META[stage].label}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => hasDetail && setOpen((value) => !value)}
          aria-expanded={hasDetail ? open : undefined}
          className={cn(
            "group -ml-1 flex w-full items-start gap-2 rounded-[var(--radius-small)] px-1 py-0.5 text-left",
            hasDetail &&
              "transition-colors duration-[var(--motion-fast)] ease-[var(--ease-standard)] hover:bg-[var(--color-surface-subtle)]",
          )}
        >
          <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[13px] font-medium text-[var(--color-ink)]">{nodeLabel}</span>
            {step.tool ? <CodeChip>{step.tool}</CodeChip> : null}
            <span className="ml-auto flex shrink-0 items-center gap-2">
              {step.status !== "success" ? (
                <Badge
                  tone={
                    failed ? "danger" : step.status === "warning" ? "warning" : "neutral"
                  }
                >
                  {tone.label}
                </Badge>
              ) : null}
              <span className="font-mono text-2xs tabular-nums text-[var(--color-ink-faint)]">
                {formatMs(step.duration_ms)}
              </span>
              <ChevronRight
                className={cn(
                  "size-3.5 shrink-0 text-[var(--color-ink-faint)] transition-transform duration-[var(--motion-fast)] ease-[var(--ease-standard)] group-hover:text-[var(--color-ink-muted)]",
                  open && "rotate-90",
                  !hasDetail && "opacity-0",
                )}
              />
            </span>
          </span>
        </button>

        {/* failed nodes keep their reason visible even when collapsed */}
        {failed ? (
          <div className="mt-1.5 flex items-start gap-2 rounded-[var(--radius-medium)] border border-[var(--color-danger-line)] bg-[var(--color-danger-soft)] px-2.5 py-2">
            <AlertTriangle className="mt-px size-3.5 shrink-0 text-[var(--color-danger)]" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-[var(--color-ink)]">执行失败</p>
              <p className="mt-0.5 text-2xs leading-relaxed text-[var(--color-ink-muted)]">
                {step.detail || step.summary || "该节点执行失败，未返回原因。"}
              </p>
            </div>
          </div>
        ) : step.summary ? (
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-ink-muted)]">
            {step.summary}
          </p>
        ) : null}

        <AnimatePresence initial={false}>
          {open && hasDetail ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="space-y-2.5 pt-2">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-2xs">
                  <Meta label="阶段" value={STAGE_META[stage].label} />
                  {step.tool ? <Meta label="工具" value={step.tool} mono /> : null}
                  <Meta label="节点" value={step.node} mono />
                </div>
                {!failed && step.detail ? (
                  <p className="text-xs leading-relaxed text-[var(--color-ink-soft)]">
                    {step.detail}
                  </p>
                ) : null}
                <PayloadBlock label="输入" payload={step.inputs} />
                <PayloadBlock label="输出" payload={step.outputs} />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </li>
  );
}

/**
 * Agent / RAG execution timeline.
 *
 * Each node the backend actually executed becomes one row with its real
 * duration and payloads — no reconstruction, no decoration. Nodes are grouped
 * into seven semantic stages so the trace reads as a run, not a log.
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

  let previousStage: Stage | null = null;

  return (
    <ul className={cn("space-y-0", className)}>
      {steps.map((step, index) => {
        const stage = stageOf(step.node);
        const showStage = stage !== previousStage;
        previousStage = stage;
        return (
          <TraceRow
            key={`${step.index}-${step.node}`}
            step={step}
            isLast={index === steps.length - 1}
            showStage={showStage}
          />
        );
      })}
    </ul>
  );
}
