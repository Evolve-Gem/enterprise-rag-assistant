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
 *
 * V5: the provenance strip is now a *stage band* — deep ink with a whisper of
 * aurora and an aurora hairline. Every result in the product opens with the
 * same dark band, so "the AI produced this" is recognisable at a glance; the
 * reading surface beneath it stays light, because ink is the frame and paper
 * is the work.
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
        "surface-result overflow-hidden rounded-[var(--radius-large)] border border-[var(--color-line-brand)]",
        "shadow-[var(--elevation-2)]",
        className,
      )}
    >
      {/* provenance strip — the stage band */}
      <header className="relative flex flex-wrap items-center gap-x-3 gap-y-2 overflow-hidden bg-[var(--color-stage)] px-5 py-3">
        <div aria-hidden className="aurora-field aurora-field-subtle" />
        {response.grounded ? (
          <Badge tone="ink-success" className="relative">
            <CheckCircle2 className="size-3" />
            已溯源（{response.citations.length} 条引用）
          </Badge>
        ) : response.fallback_used ? (
          <Badge tone="ink-warning" className="relative">
            <AlertTriangle className="size-3" />
            知识库未命中 · 通用建议
          </Badge>
        ) : (
          <Badge tone="ink-warning" className="relative">
            <AlertTriangle className="size-3" />
            弱溯源
          </Badge>
        )}

        <span className="relative flex items-center gap-1.5 text-2xs text-[var(--color-stage-ink-muted)]">
          <Gauge className="size-3" />
          {formatMs(response.latency_ms)}
        </span>
        <span className="relative text-2xs text-[var(--color-stage-ink-faint)]">·</span>
        <span className="relative text-2xs text-[var(--color-stage-ink-muted)]">
          {response.model || "—"}
        </span>
        {response.usage.total_tokens > 0 ? (
          <>
            <span className="relative text-2xs text-[var(--color-stage-ink-faint)]">·</span>
            <span className="relative text-2xs text-[var(--color-stage-ink-muted)]">
              {response.usage.total_tokens} tokens
            </span>
          </>
        ) : null}
        {response.prompt_version ? (
          <Badge tone="ink" className="relative">
            prompt {response.prompt_version}
          </Badge>
        ) : null}

        <div className="relative ml-auto flex items-center gap-1.5">
          <Button size="sm" variant="frame" onClick={() => copy(response.answer)}>
            <Copy className="size-3.5" />
            {copied ? "已复制" : "复制"}
          </Button>
        </div>

        {/* the aurora hairline — the product's signature on every result */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-80"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgb(124 93 250 / 0.55) 18%, rgb(34 211 238 / 0.35) 62%, transparent 100%)",
          }}
        />
      </header>

      {/* answer body — paper */}
      <div className="px-5 py-4">
        <Markdown content={response.answer} onCitation={onCitation} />
      </div>

      {/* source chips */}
      {response.sources.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--color-line-faint)] px-5 py-3">
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
              className="lift flex items-center gap-1.5 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 py-1 text-2xs text-[var(--color-ink-soft)] hover:border-[var(--color-accent-line)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent-ink)]"
            >
              <Link2 className="size-3" />
              <span className="max-w-[14rem] truncate">{source.document_name}</span>
              <span className="font-mono opacity-60">×{source.chunk_count}</span>
            </button>
          ))}
        </div>
      ) : null}

      {/* details */}
      <div className="border-t border-[var(--color-line-faint)]">
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
                    className="lift flex w-full gap-3 rounded-[var(--radius-medium)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 py-3 text-left hover:border-[var(--color-accent-line)]"
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

/**
 * Placeholder shown before the first question is asked.
 *
 * V5: this became the Ask page's stage moment. When the page is idle the ink
 * panel carries the "how this works" promise and the example prompts (now
 * clickable — they prefill the composer, like the home page examples). Once a
 * result arrives the placeholder yields to the AnswerCard, so the page always
 * has exactly one dark object on it — the same discipline as every other page.
 */
export function AnswerPlaceholder({
  hints,
  onHint,
}: {
  hints: string[];
  onHint?: (hint: string) => void;
}) {
  return (
    <div className="stage-panel relative px-6 py-7 text-center">
      <div aria-hidden className="aurora-field aurora-field-subtle opacity-60" />
      <div className="relative flex flex-col items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-[var(--color-stage-accent-soft)] text-[var(--color-stage-accent)]">
          <Wand2 className="size-4" />
        </span>
        <div className="space-y-1">
          <p className="text-[14px] font-medium text-[var(--color-stage-ink)]">开始提问</p>
          <p className="mx-auto max-w-md text-xs leading-relaxed text-[var(--color-stage-ink-muted)]">
            回答会标注引用编号，点击编号可查看被引用的原文片段与检索分数。
          </p>
        </div>
        {hints.length > 0 ? (
          <div className="mt-0.5 flex flex-wrap items-center justify-center gap-1.5">
            {hints.map((hint) => (
              <button
                key={hint}
                type="button"
                onClick={() => onHint?.(hint)}
                className="rounded-full border border-[var(--color-stage-line-strong)] bg-[rgb(255_255_255/0.06)] px-2.5 py-1 text-2xs text-[var(--color-stage-ink-soft)] transition-colors duration-[var(--motion-fast)] hover:bg-[rgb(255_255_255/0.12)] hover:text-[var(--color-stage-ink)]"
              >
                {hint}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
