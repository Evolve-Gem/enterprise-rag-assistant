"use client";

import { ArrowRight, FileText, Layers } from "lucide-react";

import { Badge, StatusDot } from "@/components/ui/badge";
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

/** One compact score meter: label, thin bar, faint numeric value. */
function ScoreMeter({
  label,
  value,
  max,
  tone,
  emphasis = false,
}: {
  label: string;
  value: number;
  max: number;
  tone: string;
  emphasis?: boolean;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <span className="inline-flex items-center gap-1.5" title={`${label} ${value.toFixed(3)}`}>
      <span
        className={cn(
          "text-2xs",
          emphasis ? "text-[var(--color-ink-muted)]" : "text-[var(--color-ink-faint)]",
        )}
      >
        {label}
      </span>
      <span className="h-1 w-10 overflow-hidden rounded-full bg-[var(--color-surface-sunken)]">
        <span
          className="block h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: tone }}
        />
      </span>
      <span
        className={cn(
          "font-mono text-[10px] tabular-nums",
          emphasis ? "text-[var(--color-ink-soft)]" : "text-[var(--color-ink-faint)]",
        )}
      >
        {value.toFixed(3)}
      </span>
    </span>
  );
}

/** Per-branch scores for one candidate: keyword / vector / fused / rerank. */
function ScoreMeters({ chunk }: { chunk: RetrievedChunk }) {
  const rows = [
    { label: "关键词", value: chunk.keyword_score, max: Math.max(chunk.keyword_score, 1), tone: "var(--color-viz-2)" },
    { label: "向量", value: chunk.vector_score, max: 1, tone: "var(--color-viz-1)" },
    { label: "融合", value: chunk.fused_score, max: 1, tone: "var(--color-viz-3)" },
  ];
  if (chunk.rerank_score !== null) {
    rows.push({ label: "重排", value: chunk.rerank_score, max: 1, tone: "var(--color-viz-4)" });
  }
  const finalLabel = chunk.rerank_score !== null ? "重排" : "融合";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {rows.map((row) => (
        <ScoreMeter
          key={row.label}
          label={row.label}
          value={row.value}
          max={row.max}
          tone={row.tone}
          emphasis={row.label === finalLabel}
        />
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
        {chunks.map((chunk, index) => {
          const score = chunk.rerank_score ?? chunk.fused_score;
          return (
            <li key={chunk.chunk_id}>
              <button
                type="button"
                onClick={() => onSelect?.(chunk)}
                className="flex w-full items-center gap-3 rounded-[var(--radius-medium)] border border-[var(--color-line-faint)] px-3 py-2 text-left transition-colors duration-[var(--motion-fast)] ease-[var(--ease-standard)] hover:border-[var(--color-accent-line)] hover:bg-[var(--color-surface-subtle)]"
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-[var(--radius-xs)] surface-inset font-mono text-[10px] text-[var(--color-ink-muted)]">
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
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="h-1 w-8 overflow-hidden rounded-full bg-[var(--color-surface-sunken)]">
                    <span
                      className="block h-full rounded-full bg-[var(--color-accent)]"
                      style={{ width: `${Math.min(score * 100, 100)}%` }}
                    />
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-[var(--color-ink-faint)]">
                    {score.toFixed(3)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
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
          className="w-full rounded-[var(--radius-large)] surface-base border border-[var(--color-line-faint)] px-4 py-3 text-left transition-colors duration-[var(--motion-fast)] ease-[var(--ease-standard)] hover:border-[var(--color-accent-line)]"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-[var(--radius-small)] surface-inset font-mono text-[11px] font-semibold text-[var(--color-ink-muted)]">
              {index + 1}
            </span>

            <div className="min-w-0 flex-1 space-y-1.5">
              {/* 1. document name */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-medium text-[var(--color-ink)]">
                  {chunk.document_name}
                </span>
                {chunk.found_by.map((branch) => (
                  <Badge key={branch} tone={branch === "vector" ? "info" : "accent"}>
                    <StatusDot tone={branch === "vector" ? "info" : "accent"} />
                    {branch === "vector" ? "向量命中" : "关键词命中"}
                  </Badge>
                ))}
              </div>

              {/* 2. section */}
              {chunk.section ? (
                <p className="flex items-center gap-1.5 text-2xs text-[var(--color-ink-muted)]">
                  <FileText className="size-3 shrink-0 text-[var(--color-ink-faint)]" />
                  <span className="truncate" title={chunk.section}>
                    {chunk.section}
                  </span>
                </p>
              ) : null}

              {/* 3. fragment */}
              <p className="text-xs leading-relaxed text-[var(--color-ink-soft)]">
                {truncate(chunk.preview || chunk.content, 220)}
              </p>

              {/* 4. scores + technical metadata, kept below the text */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[var(--color-line-faint)] pt-2">
                <ScoreMeters chunk={chunk} />
                <span className="ml-auto flex shrink-0 items-center gap-2 font-mono text-[10px] tabular-nums text-[var(--color-ink-faint)]">
                  <span>#{chunk.index}</span>
                  <span>{chunk.char_count} 字符</span>
                </span>
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

/**
 * Rank-shift list: fused order vs. after-rerank order.
 *
 * Was a `BarChart` of `max(rank_fused, rank_final)`. Because the bar scale is
 * normalised to the largest value in the set, and every chunk's max rank is the
 * same "last" rank, **every bar rendered at 100%** — a chart that carried no
 * information at all. This plots the two ranks as a pair instead, and only the
 * chunks whose position actually moved get emphasis.
 */
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

  const pairs = rows.map((chunk, index) => {
    const before = chunk.rank_fused ?? index + 1;
    const after = chunk.rank_final ?? before;
    return { chunk, before, after, shifted: before !== after };
  });
  const moved = pairs.filter((pair) => pair.shifted).length;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
        融合顺序 → 重排顺序
      </p>
      <ul className="space-y-1">
        {pairs.map(({ chunk, before, after, shifted }, index) => (
          <li key={chunk.chunk_id} className="flex items-center gap-2.5 text-2xs">
            <span className="w-3 shrink-0 text-right font-mono tabular-nums text-[var(--color-ink-faint)]">
              {index + 1}
            </span>
            <span
              className="min-w-0 flex-1 truncate text-[var(--color-ink-soft)]"
              title={chunk.document_name}
            >
              {chunk.document_name}
            </span>
            <span className="shrink-0 font-mono tabular-nums text-[var(--color-ink-faint)]">
              #{before}
            </span>
            <span
              aria-hidden
              className={cn(
                "shrink-0",
                shifted ? "text-[var(--color-accent)]" : "text-[var(--color-ink-faint)]",
              )}
            >
              →
            </span>
            <span
              className={cn(
                "w-7 shrink-0 text-right font-mono tabular-nums",
                shifted
                  ? "font-semibold text-[var(--color-accent-ink)]"
                  : "text-[var(--color-ink-faint)]",
              )}
            >
              #{after}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-2xs text-[var(--color-ink-faint)]">
        {moved > 0
          ? `重排改变了其中 ${moved} 段的位次，其余保持原有顺序。`
          : "本次重排没有改变任何片段的位次，顺序与融合结果一致。"}
      </p>
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
