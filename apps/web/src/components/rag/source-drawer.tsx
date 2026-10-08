"use client";

import { Copy, FileText, Layers, Quote } from "lucide-react";

import { Badge, CodeChip } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
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
/**
 * Chunk ids look like `召回-top-k-rerank-与-rag-检索链路-4aab52335f::c007`.
 * The document slug is already shown as the drawer subtitle, so repeating it in
 * full keeps the longest string on the screen for no information. The tail is
 * what identifies the chunk; the whole id stays in the tooltip.
 */
function shortChunkId(id: string): string {
  const separator = id.lastIndexOf("::");
  if (separator < 0) return id.length > 16 ? `…${id.slice(-14)}` : id;
  const doc = id.slice(0, separator);
  const chunk = id.slice(separator + 2);
  return `${doc.length > 10 ? `…${doc.slice(-8)}` : doc}::${chunk}`;
}

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
            <span title={active.chunk_id} className="min-w-0">
              <CodeChip>{shortChunkId(active.chunk_id)}</CodeChip>
            </span>
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
                  "lift flex items-center gap-1.5 rounded-[var(--radius-small)] border px-2 py-1 text-2xs",
                  item.index === active?.index
                    ? "border-[var(--color-accent-line)] bg-[var(--color-accent-soft)] text-[var(--color-accent-ink)]"
                    : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:border-[var(--color-line-strong)] hover:text-[var(--color-ink)]",
                )}
              >
                <span className="font-mono font-semibold">[{item.index}]</span>
                <span className="max-w-[9rem] truncate">{item.document_name}</span>
              </button>
            ))}
          </div>

          {active ? (
            <>
              {/* 1. document → section */}
              <section className="surface-subtle rounded-[var(--radius-large)] border border-[var(--color-line-faint)] px-4 py-3">
                <p className="flex items-start gap-2 text-sm font-medium leading-snug text-[var(--color-ink)]">
                  <FileText className="mt-0.5 size-3.5 shrink-0 text-[var(--color-ink-faint)]" />
                  <span className="min-w-0">{active.document_name}</span>
                </p>
                {active.section ? (
                  <p className="mt-1 pl-[1.375rem] text-xs leading-relaxed text-[var(--color-ink-muted)]">
                    {active.section}
                  </p>
                ) : null}
              </section>

              {/* 2. snippet — the evidence itself, read first */}
              <section className="space-y-2">
                <p className="flex items-center gap-1.5 text-2xs font-semibold tracking-[0.04em] text-[var(--color-ink-muted)]">
                  <Quote className="size-3" />
                  被引用的原文片段
                </p>
                <pre className="max-h-[26rem] overflow-auto whitespace-pre-wrap rounded-[var(--radius-large)] border border-[var(--color-line-faint)] border-l-2 border-l-[var(--color-line-brand)] bg-[var(--color-surface-inset)] p-4 font-sans text-[13px] leading-relaxed text-[var(--color-ink-soft)]">
                  {chunk?.content ?? active.snippet}
                </pre>
                {chunk ? (
                  <p className="text-2xs text-[var(--color-ink-faint)]">
                    共 {chunk.char_count} 字符 · 相关度 {formatPercent(active.score, 1)}
                  </p>
                ) : null}
              </section>

              {/* 3. retrieval metadata — deliberately last and quiet */}
              <section className="surface-subtle rounded-[var(--radius-large)] border border-[var(--color-line-faint)] px-4 py-3">
                <p className="mb-1.5 flex items-center gap-1.5 text-2xs font-medium tracking-[0.04em] text-[var(--color-ink-muted)]">
                  <Layers className="size-3" />
                  检索与排序元数据
                </p>
                <div className="grid grid-cols-2 gap-x-6">
                  <div>
                    <MetaRow label="最终排序分">{active.score.toFixed(4)}</MetaRow>
                    {chunk ? (
                      <>
                        <MetaRow label="BM25 关键词分">{chunk.keyword_score.toFixed(3)}</MetaRow>
                        <MetaRow label="向量相似度">{chunk.vector_score.toFixed(4)}</MetaRow>
                        <MetaRow label="融合分 (RRF)">{chunk.fused_score.toFixed(4)}</MetaRow>
                        <MetaRow label="重排分">
                          {chunk.rerank_score !== null ? chunk.rerank_score.toFixed(4) : "—"}
                        </MetaRow>
                      </>
                    ) : null}
                  </div>
                  <div>
                    {chunk ? (
                      <>
                        <MetaRow label="关键词排名">{chunk.rank_keyword ?? "—"}</MetaRow>
                        <MetaRow label="向量排名">{chunk.rank_vector ?? "—"}</MetaRow>
                        <MetaRow label="融合后排名">{chunk.rank_fused ?? "—"}</MetaRow>
                        <MetaRow label="重排后排名">{chunk.rank_final ?? "—"}</MetaRow>
                        <MetaRow label="命中词数">{chunk.matched_terms.length}</MetaRow>
                      </>
                    ) : (
                      <MetaRow label="元数据">未匹配到检索记录</MetaRow>
                    )}
                  </div>
                </div>

                {chunk ? (
                  <div className="mt-2 border-t border-[var(--color-line-faint)] pt-1">
                    <MetaRow label="知识块 id">
                      <span title={active.chunk_id}>{shortChunkId(active.chunk_id)}</span>
                    </MetaRow>
                    <MetaRow label="文档内序号">#{chunk.index}</MetaRow>
                    <MetaRow label="字符数">{chunk.char_count}</MetaRow>
                    <MetaRow label="命中分支">
                      <span className="flex justify-end gap-1">
                        {chunk.found_by.map((branch) => (
                          <Badge key={branch} tone={branch === "vector" ? "info" : "accent"}>
                            {branch === "vector" ? "向量" : "关键词"}
                          </Badge>
                        ))}
                      </span>
                    </MetaRow>
                  </div>
                ) : null}

                {chunk && chunk.matched_terms.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
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
            </>
          ) : null}
        </div>
      )}
    </Drawer>
  );
}

/**
 * Retrieval internals sit *below* the evidence, so their rows are quieter than
 * the document/section header: smaller size, muted ink, no emphasis.
 */
function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--color-line-faint)] py-1 last:border-0">
      <span className="shrink-0 text-2xs text-[var(--color-ink-muted)]">{label}</span>
      <span className="min-w-0 truncate text-right font-mono text-2xs text-[var(--color-ink-muted)]">
        {children}
      </span>
    </div>
  );
}
