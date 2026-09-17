"use client";

import { AlertTriangle, CheckCircle2, Copy, FileText, Gauge, Link2, Wand2 } from "lucide-react";
import { useState } from "react";

import { TraceTimeline } from "@/components/agent/trace-timeline";
import { Markdown } from "@/components/rag/markdown";
import { BranchBreakdown, RetrievalPanel, RetrievalFunnel, RerankComparison } from "@/components/rag/retrieval-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { useCopyToClipboard } from "@/lib/hooks";
import type { RagQueryResponse } from "@/lib/types";
import { cn, formatMs, formatPercent } from "@/lib/utils";

type DetailTab = "evidence" | "trace" | "sources";

/**
 * The answer surface, shared by Ask and the Agent workspace.
 *
 * Structure: answer body (citation-aware) → provenance strip → tabbed detail.
 * Nothing is hidden behind a "debug" flag: the retrieval evidence, the per-node
 * trace and the source list are all one click away, because that is the whole
 * point of a grounded assistant.
 */
export function AnswerCard({
  response,
  onCitation,
  className,
}: {
  response: RagQueryResponse;
  onCitation?: (index: number) => void;
  className?: string;
}) {
  const [tab, setTab] = useState<DetailTab>("evidence");
  const { copied, copy } = useCopyToClipboard();

  const stats = response.stats;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)]",
        className,
      )}
    >
      {/* provenance strip */}
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--color-line)] px-5 py-3">
        {response.grounded ? (
          <Badge tone="success">
            <CheckCircle2 className="size-3" />
            已溯源（{response.citations.length} 条引用）
          </Badge>
        ) : response.fallback_used ? (
          <Badge tone="warning">
            <AlertTriangle className="size-3" />
            知识库未命中 · 通用建议
          </Badge>
        ) : (
          <Badge tone="warning">
            <AlertTriangle className="size-3" />
            弱溯源
          </Badge>
        )}

        <span className="flex items-center gap-1.5 text-2xs text-[var(--color-ink-muted)]">
          <Gauge className="size-3" />
          {formatMs(response.latency_ms)}
        </span>
        <span className="text-2xs text-[var(--color-ink-faint)]">·</span>
        <span className="text-2xs text-[var(--color-ink-muted)]">{response.model || "—"}</span>
        {response.usage.total_tokens > 0 ? (
          <>
            <span className="text-2xs text-[var(--color-ink-faint)]">·</span>
            <span className="text-2xs text-[var(--color-ink-muted)]">
              {response.usage.total_tokens} tokens
            </span>
          </>
        ) : null}
        {response.prompt_version ? (
          <Badge tone="neutral">prompt {response.prompt_version}</Badge>
        ) : null}

        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => copy(response.answer)}>
            <Copy className="size-3.5" />
            {copied ? "已复制" : "复制"}
          </Button>
        </div>
      </header>

      {/* answer body */}
      <div className="px-5 py-4">
        <Markdown content={response.answer} onCitation={onCitation} />
      </div>

      {/* source chips */}
      {response.sources.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--color-line)] px-5 py-3">
          <span className="flex items-center gap-1.5 text-2xs font-medium text-[var(--color-ink-faint)]">
            <FileText className="size-3" />
            来源
          </span>
          {response.sources.map((source) => (
            <button
              key={source.document_id}
              type="button"
              onClick={() => onCitation?.(source.citation_indexes[0])}
              title={`${source.chunk_count} 处引用 · 最高分 ${source.best_score.toFixed(3)}`}
              className="flex items-center gap-1.5 rounded-full border border-[var(--color-line)] px-2.5 py-1 text-2xs text-[var(--color-ink-soft)] transition-colors hover:border-[var(--color-accent-line)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent-ink)]"
            >
              <Link2 className="size-3" />
              <span className="max-w-[14rem] truncate">{source.document_name}</span>
              <span className="font-mono opacity-60">×{source.chunk_count}</span>
            </button>
          ))}
        </div>
      ) : null}

      {/* details */}
      <div className="border-t border-[var(--color-line)]">
        <Tabs<DetailTab>
          value={tab}
          onChange={setTab}
          size="sm"
          className="px-3"
          options={[
            { value: "evidence", label: "检索证据", count: response.retrieved_chunks.length },
            { value: "trace", label: "执行轨迹", count: response.trace.length },
            { value: "sources", label: "引用详情", count: response.citations.length },
          ]}
        />

        <div className="px-5 py-4">
          {tab === "evidence" ? (
            <div className="space-y-4">
              <RetrievalFunnel stats={stats} />
              <RetrievalPanel chunks={response.retrieved_chunks} />
              <div className="grid grid-cols-1 gap-5 border-t border-[var(--color-line)] pt-4 lg:grid-cols-2">
                <RerankComparison chunks={response.retrieved_chunks} />
                <BranchBreakdown chunks={response.retrieved_chunks} />
              </div>
            </div>
          ) : null}

          {tab === "trace" ? <TraceTimeline steps={response.trace} /> : null}

          {tab === "sources" ? (
            <div className="space-y-2">
              {response.citations.length === 0 ? (
                <p className="py-6 text-center text-xs text-[var(--color-ink-faint)]">
                  本次回答没有产生引用。
                </p>
              ) : (
                response.citations.map((citation) => (
                  <button
                    key={citation.chunk_id}
                    type="button"
                    onClick={() => onCitation?.(citation.index)}
                    className="flex w-full gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3.5 py-3 text-left transition-colors hover:border-[var(--color-accent-line)] hover:bg-[var(--color-accent-soft)]/40"
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--color-accent-soft)] font-mono text-[10px] font-semibold text-[var(--color-accent-ink)]">
                      {citation.index}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-xs font-medium text-[var(--color-ink)]">
                          {citation.document_name}
                        </span>
                        <span className="shrink-0 font-mono text-2xs text-[var(--color-ink-faint)]">
                          {formatPercent(citation.score, 1)}
                        </span>
                      </span>
                      {citation.section ? (
                        <span className="mt-0.5 block truncate text-2xs text-[var(--color-ink-muted)]">
                          {citation.section}
                        </span>
                      ) : null}
                      <span className="mt-1 block text-xs leading-relaxed text-[var(--color-ink-soft)]">
                        {citation.snippet}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** Placeholder shown before the first question is asked. */
export function AnswerPlaceholder({ hints }: { hints: string[] }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface)] px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
        <Wand2 className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium text-[var(--color-ink)]">开始提问</p>
        <p className="text-xs text-[var(--color-ink-muted)]">
          回答会标注引用编号，点击编号可查看被引用的原文片段与检索分数。
        </p>
      </div>
      {hints.length > 0 ? (
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          {hints.map((hint) => (
            <span
              key={hint}
              className="rounded-full border border-[var(--color-line)] px-3 py-1 text-2xs text-[var(--color-ink-muted)]"
            >
              {hint}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
