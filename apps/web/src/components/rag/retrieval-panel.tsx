"use client";

import { ArrowRight, Layers } from "lucide-react";

import { Badge, CodeChip, StatusDot } from "@/components/ui/badge";
import { BarChart } from "@/components/ui/data";
import type { RetrievalStats, RetrievedChunk } from "@/lib/types";
import { cn, formatPercent, truncate } from "@/lib/utils";

/** Compact "how the candidates were narrowed down" strip. */
export function RetrievalFunnel({
  stats,
  className,
}: {
  stats: RetrievalStats;
  className?: string;
}) {
  const steps = [
    { label: "候选池", value: stats.candidate_count },
    { label: "关键词命中", value: stats.keyword_hits },
    { label: "向量命中", value: stats.vector_hits },
    { label: `融合 (${stats.fusion_strategy || "—"})`, value: stats.after_fusion },
    { label: `重排 (${stats.rerank_provider})`, value: stats.after_rerank },
  ];

  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1.5", className)}>
      <Badge tone="accent">
        <Layers className="size-3" />
        {stats.mode}
      </Badge>
      {steps.map((step, index) => (
        <span key={step.label} className="flex items-center gap-2">
          {index > 0 ? (
            <ArrowRight className="size-3 text-[var(--color-ink-faint)]" aria-hidden />
          ) : null}
          <span className="flex items-baseline gap-1 text-2xs">
            <span className="text-[var(--color-ink-faint)]">{step.label}</span>
            <span className="font-mono font-semibold tabular-nums text-[var(--color-ink)]">
              {step.value}
            </span>
          </span>
        </span>
      ))}
    </div>
  );
}

/** Score bars for one candidate: keyword / vector / fused / rerank. */
function ScoreGrid({ chunk }: { chunk: RetrievedChunk }) {
  const rows = [
    { label: "关键词", value: chunk.keyword_score, max: Math.max(chunk.keyword_score, 1), tone: "var(--color-viz-2)" },
    { label: "向量", value: chunk.vector_score, max: 1, tone: "var(--color-viz-1)" },
    { label: "融合", value: chunk.fused_score, max: 1, tone: "var(--color-viz-3)" },
  ];
  if (chunk.rerank_score !== null) {
    rows.push({
      label: "重排",
      value: chunk.rerank_score,
      max: 1,
      tone: "var(--color-viz-4)",
    });
  }

  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-1 sm:grid-cols-4">
      {rows.map((row) => (
        <div key={row.label} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xs text-[var(--color-ink-faint)]">{row.label}</span>
            <span className="font-mono text-2xs tabular-nums text-[var(--color-ink-soft)]">
              {row.value.toFixed(3)}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-[var(--color-surface-sunken)]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min((row.value / row.max) * 100, 100)}%`,
                backgroundColor: row.tone,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Retrieved evidence list.
 *
 * Every candidate that reached the prompt is listed with its per-branch scores
 * so the retrieval stage can be inspected without opening a debugger.
 */
export function RetrievalPanel({
  chunks,
  onSelect,
  className,
  compact = false,
}: {
  chunks: RetrievedChunk[];
  onSelect?: (chunk: RetrievedChunk) => void;
  className?: string;
  compact?: boolean;
}) {
  if (!chunks.length) {
    return (
      <p className={cn("py-6 text-center text-xs text-[var(--color-ink-faint)]", className)}>
        没有检索到任何知识片段。
      </p>
    );
  }

  if (compact) {
    return (
      <ul className={cn("space-y-1", className)}>
        {chunks.map((chunk, index) => (
          <li key={chunk.chunk_id}>
            <button
              type="button"
              onClick={() => onSelect?.(chunk)}
              className="flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-left transition-colors hover:border-[var(--color-accent-line)] hover:bg-[var(--color-accent-soft)]/40"
            >
              <span className="flex size-5 shrink-0 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--color-surface-sunken)] font-mono text-[10px] text-[var(--color-ink-muted)]">
                {chunk.rank_final ?? index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-[var(--color-ink)]">
                  {chunk.document_name}
                </span>
                <span className="block truncate text-2xs text-[var(--color-ink-muted)]">
                  {chunk.section || "（无章节）"}
                </span>
              </span>
              <span className="shrink-0 font-mono text-2xs tabular-nums text-[var(--color-ink-faint)]">
                {(chunk.rerank_score ?? chunk.fused_score).toFixed(3)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {chunks.map((chunk, index) => (
        <button
          key={chunk.chunk_id}
          type="button"
          onClick={() => onSelect?.(chunk)}
          className="w-full rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-left transition-colors hover:border-[var(--color-accent-line)]"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-surface-sunken)] font-mono text-[11px] font-semibold text-[var(--color-ink-muted)]">
              {index + 1}
            </span>

            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-medium text-[var(--color-ink)]">
                  {chunk.document_name}
                </span>
                <CodeChip>#{chunk.index}</CodeChip>
                {chunk.found_by.map((branch) => (
                  <Badge key={branch} tone={branch === "vector" ? "info" : "accent"}>
                    <StatusDot tone={branch === "vector" ? "info" : "accent"} />
                    {branch === "vector" ? "向量命中" : "关键词命中"}
                  </Badge>
                ))}
                <span className="ml-auto font-mono text-2xs tabular-nums text-[var(--color-ink-faint)]">
                  {chunk.char_count} 字符
                </span>
              </div>

              {chunk.section ? (
                <p className="truncate text-2xs text-[var(--color-ink-muted)]" title={chunk.section}>
                  {chunk.section}
                </p>
              ) : null}

              <p className="text-xs leading-relaxed text-[var(--color-ink-soft)]">
                {truncate(chunk.preview || chunk.content, 220)}
              </p>

              <ScoreGrid chunk={chunk} />
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

/** Rank-shift visualisation: fused order vs. after-rerank order. */
export function RerankComparison({
  chunks,
  className,
}: {
  chunks: RetrievedChunk[];
  className?: string;
}) {
  const rows = chunks
    .filter((chunk) => chunk.rank_fused !== null || chunk.rank_final !== null)
    .slice(0, 8);

  if (rows.length < 2) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
        融合顺序 → 重排顺序
      </p>
      <BarChart
        data={rows.map((chunk, index) => ({
          label: `${index + 1}. ${truncate(chunk.document_name, 26)}`,
          value: Math.max(chunk.rank_fused ?? 0, chunk.rank_final ?? 0),
        }))}
        valueFormatter={(value) => `#${value}`}
      />
    </div>
  );
}

/** Share of evidence contributed by each branch. */
export function BranchBreakdown({ chunks }: { chunks: RetrievedChunk[] }) {
  const keywordOnly = chunks.filter(
    (chunk) => chunk.found_by.includes("keyword") && !chunk.found_by.includes("vector"),
  ).length;
  const vectorOnly = chunks.filter(
    (chunk) => chunk.found_by.includes("vector") && !chunk.found_by.includes("keyword"),
  ).length;
  const both = chunks.length - keywordOnly - vectorOnly;

  const items = [
    { label: "仅关键词命中", value: keywordOnly, tone: "var(--color-viz-2)" },
    { label: "仅向量命中", value: vectorOnly, tone: "var(--color-viz-1)" },
    { label: "两者都命中", value: both, tone: "var(--color-viz-5)" },
  ];

  return (
    <div className="space-y-2">
      <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
        证据来源分布
      </p>
      <BarChart data={items} valueFormatter={(value) => `${value} 段`} />
      <p className="text-2xs text-[var(--color-ink-faint)]">
        混合检索命中率{" "}
        {formatPercent(chunks.length ? both / chunks.length : 0)}
        （两个分支同时命中的比例）
      </p>
    </div>
  );
}
