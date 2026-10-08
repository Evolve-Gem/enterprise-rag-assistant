"use client";

import {
  AlertTriangle,
  Clock,
  Database,
  ExternalLink,
  FileStack,
  FileText,
  Layers,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";

import { Markdown } from "@/components/rag/markdown";
import { Badge, CodeChip, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, DefRow, SectionLabel } from "@/components/ui/card";
import { CompactMetric, TD, TH, TR, Table } from "@/components/ui/data";
import { Drawer } from "@/components/ui/drawer";
import { Field, Input, Select } from "@/components/ui/field";
import {
  MainTaskBody,
  MainTaskHeader,
  MainTaskPanel,
  ResultSection,
  SectionAccordion,
} from "@/components/ui/section";
import {
  EmptyState,
  ErrorState,
  InlineError,
  InlineInfo,
  Skeleton,
  SkeletonRows,
} from "@/components/ui/states";
import { useToast } from "@/components/providers/toast-provider";
import { api, ApiError } from "@/lib/api";
import { useAsync, useDebounced } from "@/lib/hooks";
import type {
  DocumentDetail,
  DocumentStatus,
  KnowledgeStats,
  SettingsResponse,
} from "@/lib/types";
import { cn, formatCount, formatDateTime, formatRelative, truncate } from "@/lib/utils";

const STATUS_TONE: Record<DocumentStatus, "success" | "warning" | "danger" | "neutral"> = {
  indexed: "success",
  uploaded: "neutral",
  parsing: "warning",
  failed: "danger",
  unsupported: "neutral",
};

/** Plain-language label + tone for the backend index state, used in the metric strip. */
const INDEX_META: Record<
  KnowledgeStats["index_state"],
  { label: string; tone: "success" | "warning" | "accent" | "neutral" }
> = {
  ready: { label: "就绪", tone: "success" },
  stale: { label: "待更新", tone: "warning" },
  building: { label: "构建中", tone: "accent" },
  empty: { label: "为空", tone: "neutral" },
};

/**
 * Metric strip layout.
 *
 * The four figures read as one status bar rather than four separate cards, so
 * the cells share a single subtle surface and are separated by hairline rules
 * instead of a border on each tile. Mobile is a 2×2 grid (rule under the first
 * row), desktop a single row (rule between the columns).
 */
const METRIC_CELL = [
  "min-w-0 px-3.5 py-2.5",
  "min-w-0 border-l border-[var(--color-line-faint)] px-3.5 py-2.5",
  "min-w-0 border-t border-[var(--color-line-faint)] px-3.5 py-2.5 sm:border-t-0 sm:border-l",
  "min-w-0 border-l border-t border-[var(--color-line-faint)] px-3.5 py-2.5 sm:border-t-0",
];

/** Strip the per-tile card chrome so CompactMetric blends into the strip. */
const METRIC_INNER = "rounded-none border-0 bg-transparent p-0 shadow-none";

/** Stable id pairing the upload label with its visually hidden file input. */
const UPLOAD_INPUT_ID = "knowledge-upload-input";

export default function DocumentsPage() {
  const { toast } = useToast();
  const settings = useAsync<SettingsResponse>(() => api.settings(), []);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("name");
  const debouncedQuery = useDebounced(query, 300);

  const documents = useAsync(
    () =>
      api.listDocuments({
        q: debouncedQuery,
        category,
        status,
        sort,
        limit: 200,
      }),
    [debouncedQuery, category, status, sort],
  );
  const stats = useAsync<KnowledgeStats>(() => api.knowledgeStats(), []);

  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [reindexing, setReindexing] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Document detail lives in a drawer keyed by id, so the list stays a fixed
  // height instead of growing a detail block at the bottom of the page.
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = useAsync<DocumentDetail | null>(
    () => (detailId ? api.getDocument(detailId) : Promise.resolve(null)),
    [detailId],
    { keepPreviousData: false },
  );
  const detailData = detail.status === "success" ? detail.data : null;

  const readOnly =
    settings.status === "success" ? settings.data.guard_rails.read_only : false;
  const maxBytes = settings.status === "success" ? settings.data.uploads.max_bytes : 8 * 1024 * 1024;

  const reloadAll = useCallback(() => {
    void documents.reload();
    void stats.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents.reload, stats.reload]);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploadError(null);

      for (const file of Array.from(files)) {
        if (file.size > maxBytes) {
          const message = `${file.name} 超过 ${(maxBytes / 1024 / 1024).toFixed(0)} MB 上限，已跳过。`;
          setUploadError(message);
          toast({ title: "文件过大", description: message, variant: "error" });
          continue;
        }
        setUploading(file.name);
        try {
          const result = await api.uploadDocument(file);
          toast({
            title: `已上传 ${result.document.name}`,
            description: `切分为 ${result.chunks_created} 个知识块，状态：${result.document.status_label}`,
            variant: result.warnings.length ? "warning" : "success",
          });
          if (result.warnings.length) setUploadError(result.warnings.join("；"));
        } catch (caught) {
          const message =
            caught instanceof ApiError ? caught.message : `${file.name} 上传失败。`;
          setUploadError(message);
          toast({ title: "上传失败", description: message, variant: "error" });
        } finally {
          setUploading(null);
        }
      }
      reloadAll();
    },
    [maxBytes, toast, reloadAll],
  );

  const reindex = useCallback(async () => {
    setReindexing(true);
    try {
      const result = await api.reindex(false);
      toast({
        title: "索引已重建",
        description: `${result.document_count} 文档 / ${result.chunk_count} 知识块 / ${result.vectorized_chunk_count} 向量（${Math.round(result.duration_ms)} ms）`,
        variant: "success",
      });
      reloadAll();
    } catch (caught) {
      toast({
        title: "重建失败",
        description: caught instanceof ApiError ? caught.message : "请重试。",
        variant: "error",
      });
    } finally {
      setReindexing(false);
    }
  }, [toast, reloadAll]);

  const remove = useCallback(
    async (id: string, name: string) => {
      if (!window.confirm(`确认删除《${name}》？该操作会同时移除其全部知识块，且不可撤销。`)) {
        return;
      }
      setDeleting(id);
      try {
        const result = await api.deleteDocument(id);
        toast({ title: "已删除", description: result.message, variant: "success" });
        reloadAll();
      } catch (caught) {
        toast({
          title: "删除失败",
          description: caught instanceof ApiError ? caught.message : "请重试。",
          variant: "error",
        });
      } finally {
        setDeleting(null);
      }
    },
    [toast, reloadAll],
  );

  const categoryOptions = useMemo(() => {
    // Narrowing does not propagate into a closure; capture the payload first.
    const statsData = stats.status === "success" ? stats.data : null;
    if (!statsData) return [];
    return Object.keys(statsData.category_breakdown).sort();
  }, [stats]);

  const indexState = stats.status === "success" ? stats.data.index_state : null;

  return (
    <div className="space-y-5">
      {readOnly ? (
        <InlineInfo message="当前为只读演示模式（DEMO_READ_ONLY=true）：可以浏览与检索，上传、编辑、删除与重建索引已关闭。" />
      ) : null}

      {/* ------------------------------------------------------------ stats */}
      {stats.status === "success" ? (
        <Card surface="subtle" className="grid grid-cols-2 overflow-hidden sm:grid-cols-4">
          <div className={METRIC_CELL[0]}>
            <CompactMetric
              label="文档"
              value={formatCount(stats.data.document_count)}
              hint={`${stats.data.indexed_document_count} 个已索引`}
              icon={<FileStack className="size-3.5" />}
              tone="accent"
              className={METRIC_INNER}
            />
          </div>
          <div className={METRIC_CELL[1]}>
            <CompactMetric
              label="知识块"
              value={formatCount(stats.data.chunk_count)}
              hint={`${stats.data.vectorized_chunk_count} 个已向量化`}
              icon={<Layers className="size-3.5" />}
              className={METRIC_INNER}
            />
          </div>
          <div className={METRIC_CELL[2]}>
            <CompactMetric
              label="索引状态"
              value={indexState ? INDEX_META[indexState].label : "—"}
              hint={stats.data.index_note || stats.data.retriever_mode}
              icon={<Database className="size-3.5" />}
              tone={indexState ? INDEX_META[indexState].tone : "neutral"}
              className={METRIC_INNER}
            />
          </div>
          <div className={METRIC_CELL[3]}>
            <CompactMetric
              label="最近更新"
              value={formatDateTime(stats.data.last_indexed_at, true)}
              hint={
                stats.data.last_indexed_at
                  ? formatRelative(stats.data.last_indexed_at)
                  : "尚未建立索引"
              }
              icon={<Clock className="size-3.5" />}
              className={METRIC_INNER}
            />
          </div>
        </Card>
      ) : stats.status === "loading" ? (
        <Card surface="subtle" className="grid grid-cols-2 overflow-hidden sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className={METRIC_CELL[index]}>
              <Skeleton className="h-2.5 w-12" />
              <Skeleton className="mt-1.5 h-5 w-16" />
              <Skeleton className="mt-1 h-2.5 w-20" />
            </div>
          ))}
        </Card>
      ) : null}

      {/* ------------------------------------- search + filter → upload CTA */}
      <MainTaskPanel>
        <MainTaskHeader
          title="查找与上传文档"
          description="搜索、筛选现有文档，或上传新文档（Markdown / 文本 / PDF / Word，上传后自动解析、切分并重建索引）"
          icon={<Search className="size-4" />}
        />
        <MainTaskBody className="space-y-3">
          <Field label="搜索" className="min-w-0">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--color-ink-faint)]" />
              <Input
                value={query}
                placeholder="按文件名 / 摘要 / 标签搜索"
                onChange={(event) => setQuery(event.target.value)}
                className="pl-8"
              />
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="资料分类" className="min-w-0">
              <Select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">全部</option>
                {categoryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="状态" className="min-w-0">
              <Select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">全部</option>
                <option value="indexed">已索引</option>
                <option value="failed">解析失败</option>
                <option value="uploaded">已上传</option>
              </Select>
            </Field>

            <Field label="排序" className="col-span-2 min-w-0 sm:col-span-1">
              <Select value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="name">按名称</option>
                <option value="modified">按修改时间</option>
                <option value="size">按大小</option>
                <option value="chunks">按知识块数</option>
              </Select>
            </Field>
          </div>

          {/*
            A native <label> wrapping the file input rather than a clickable
            <div>: the input stays in the tab order (just visually hidden), so
            the zone is reachable and operable by keyboard (Enter / Space open
            the picker) instead of being mouse-only. The input is associated by
            nesting alone — adding htmlFor on top of a nested control can make
            some browsers fire the activation twice. In read-only mode the input
            is `disabled`, so it drops out of the tab order and clicking the
            label does nothing — the zone stays genuinely inert.
          */}
          <label
            onDragOver={(event) => {
              event.preventDefault();
              if (!readOnly) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (readOnly) {
                toast({ title: "只读模式", description: "当前不允许上传。", variant: "warning" });
                return;
              }
              void handleFiles(event.dataTransfer.files);
            }}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 rounded-[var(--radius-lg)] border border-dashed px-6 py-5 text-center transition-colors",
              "focus-within:outline-solid focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--color-accent)]",
              dragging
                ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                : "border-[var(--color-line-strong)]",
              readOnly
                ? "cursor-not-allowed opacity-60"
                : "cursor-pointer hover:border-[var(--color-accent-line)] hover:bg-[var(--color-surface-sunken)]",
            )}
          >
            <UploadCloud className="size-5 text-[var(--color-ink-faint)]" />
            <span className="block text-sm text-[var(--color-ink-soft)]">
              {uploading ? `正在上传 ${uploading}…` : "拖拽文件到此处，或点击选择文件"}
            </span>
            <span className="block text-2xs text-[var(--color-ink-faint)]">
              上限 {(maxBytes / 1024 / 1024).toFixed(0)} MB · 文件名为安全化处理后的名称
            </span>
            <input
              id={UPLOAD_INPUT_ID}
              ref={fileInput}
              type="file"
              multiple
              disabled={readOnly}
              accept=".md,.markdown,.txt,.pdf,.docx"
              className="sr-only"
              onChange={(event) => {
                void handleFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </label>

          {uploadError ? <InlineError message={uploadError} /> : null}
        </MainTaskBody>
      </MainTaskPanel>

      {/* ------------------------------------------------------------- list */}
      <ResultSection
        label="文档列表"
        icon={<FileStack className="size-4" />}
        meta={documents.status === "success" ? `共 ${documents.data.total} 个` : "加载中…"}
      >
        {documents.status === "loading" ? (
          <SkeletonRows count={6} />
        ) : documents.status === "error" ? (
          <ErrorState error={documents.error} onRetry={documents.reload} />
        ) : documents.data.items.length === 0 ? (
          <EmptyState
            icon={<FileStack className="size-5" />}
            title="没有匹配的文档"
            description="调整筛选条件，或上传新的知识文档。"
          />
        ) : (
          <>
            {/* phone: card rows (a wide table would only fit by shrinking or scrolling) */}
            <ul className="space-y-2 md:hidden">
              {documents.data.items.map((doc) => (
                <li key={doc.id}>
                  <div className="flex items-stretch gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line-faint)] surface-base">
                    <button
                      type="button"
                      onClick={() => setDetailId(doc.id)}
                      className="flex min-h-11 min-w-0 flex-1 items-start gap-2.5 px-3 py-2.5 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span
                          className="block truncate text-xs font-medium text-[var(--color-ink)]"
                          title={doc.name}
                        >
                          {doc.name}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-[var(--color-ink-faint)]">
                          <span>{doc.type_label}</span>
                          <span aria-hidden>·</span>
                          <span>{doc.chunk_count} 知识块</span>
                          <span aria-hidden>·</span>
                          <span>{formatDateTime(doc.modified_at, true)}</span>
                        </span>
                      </span>
                      <span className="mt-0.5 inline-flex shrink-0 items-center gap-1.5">
                        <StatusDot tone={STATUS_TONE[doc.status]} />
                        <span className="text-2xs text-[var(--color-ink-muted)]">
                          {doc.status_label}
                        </span>
                      </span>
                    </button>
                    <div className="flex items-center pr-1.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-11 shrink-0"
                        title={readOnly ? "只读模式，不可删除" : "删除文档"}
                        aria-label="删除文档"
                        disabled={readOnly || deleting === doc.id}
                        onClick={() => void remove(doc.id, doc.name)}
                      >
                        {deleting === doc.id ? (
                          <AlertTriangle className="size-3.5 text-[var(--color-warning)]" />
                        ) : (
                          <Trash2 className="size-3.5 text-[var(--color-danger)]" />
                        )}
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* desktop: full table */}
            <div className="hidden md:block">
              <Table>
                <thead>
                  <tr>
                    <TH>文档</TH>
                    <TH>类型</TH>
                    <TH>分类</TH>
                    <TH align="right">知识块</TH>
                    <TH align="right">大小</TH>
                    <TH>状态</TH>
                    <TH>修改时间</TH>
                    <TH align="right">操作</TH>
                  </tr>
                </thead>
                <tbody>
                  {documents.data.items.map((doc) => {
                    const selected = detailId === doc.id;
                    return (
                      <TR
                        key={doc.id}
                        onClick={() => setDetailId(doc.id)}
                        className={cn("group", selected && "bg-[var(--color-accent-soft)]")}
                      >
                        <TD>
                          <div className="flex items-start gap-2.5">
                            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-surface-inset)] text-[var(--color-ink-muted)]">
                              <FileText className="size-3.5" />
                            </span>
                            <span className="min-w-0">
                              <button
                                type="button"
                                onClick={() => setDetailId(doc.id)}
                                className={cn(
                                  "block max-w-[22rem] truncate text-left text-xs font-medium hover:text-[var(--color-accent)]",
                                  selected
                                    ? "text-[var(--color-accent-ink)]"
                                    : "text-[var(--color-ink)]",
                                )}
                                title={doc.name}
                              >
                                {doc.name}
                              </button>
                              {doc.tags.length > 0 ? (
                                <span className="mt-1 flex flex-wrap gap-1">
                                  {doc.tags.slice(0, 3).map((tag) => (
                                    <span
                                      key={tag}
                                      className="rounded-[var(--radius-xs)] bg-[var(--color-surface-sunken)] px-1.5 py-0.5 text-2xs text-[var(--color-ink-faint)]"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </span>
                              ) : null}
                            </span>
                          </div>
                        </TD>
                        <TD>
                          <span className="text-2xs text-[var(--color-ink-muted)]">
                            {doc.type_label}
                          </span>
                        </TD>
                        <TD>
                          <Badge tone="neutral">{doc.category_label}</Badge>
                        </TD>
                        <TD align="right" mono>
                          <span className="text-[var(--color-ink-soft)]">{doc.chunk_count}</span>
                        </TD>
                        <TD align="right" mono>
                          <span className="text-[var(--color-ink-soft)]">{doc.size_human}</span>
                        </TD>
                        <TD>
                          <span className="inline-flex items-center gap-1.5">
                            <StatusDot tone={STATUS_TONE[doc.status]} />
                            <span className="text-xs text-[var(--color-ink-soft)]">
                              {doc.status_label}
                            </span>
                          </span>
                        </TD>
                        <TD>
                          <span className="text-2xs text-[var(--color-ink-muted)]">
                            {formatDateTime(doc.modified_at)}
                          </span>
                        </TD>
                        <TD align="right">
                          <span
                            className="flex justify-end gap-1 opacity-0 transition-opacity duration-[var(--motion-fast)] ease-[var(--ease-standard)] group-hover:opacity-100 focus-within:opacity-100"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <Link href={`/knowledge/explorer?doc=${encodeURIComponent(doc.id)}`}>
                              <Button size="icon" variant="ghost" title="在 Explorer 中查看">
                                <ExternalLink className="size-3.5" />
                              </Button>
                            </Link>
                            <Button
                              size="icon"
                              variant="ghost"
                              title={readOnly ? "只读模式，不可删除" : "删除文档"}
                              disabled={readOnly || deleting === doc.id}
                              onClick={() => void remove(doc.id, doc.name)}
                            >
                              {deleting === doc.id ? (
                                <AlertTriangle className="size-3.5 text-[var(--color-warning)]" />
                              ) : (
                                <Trash2 className="size-3.5 text-[var(--color-danger)]" />
                              )}
                            </Button>
                          </span>
                        </TD>
                      </TR>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          </>
        )}
      </ResultSection>

      {/* ----------------------------------------------------- batch actions */}
      <SectionAccordion
        label="批量操作"
        description="重建检索索引（作用于全部文档）"
        icon={<RefreshCw className="size-4" />}
      >
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-[var(--color-ink-muted)]">
            重建索引会重新解析全部文档、重新切分知识块并更新向量，通常在上传了大量文档或调整切分规则后执行；执行期间检索可能短暂变慢。
          </p>
          <Button
            size="md"
            variant="outline"
            className="min-h-11 sm:min-h-0"
            loading={reindexing}
            disabled={readOnly}
            onClick={() => void reindex()}
          >
            <RefreshCw className="size-3.5" />
            重建索引
          </Button>
          {readOnly ? (
            <p className="text-2xs text-[var(--color-ink-faint)]">只读演示模式下已关闭。</p>
          ) : null}
        </div>
      </SectionAccordion>

      {/* ------------------------------------------------------- tech notes */}
      <SectionAccordion
        label="技术说明"
        description="索引状态、检索模式与解析边界"
        icon={<Settings2 className="size-4" />}
      >
        <div className="space-y-2">
          {stats.status === "success" ? (
            <>
              <DefRow label="索引状态">
                {INDEX_META[stats.data.index_state].label}
              </DefRow>
              <DefRow label="检索模式" mono>
                {stats.data.retriever_mode}
              </DefRow>
              <DefRow label="向量模型" mono>
                {stats.data.embedding_provider}
              </DefRow>
              <DefRow label="已索引文档">
                {stats.data.indexed_document_count} / {stats.data.document_count}
              </DefRow>
              <DefRow label="已向量化知识块">{stats.data.vectorized_chunk_count}</DefRow>
              <DefRow label="解析失败文档">{stats.data.failed_count}</DefRow>
              <DefRow label="最近索引时间">{formatDateTime(stats.data.last_indexed_at)}</DefRow>
            </>
          ) : (
            <p className="text-xs text-[var(--color-ink-faint)]">统计信息加载中…</p>
          )}

          <div className="space-y-1.5 border-t border-[var(--color-line-faint)] pt-3">
            <p className="text-xs leading-relaxed text-[var(--color-ink-muted)]">
              · 支持格式：Markdown / 文本 / PDF / Word；上传后自动解析、切分并重建索引。
            </p>
            <p className="text-xs leading-relaxed text-[var(--color-ink-muted)]">
              · 扫描版 PDF 无文本层，需先自行 OCR 才能被解析（当前不做 OCR）。
            </p>
            <p className="text-xs leading-relaxed text-[var(--color-ink-muted)]">
              · 单文件上限 {(maxBytes / 1024 / 1024).toFixed(0)} MB；文件名为安全化处理后的名称。
            </p>
          </div>
        </div>
      </SectionAccordion>

      {/* ------------------------------------------------------------ drawer */}
      <Drawer
        open={detailId !== null}
        onClose={() => setDetailId(null)}
        title={detailData?.name ?? "文档详情"}
        subtitle={detailData ? detailData.extraction_note || detailData.status_label : undefined}
        footer={
          detailData ? (
            <Link
              href={`/knowledge/explorer?doc=${encodeURIComponent(detailData.id)}`}
              className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-[var(--color-accent-ink)] hover:text-[var(--color-accent)]"
            >
              <ExternalLink className="size-3.5" />
              在知识探索中打开
            </Link>
          ) : undefined
        }
      >
        {detail.status === "loading" ? (
          <SkeletonRows count={4} />
        ) : detail.status === "error" ? (
          <ErrorState error={detail.error} onRetry={detail.reload} />
        ) : detailData ? (
          <div className="space-y-4">
            {/* header: file metadata sits on its own recessed surface so the
                body below reads as the document, not as another metadata row. */}
            <Card surface="subtle" className="px-3.5 py-3">
              <SectionLabel>元数据</SectionLabel>
              <div className="mt-1.5 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                <div>
                  <DefRow label="类型">{detailData.type_label}</DefRow>
                  <DefRow label="分类">{detailData.category_label}</DefRow>
                  <DefRow label="文件大小">{detailData.size_human}</DefRow>
                  <DefRow label="字符数">{formatCount(detailData.char_count ?? 0)}</DefRow>
                </div>
                <div>
                  <DefRow label="状态">{detailData.status_label}</DefRow>
                  <DefRow label="参与检索">{detailData.searchable ? "是" : "否"}</DefRow>
                  <DefRow label="修改时间">{formatDateTime(detailData.modified_at)}</DefRow>
                  <DefRow label="创建时间">{formatDateTime(detailData.created_at)}</DefRow>
                </div>
              </div>

              {detailData.tags.length > 0 ? (
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {detailData.tags.map((tag) => (
                    <Badge key={tag} tone="neutral">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </Card>

            {detailData.summary ? (
              <div>
                <SectionLabel>摘要（规则提取，非模型生成）</SectionLabel>
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-ink-soft)]">
                  {detailData.summary}
                </p>
              </div>
            ) : null}

            <div>
              <SectionLabel>
                {detailData.content_truncated ? "正文（内容过长，仅显示前 200,000 字符）" : "正文"}
              </SectionLabel>
              <div className="mt-1.5 max-h-[26rem] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-line-faint)] surface-inset px-3.5 py-3">
                <Markdown content={truncate(detailData.content, 12000) || "（空文档）"} />
              </div>
            </div>

            <SectionAccordion
              label="查看知识块详情"
              description={`共 ${detailData.chunks.length} 个知识块`}
              icon={<Layers className="size-4" />}
            >
              {detailData.chunks.length > 0 ? (
                <div className="space-y-2">
                  {detailData.chunks.map((chunk) => (
                    <div
                      key={chunk.chunk_id}
                      className="rounded-[var(--radius-md)] border border-[var(--color-line-faint)] surface-subtle px-3 py-2.5"
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
                        <p
                          className="mt-1.5 truncate text-2xs text-[var(--color-ink-muted)]"
                          title={chunk.section}
                        >
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
                <p className="py-2 text-center text-xs text-[var(--color-ink-faint)]">
                  没有知识块。该文档未参与检索（可能是解析失败或非文本格式）。
                </p>
              )}
            </SectionAccordion>

            <SectionAccordion
              label="查看索引详情"
              description="状态、向量化与提取说明"
              icon={<Database className="size-4" />}
            >
              <DefRow label="文档 ID" mono>
                {detailData.id}
              </DefRow>
              <DefRow label="索引状态">{detailData.status_label}</DefRow>
              <DefRow label="参与检索">{detailData.searchable ? "是" : "否"}</DefRow>
              <DefRow label="知识块总数">{detailData.chunk_count}</DefRow>
              <DefRow label="已向量化知识块">
                {detailData.chunks.filter((chunk) => chunk.has_vector).length}
              </DefRow>
              {detailData.extraction_note ? (
                <div className="pt-2">
                  <SectionLabel>提取说明</SectionLabel>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--color-ink-soft)]">
                    {detailData.extraction_note}
                  </p>
                </div>
              ) : null}
            </SectionAccordion>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
