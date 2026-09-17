"use client";

import { Compass, FileStack, Layers, Search, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Markdown } from "@/components/rag/markdown";
import { RetrievalPanel } from "@/components/rag/retrieval-panel";
import { Badge, CodeChip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, DefRow, SectionLabel } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useAsync, useDebounced } from "@/lib/hooks";
import type { DocumentDetail, RetrievalStats, RetrievedChunk } from "@/lib/types";
import { cn, formatCount, formatDateTime, formatPercent, truncate } from "@/lib/utils";

type RightTab = "chunks" | "probe";

/** Three-pane knowledge browser: document list → document detail → chunk/retrieval. */
export default function ExplorerPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const debouncedQuery = useDebounced(query, 250);

  const list = useAsync(
    () => api.listDocuments({ q: debouncedQuery, category, limit: 200 }),
    [debouncedQuery, category],
  );
  const stats = useAsync(() => api.knowledgeStats(), []);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<RightTab>("chunks");
  const [probeQuery, setProbeQuery] = useState("");
  const [probeMode, setProbeMode] = useState("hybrid");
  const [probeRunning, setProbeRunning] = useState(false);
  const [probeChunks, setProbeChunks] = useState<RetrievedChunk[]>([]);
  const [probeStats, setProbeStats] = useState<RetrievalStats | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);

  /* pick up ?doc=... without useSearchParams (keeps the page statically safe) */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("doc");
    if (requested) setSelectedId(requested);
  }, []);

  /* default to the first document once the list arrives */
  useEffect(() => {
    // Narrowing does not propagate into a closure; capture the payload first.
    const listData = list.status === "success" ? list.data : null;
    if (selectedId || !listData || listData.items.length === 0) return;
    setSelectedId(listData.items[0].id);
  }, [selectedId, list]);

  const detail = useAsync<DocumentDetail | null>(
    () => (selectedId ? api.getDocument(selectedId) : Promise.resolve(null)),
    [selectedId],
  );

  // Resolved once here so the JSX below never has to re-narrow.
  const detailData = detail.status === "success" ? detail.data : null;

  const runProbe = useCallback(async () => {
    const text = probeQuery.trim();
    if (!text) return;
    setProbeRunning(true);
    setProbeError(null);
    try {
      const result = await api.retrieve({ q: text, top_k: 8, mode: probeMode });
      setProbeChunks(result.items);
      setProbeStats(result.stats);
    } catch {
      setProbeError("检索探测失败，请确认后端服务状态。");
    } finally {
      setProbeRunning(false);
    }
  }, [probeQuery, probeMode]);

  const categoryOptions = useMemo(() => {
    const statsData = stats.status === "success" ? stats.data : null;
    return statsData ? Object.keys(statsData.category_breakdown).sort() : [];
  }, [stats]);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,19rem)_minmax(0,1fr)_minmax(0,26rem)]">
      {/* ------------------------------------------------- document list */}
      <Card className="flex max-h-[calc(100dvh-7rem)] min-h-0 flex-col">
        <CardHeader
          dense
          title="文档"
          description={list.status === "success" ? `共 ${list.data.total} 个` : "加载中…"}
          icon={<FileStack className="size-4" />}
        />
        <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--color-ink-faint)]" />
              <Input
                value={query}
                placeholder="搜索文档"
                onChange={(event) => setQuery(event.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">全部分类</option>
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>

          {list.status === "loading" ? (
            <SkeletonRows count={6} />
          ) : list.status === "error" ? (
            <ErrorState error={list.error} onRetry={list.reload} compact />
          ) : list.data.items.length === 0 ? (
            <EmptyState title="没有文档" description="调整筛选条件或上传新文档。" />
          ) : (
            <ul className="space-y-1">
              {list.data.items.map((doc) => {
                const active = doc.id === selectedId;
                return (
                  <li key={doc.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(doc.id)}
                      className={cn(
                        "w-full rounded-[var(--radius-md)] border px-2.5 py-2 text-left transition-colors",
                        active
                          ? "border-[var(--color-accent-line)] bg-[var(--color-accent-soft)]"
                          : "border-transparent hover:bg-[var(--color-surface-sunken)]",
                      )}
                    >
                      <span className="flex items-start gap-2">
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block truncate text-xs font-medium",
                              active ? "text-[var(--color-accent-ink)]" : "text-[var(--color-ink)]",
                            )}
                            title={doc.name}
                          >
                            {doc.name}
                          </span>
                          <span className="mt-0.5 block text-2xs text-[var(--color-ink-faint)]">
                            {doc.category_label} · {doc.chunk_count} 块
                          </span>
                        </span>
                        {doc.status === "failed" ? (
                          <Badge tone="danger">失败</Badge>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ----------------------------------------------- document detail */}
      <div className="min-w-0 space-y-4">
        {detail.status === "loading" || !selectedId ? (
          <SkeletonRows count={4} />
        ) : detail.status === "error" ? (
          <ErrorState error={detail.error} onRetry={detail.reload} />
        ) : detailData ? (
          <>
            <Card>
              <CardHeader
                dense
                title={detailData.name}
                description={detailData.extraction_note || detailData.status_label}
                icon={<Compass className="size-4" />}
                actions={
                  <>
                    <Badge tone="neutral">{detailData.type_label}</Badge>
                    <Badge tone="accent">{detailData.category_label}</Badge>
                  </>
                }
              />
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                  <div>
                    <DefRow label="知识块数">{detailData.chunk_count}</DefRow>
                    <DefRow label="字符数">{formatCount(detailData.char_count ?? 0)}</DefRow>
                    <DefRow label="文件大小">{detailData.size_human}</DefRow>
                  </div>
                  <div>
                    <DefRow label="状态">{detailData.status_label}</DefRow>
                    <DefRow label="参与检索">{detailData.searchable ? "是" : "否"}</DefRow>
                    <DefRow label="修改时间">{formatDateTime(detailData.modified_at)}</DefRow>
                  </div>
                </div>

                {detailData.summary ? (
                  <div>
                    <SectionLabel>摘要（规则提取，非模型生成）</SectionLabel>
                    <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-ink-soft)]">
                      {detailData.summary}
                    </p>
                  </div>
                ) : null}

                {detailData.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {detailData.tags.map((tag) => (
                      <Badge key={tag} tone="neutral">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {detailData.outline.length > 0 ? (
              <Card>
                <CardHeader dense title="文档大纲" description={`${detailData.outline.length} 个标题`} icon={<Layers className="size-4" />} />
                <CardContent className="space-y-0.5">
                  {detailData.outline.slice(0, 24).map((heading, index) => (
                    <p key={`${heading}-${index}`} className="truncate text-xs text-[var(--color-ink-soft)]" title={heading}>
                      · {heading}
                    </p>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader
                dense
                title="正文"
                description={detailData.content_truncated ? "内容过长，仅显示前 200,000 字符" : "完整内容"}
              />
              <CardContent>
                <div className="max-h-[32rem] overflow-y-auto">
                  <Markdown content={truncate(detailData.content, 12000) || "（空文档）"} />
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <EmptyState icon={<Compass className="size-5" />} title="选择一个文档" description="从左侧列表选择文档以查看正文、大纲与知识块。" />
        )}
      </div>

      {/* ------------------------------------------ chunk / retrieval pane */}
      <div className="min-w-0">
        <Card className="flex max-h-[calc(100dvh-7rem)] min-h-0 flex-col">
          <Tabs<RightTab>
            value={tab}
            onChange={setTab}
            className="px-3"
            options={[
              { value: "chunks", label: "知识块", count: detailData?.chunks.length },
              { value: "probe", label: "检索探测" },
            ]}
          />

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {tab === "chunks" ? (
              detailData && detailData.chunks.length > 0 ? (
                <div className="space-y-2">
                  {detailData.chunks.map((chunk) => (
                    <div
                      key={chunk.chunk_id}
                      className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex size-5 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--color-surface-sunken)] font-mono text-[10px] text-[var(--color-ink-muted)]">
                          {String(chunk.index).padStart(2, "0")}
                        </span>
                        <CodeChip>{chunk.chunk_id}</CodeChip>
                        {chunk.has_vector ? <Badge tone="info">已向量化</Badge> : null}
                        <span className="ml-auto font-mono text-2xs text-[var(--color-ink-faint)]">
                          {chunk.char_count} 字
                        </span>
                      </div>
                      {chunk.section ? (
                        <p className="mt-1.5 truncate text-2xs text-[var(--color-ink-muted)]" title={chunk.section}>
                          {chunk.section}
                        </p>
                      ) : null}
                      <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-[var(--color-ink-soft)]">
                        {truncate(chunk.content, 360)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Layers className="size-5" />}
                  title="没有知识块"
                  description="该文档未参与检索（可能是解析失败或非文本格式）。"
                />
              )
            ) : (
              <div className="space-y-3">
                <Field label="检索探测" hint="不调用模型，只看检索结果与分数">
                  <Input
                    value={probeQuery}
                    placeholder="输入查询，例如：Rerank 的作用"
                    onChange={(event) => setProbeQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void runProbe();
                    }}
                  />
                </Field>
                <div className="flex items-end gap-2">
                  <Field label="模式" className="flex-1">
                    <Select value={probeMode} onChange={(event) => setProbeMode(event.target.value)}>
                      <option value="hybrid">hybrid</option>
                      <option value="keyword">keyword</option>
                      <option value="vector">vector</option>
                    </Select>
                  </Field>
                  <Button
                    variant="primary"
                    size="md"
                    loading={probeRunning}
                    disabled={!probeQuery.trim()}
                    onClick={() => void runProbe()}
                  >
                    <Sparkles className="size-3.5" />
                    探测
                  </Button>
                </div>

                {probeError ? (
                  <p className="text-xs text-[var(--color-danger)]">{probeError}</p>
                ) : null}

                {probeStats ? (
                  <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2">
                    <DefRow label="检索模式">{probeStats.mode}</DefRow>
                    <DefRow label="候选池">{probeStats.candidate_count}</DefRow>
                    <DefRow label="关键词命中">{probeStats.keyword_hits}</DefRow>
                    <DefRow label="向量命中">{probeStats.vector_hits}</DefRow>
                    <DefRow label="融合策略">{probeStats.fusion_strategy}</DefRow>
                    <DefRow label="重排保留">{probeStats.after_rerank}</DefRow>
                  </div>
                ) : null}

                {probeChunks.length > 0 ? (
                  <>
                    <p className="text-2xs text-[var(--color-ink-muted)]">
                      命中 {probeChunks.length} 段，Top-1 重排分{" "}
                      {formatPercent(probeChunks[0].rerank_score ?? probeChunks[0].fused_score, 1)}
                    </p>
                    <RetrievalPanel chunks={probeChunks} />
                  </>
                ) : probeStats ? (
                  <p className="py-4 text-center text-xs text-[var(--color-ink-faint)]">
                    该查询没有命中任何知识块。
                  </p>
                ) : (
                  <p className="py-4 text-center text-2xs text-[var(--color-ink-faint)]">
                    输入查询后点击「探测」，可查看 BM25 / 向量 / 融合 / 重排的全部分数。
                  </p>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
