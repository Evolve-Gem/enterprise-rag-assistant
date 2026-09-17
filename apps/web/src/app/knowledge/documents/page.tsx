"use client";

import {
  AlertTriangle,
  ExternalLink,
  FileStack,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";

import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TD, TH, TR, Table } from "@/components/ui/data";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState, ErrorState, InlineError, InlineInfo, SkeletonRows } from "@/components/ui/states";
import { useToast } from "@/components/providers/toast-provider";
import { api, ApiError } from "@/lib/api";
import { useAsync, useDebounced } from "@/lib/hooks";
import type { DocumentStatus, KnowledgeStats, SettingsResponse } from "@/lib/types";
import { cn, formatCount, formatDateTime } from "@/lib/utils";

const STATUS_TONE: Record<DocumentStatus, "success" | "warning" | "danger" | "neutral"> = {
  indexed: "success",
  uploaded: "neutral",
  parsing: "warning",
  failed: "danger",
  unsupported: "neutral",
};

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

  return (
    <div className="space-y-5">
      {readOnly ? (
        <InlineInfo message="当前为只读演示模式（DEMO_READ_ONLY=true）：可以浏览与检索，上传、编辑、删除与重建索引已关闭。" />
      ) : null}

      {/* ------------------------------------------------------------ stats */}
      {stats.status === "success" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "文档", value: stats.data.document_count, hint: `${stats.data.indexed_document_count} 个已索引` },
            { label: "知识块", value: stats.data.chunk_count, hint: `${stats.data.vectorized_chunk_count} 个已向量化` },
            { label: "总字符", value: stats.data.total_chars, hint: stats.data.index_note || "—" },
            { label: "解析失败", value: stats.data.failed_count, hint: "PDF 扫描件需要 OCR" },
          ].map((item) => (
            <Card key={item.label} className="p-4">
              <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
                {item.label}
              </p>
              <p className="mt-1.5 text-xl font-semibold tabular-nums text-[var(--color-ink)]">
                {formatCount(item.value)}
              </p>
              <p className="mt-1 truncate text-2xs text-[var(--color-ink-muted)]" title={String(item.hint)}>
                {item.hint}
              </p>
            </Card>
          ))}
        </div>
      ) : null}

      {/* ----------------------------------------------------------- upload */}
      <Card>
        <CardHeader
          title="上传文档"
          description="支持 Markdown / 文本 / PDF / Word；上传后自动解析、切分并重建索引"
          icon={<UploadCloud className="size-4" />}
          dense
          actions={
            <Button size="sm" variant="outline" loading={reindexing} disabled={readOnly} onClick={() => void reindex()}>
              <RefreshCw className="size-3.5" />
              重建索引
            </Button>
          }
        />
        <CardContent className="space-y-3">
          <div
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
            onClick={() => !readOnly && fileInput.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-dashed px-6 py-8 text-center transition-colors",
              dragging
                ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                : "border-[var(--color-line-strong)] hover:border-[var(--color-accent-line)] hover:bg-[var(--color-surface-sunken)]",
              readOnly && "cursor-not-allowed opacity-60",
            )}
          >
            <UploadCloud className="size-5 text-[var(--color-ink-faint)]" />
            <p className="text-sm text-[var(--color-ink-soft)]">
              {uploading ? `正在上传 ${uploading}…` : "拖拽文件到此处，或点击选择文件"}
            </p>
            <p className="text-2xs text-[var(--color-ink-faint)]">
              上限 {(maxBytes / 1024 / 1024).toFixed(0)} MB · 文件名为安全化处理后的名称
            </p>
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              accept=".md,.markdown,.txt,.pdf,.docx"
              onChange={(event) => {
                void handleFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>

          {uploadError ? <InlineError message={uploadError} /> : null}
        </CardContent>
      </Card>

      {/* ---------------------------------------------------------- filters */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3">
          <Field label="搜索" className="min-w-[14rem] flex-1">
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

          <Field label="资料分类" className="w-40">
            <Select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">全部</option>
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="状态" className="w-32">
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">全部</option>
              <option value="indexed">已索引</option>
              <option value="failed">解析失败</option>
              <option value="uploaded">已上传</option>
            </Select>
          </Field>

          <Field label="排序" className="w-36">
            <Select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="name">按名称</option>
              <option value="modified">按修改时间</option>
              <option value="size">按大小</option>
              <option value="chunks">按知识块数</option>
            </Select>
          </Field>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------ table */}
      <Card>
        <CardHeader
          dense
          title="文档列表"
          description={
            documents.status === "success"
              ? `共 ${documents.data.total} 个文档`
              : "加载中…"
          }
        />
        <CardContent>
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
                {documents.data.items.map((doc) => (
                  <TR key={doc.id}>
                    <TD>
                      <Link
                        href={`/knowledge/explorer?doc=${encodeURIComponent(doc.id)}`}
                        className="block max-w-[22rem] truncate text-xs font-medium text-[var(--color-ink)] hover:text-[var(--color-accent)]"
                        title={doc.name}
                      >
                        {doc.name}
                      </Link>
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
                    </TD>
                    <TD>
                      <span className="text-xs">{doc.type_label}</span>
                    </TD>
                    <TD>
                      <Badge tone="neutral">{doc.category_label}</Badge>
                    </TD>
                    <TD align="right" mono>
                      {doc.chunk_count}
                    </TD>
                    <TD align="right" mono>
                      {doc.size_human}
                    </TD>
                    <TD>
                      <span className="inline-flex items-center gap-1.5">
                        <StatusDot tone={STATUS_TONE[doc.status]} />
                        <span className="text-xs">{doc.status_label}</span>
                      </span>
                    </TD>
                    <TD>
                      <span className="text-2xs text-[var(--color-ink-muted)]">
                        {formatDateTime(doc.modified_at)}
                      </span>
                    </TD>
                    <TD align="right">
                      <span className="flex justify-end gap-1">
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
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
