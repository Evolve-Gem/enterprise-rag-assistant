"use client";

import { Copy, ExternalLink, FileText, Layers } from "lucide-react";

import { Badge, CodeChip } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import { DefRow } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/lib/hooks";
import type { Citation, RetrievedChunk } from "@/lib/types";
import { cn, formatPercent } from "@/lib/utils";

/**
 * Citation detail drawer.
 *
 * Shows *the exact retrieved chunk* a `[n]` marker refers to, together with
 * every retrieval score that produced its rank. Exposing the intermediate
 * scores is what turns "trust me, the model read this" into something a
 * reviewer can audit.
 */
export function SourceDrawer({
  open,
  onClose,
  citations,
  chunks,
  activeIndex,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  citations: Citation[];
  chunks: RetrievedChunk[];
  activeIndex: number | null;
  onSelect: (index: number) => void;
}) {
  const { copied, copy } = useCopyToClipboard();
  const active = citations.find((item) => item.index === activeIndex) ?? citations[0] ?? null;
  const chunk =
    chunks.find((item) => item.chunk_id === active?.chunk_id) ??
    chunks.find((item) => item.document_id === active?.document_id) ??
    null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width="lg"
      title={
        active ? (
          <span className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--color-accent-soft)] font-mono text-[10px] font-semibold text-[var(--color-accent-ink)]">
              {active.index}
            </span>
            引用来源
          </span>
        ) : (
          "引用来源"
        )
      }
      subtitle={active ? `${active.document_name}${active.section ? ` · ${active.section}` : ""}` : undefined}
      footer={
        active ? (
          <div className="flex items-center justify-between gap-3">
            <CodeChip>{active.chunk_id}</CodeChip>
            <Button size="sm" variant="outline" onClick={() => copy(active.snippet)}>
              <Copy className="size-3.5" />
              {copied ? "已复制" : "复制片段"}
            </Button>
          </div>
        ) : (
          <span className="text-xs text-[var(--color-ink-muted)]">无引用</span>
        )
      }
    >
      {citations.length === 0 ? (
        <p className="py-8 text-center text-xs text-[var(--color-ink-muted)]">
          本次回答没有引用任何知识库片段。
        </p>
      ) : (
        <div className="space-y-4">
          {/* citation switcher */}
          <div className="flex flex-wrap gap-1.5">
            {citations.map((item) => (
              <button
                key={item.chunk_id + item.index}
                type="button"
                onClick={() => onSelect(item.index)}
                title={item.document_name}
                className={cn(
                  "flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-2 py-1 text-2xs transition-colors",
                  item.index === active?.index
                    ? "border-[var(--color-accent-line)] bg-[var(--color-accent-soft)] text-[var(--color-accent-ink)]"
                    : "border-[var(--color-line)] text-[var(--color-ink-muted)] hover:border-[var(--color-line-strong)] hover:text-[var(--color-ink)]",
                )}
              >
                <span className="font-mono font-semibold">[{item.index}]</span>
                <span className="max-w-[9rem] truncate">{item.document_name}</span>
              </button>
            ))}
          </div>

          {active ? (
            <>
              {/* metadata */}
              <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-sunken)] px-4 py-1">
                <DefRow label="来源文档">
                  <span className="inline-flex items-center gap-1.5">
                    <FileText className="size-3 text-[var(--color-ink-faint)]" />
                    {active.document_name}
                  </span>
                </DefRow>
                {active.section ? <DefRow label="所属章节">{active.section}</DefRow> : null}
                <DefRow label="知识块 id" mono>
                  {active.chunk_id}
                </DefRow>
                {chunk ? (
                  <>
                    <DefRow label="文档内序号">#{chunk.index}</DefRow>
                    <DefRow label="字符数">{chunk.char_count}</DefRow>
                    <DefRow label="命中分支">
                      <span className="flex justify-end gap-1">
                        {chunk.found_by.map((branch) => (
                          <Badge key={branch} tone={branch === "vector" ? "info" : "accent"}>
                            {branch === "vector" ? "向量" : "关键词"}
                          </Badge>
                        ))}
                      </span>
                    </DefRow>
                  </>
                ) : null}
              </section>

              {/* scores */}
              <section className="rounded-[var(--radius-lg)] border border-[var(--color-line)] px-4 py-3">
                <p className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
                  <Layers className="size-3" />
                  检索与排序元数据
                </p>
                <div className="grid grid-cols-2 gap-x-6">
                  <div>
                    <DefRow label="最终排序分" mono>
                      {active.score.toFixed(4)}
                    </DefRow>
                    {chunk ? (
                      <>
                        <DefRow label="BM25 关键词分" mono>
                          {chunk.keyword_score.toFixed(3)}
                        </DefRow>
                        <DefRow label="向量相似度" mono>
                          {chunk.vector_score.toFixed(4)}
                        </DefRow>
                        <DefRow label="融合分 (RRF)" mono>
                          {chunk.fused_score.toFixed(4)}
                        </DefRow>
                        <DefRow label="重排分" mono>
                          {chunk.rerank_score !== null ? chunk.rerank_score.toFixed(4) : "—"}
                        </DefRow>
                      </>
                    ) : null}
                  </div>
                  <div>
                    {chunk ? (
                      <>
                        <DefRow label="关键词排名" mono>
                          {chunk.rank_keyword ?? "—"}
                        </DefRow>
                        <DefRow label="向量排名" mono>
                          {chunk.rank_vector ?? "—"}
                        </DefRow>
                        <DefRow label="融合后排名" mono>
                          {chunk.rank_fused ?? "—"}
                        </DefRow>
                        <DefRow label="重排后排名" mono>
                          {chunk.rank_final ?? "—"}
                        </DefRow>
                        <DefRow label="命中词数" mono>
                          {chunk.matched_terms.length}
                        </DefRow>
                      </>
                    ) : (
                      <DefRow label="元数据" mono>
                        未匹配到检索记录
                      </DefRow>
                    )}
                  </div>
                </div>
                {chunk && chunk.matched_terms.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {chunk.matched_terms.slice(0, 18).map((term) => (
                      <span
                        key={term}
                        className="rounded-[var(--radius-xs)] bg-[var(--color-accent-soft)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-accent-ink)]"
                      >
                        {term}
                      </span>
                    ))}
                  </div>
                ) : null}
              </section>

              {/* content */}
              <section className="space-y-2">
                <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
                  <ExternalLink className="size-3" />
                  被引用的原文片段
                </p>
                <pre className="max-h-[26rem] overflow-auto whitespace-pre-wrap rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-sunken)] p-4 font-sans text-[13px] leading-relaxed text-[var(--color-ink-soft)]">
                  {chunk?.content ?? active.snippet}
                </pre>
                {chunk ? (
                  <p className="text-2xs text-[var(--color-ink-faint)]">
                    共 {chunk.char_count} 字符 · 相关度 {formatPercent(active.score, 1)}
                  </p>
                ) : null}
              </section>
            </>
          ) : null}
        </div>
      )}
    </Drawer>
  );
}
