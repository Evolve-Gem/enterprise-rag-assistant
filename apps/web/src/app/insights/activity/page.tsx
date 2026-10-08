"use client";

import {
  Activity,
  ChartColumn,
  Cpu,
  Database,
  FileText,
  Filter,
  FlaskConical,
  Gauge,
  MessagesSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CodeChip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BarChart, StatCard } from "@/components/ui/data";
import { Field, Select } from "@/components/ui/field";
import { SectionAccordion } from "@/components/ui/section";
import { EmptyState, ErrorState, InlineError, SkeletonRows } from "@/components/ui/states";
import { useToast } from "@/components/providers/toast-provider";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { ActivityRecord } from "@/lib/types";
import {
  ACTIVITY_KIND_LABELS,
  cn,
  formatMs,
  formatPercent,
  formatRelative,
  vizColor,
} from "@/lib/utils";

/** Icon per activity kind — the timeline's lead glyph. */
const KIND_ICON: Record<string, typeof Activity> = {
  rag_query: Search,
  chat: MessagesSquare,
  agent_run: Workflow,
  solution: FileText,
  evaluation: FlaskConical,
  knowledge: Database,
  system: Cpu,
};

/** Icon bubble tint per status, paired with a dot + word in the body. */
const STATUS_BUBBLE: Record<string, string> = {
  success:
    "border-[var(--color-success-line)] bg-[var(--color-success-soft)] text-[var(--color-success)]",
  failed:
    "border-[var(--color-danger-line)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
  warning:
    "border-[var(--color-warning-line)] bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
};

function statusTone(status: string): "success" | "danger" | "warning" {
  if (status === "success") return "success";
  if (status === "failed") return "danger";
  return "warning";
}

/**
 * Chinese status word.
 *
 * The row used to carry three encodings of the same fact — a tinted bubble, a
 * coloured dot and the raw English enum. The bubble keeps the colour, this
 * keeps the word, and the dot is gone; a Chinese product should not surface
 * `success` / `failed` as user-facing text.
 */
const STATUS_LABEL: Record<string, string> = {
  success: "成功",
  failed: "失败",
  warning: "警告",
};

/** Newest-first page size for the ledger; "load more" pulls the next page. */
const ACTIVITY_PAGE_SIZE = 20;

export default function ActivityPage() {
  const { toast } = useToast();
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");

  // Only the newest page is fetched up front. Rendering the whole history sent
  // the page well past 14,000 px tall and made the DOM (not just the viewport)
  // the bottleneck, so the remaining records are pulled in on demand below.
  const records = useAsync(
    () => api.activity({ kind, status, offset: 0, limit: ACTIVITY_PAGE_SIZE }),
    [kind, status],
  );

  // Pages appended by "load more". Held separately from the first page so a
  // filter change simply drops back to the newest 20.
  const [extra, setExtra] = useState<ActivityRecord[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  const stats = useAsync(() => api.activityStats(30), []);

  // Filter changes reset the ledger to the newest page.
  useEffect(() => {
    setExtra([]);
    setMoreError(null);
  }, [kind, status]);

  const reloadAll = useCallback(() => {
    setExtra([]);
    setMoreError(null);
    void records.reload();
    void stats.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records.reload, stats.reload]);

  const clear = useCallback(async () => {
    if (!window.confirm("确认清空全部活动记录？该操作不可撤销。")) return;
    try {
      const result = await api.clearActivity();
      toast({ title: "已清空", description: result.message, variant: "success" });
      reloadAll();
    } catch {
      toast({ title: "清空失败", description: "可能是只读演示模式限制。", variant: "error" });
    }
  }, [toast, reloadAll]);

  // `records` is memoized by the async hook, so this stays referentially stable
  // unless the page or the appended set actually changed — which keeps
  // `loadMore` below from being rebuilt on every render.
  const items = useMemo(
    () => (records.status === "success" ? [...records.data.items, ...extra] : extra),
    [records, extra],
  );
  const total = records.status === "success" ? records.data.total : 0;
  const hasMore = records.status === "success" && items.length < total;

  const loadMore = useCallback(async () => {
    if (loadingMore || records.status !== "success") return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await api.activity({
        kind,
        status,
        offset: items.length,
        limit: ACTIVITY_PAGE_SIZE,
      });
      // Records are created continuously, so a page boundary can repeat an id
      // that has since shifted; de-duplicate to keep React keys unique.
      setExtra((previous) => {
        const seen = new Set(items.map((record) => record.id));
        return [...previous, ...page.items.filter((record) => !seen.has(record.id))];
      });
    } catch (caught) {
      setMoreError(caught instanceof Error ? caught.message : "加载更多失败，请重试。");
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, records.status, kind, status, items]);

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------------ stats */}
      {stats.status === "success" ? (
        // Two columns on a phone: four full-width cards meant four screens of
        // scrolling to read four numbers.
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatCard
            label="总记录"
            value={stats.data.total}
            hint={`存储后端 ${stats.data.backend}`}
            icon={<Activity className="size-4" />}
            tone="accent"
          />
          <StatCard
            label="成功率"
            value={formatPercent(stats.data.success_rate, 1)}
            hint={`失败 ${stats.data.failure_count} 次`}
            icon={<ShieldCheck className="size-4" />}
            tone={stats.data.failure_count === 0 ? "success" : "warning"}
          />
          <StatCard
            label="平均延迟"
            value={formatMs(stats.data.average_latency_ms)}
            hint={stats.data.last_activity_at ? `最近 ${formatRelative(stats.data.last_activity_at)}` : "—"}
            icon={<Gauge className="size-4" />}
          />
          <StatCard
            label="P95 延迟"
            value={formatMs(stats.data.p95_latency_ms)}
            hint="长尾指标，反映最慢的一批请求"
            icon={<ChartColumn className="size-4" />}
          />
        </div>
      ) : null}

      {/* --------------------------------------------------- distributions */}
      {stats.status === "success" ? (
        <SectionAccordion
          label="查看分布统计"
          description="按类型 / Skill / 状态汇总近 30 天记录"
          icon={<ChartColumn className="size-4" />}
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader dense title="按类型分布" icon={<Filter className="size-4" />} />
              <CardContent>
                <BarChart
                  data={Object.entries(stats.data.by_kind)
                    .sort((a, b) => b[1] - a[1])
                    .map(([key, value], index) => ({
                      label: ACTIVITY_KIND_LABELS[key] ?? key,
                      value,
                      tone: vizColor(index),
                    }))}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader dense title="按 Skill 分布" />
              <CardContent>
                {Object.keys(stats.data.by_skill).length === 0 ? (
                  <EmptyState
                    icon={<Activity className="size-5" />}
                    title="还没有 Skill 运行记录"
                    description="发起一次 Agent 任务后，这里会按 Skill 汇总调用次数。"
                  />
                ) : (
                  <BarChart
                    data={Object.entries(stats.data.by_skill).map(([key, value], index) => ({
                      label: key.replace(/_skill$/, ""),
                      value,
                      tone: vizColor(index + 2),
                    }))}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader dense title="按状态分布" />
              <CardContent>
                <BarChart
                  data={Object.entries(stats.data.by_status).map(([key, value]) => ({
                    label: key,
                    value,
                    tone:
                      key === "success"
                        ? "var(--color-success)"
                        : key === "failed"
                          ? "var(--color-danger)"
                          : "var(--color-warning)",
                  }))}
                />
              </CardContent>
            </Card>
          </div>
        </SectionAccordion>
      ) : null}

      {/* --------------------------------------------------------- records */}
      <Card>
        <CardHeader
          title="活动记录"
          description="问题 / 意图 / Skill / Tool / 延迟 / 来源 / 状态；不记录任何密钥"
          icon={<Activity className="size-4" />}
          dense
          actions={
            <>
              <Button size="sm" variant="ghost" className="min-h-11" onClick={reloadAll}>
                <RefreshCw className="size-3.5" />
                刷新
              </Button>
              <Button size="sm" variant="outline" className="min-h-11" onClick={() => void clear()}>
                清空
              </Button>
            </>
          }
        />
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="类型" className="w-44">
              <Select
                className="min-h-11"
                value={kind}
                onChange={(event) => setKind(event.target.value)}
              >
                <option value="">全部</option>
                {Object.keys(ACTIVITY_KIND_LABELS).map((key) => (
                  <option key={key} value={key}>
                    {ACTIVITY_KIND_LABELS[key]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="状态" className="w-36">
              <Select
                className="min-h-11"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">全部</option>
                <option value="success">success</option>
                <option value="failed">failed</option>
              </Select>
            </Field>
            {records.status === "success" ? (
              <p className="text-2xs text-[var(--color-ink-muted)]">
                共 {records.data.total} 条
              </p>
            ) : null}
          </div>

          {records.status === "loading" ? (
            <SkeletonRows count={8} />
          ) : records.status === "error" ? (
            <ErrorState error={records.error} onRetry={records.reload} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Activity className="size-5" />}
              title="没有活动记录"
              description="发起一次问答、Agent 运行或方案生成后，这里会出现真实记录。"
            />
          ) : (
            <div className="space-y-4">
              <ol className="relative space-y-2">
                {items.map((item, index) => {
                  const Icon = KIND_ICON[item.kind] ?? Activity;
                  const tone = statusTone(item.status);
                  return (
                    <li key={item.id} className="flex gap-3">
                      <span className="flex w-7 shrink-0 flex-col items-center">
                        <span
                          className={cn(
                            "flex size-7 items-center justify-center rounded-full border",
                            STATUS_BUBBLE[tone],
                          )}
                        >
                          <Icon className="size-3.5" />
                        </span>
                        {index < items.length - 1 ? (
                          <span
                            aria-hidden
                            className="mt-1 w-px flex-1 bg-[var(--color-line-faint)]"
                          />
                        ) : null}
                      </span>

                      <div className="min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--color-line-faint)] surface-subtle px-3 py-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <p
                            className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--color-ink)]"
                            title={item.title}
                          >
                            {item.title}
                          </p>
                          <div className="shrink-0 text-right">
                            <p
                              className="text-2xs text-[var(--color-ink-muted)]"
                              title={item.created_at}
                            >
                              {formatRelative(item.created_at)}
                            </p>
                            <p className="font-mono text-2xs tabular-nums text-[var(--color-ink-faint)]">
                              {formatMs(item.latency_ms)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-[var(--color-ink-muted)]">
                          <span className="text-[var(--color-ink-soft)]">
                            {ACTIVITY_KIND_LABELS[item.kind] ?? item.kind}
                          </span>
                          <span aria-hidden className="text-[var(--color-ink-faint)]">
                            ·
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="text-[var(--color-ink-soft)]">
                              {STATUS_LABEL[item.status] ?? item.status}
                            </span>
                          </span>
                          {item.intent ? <CodeChip>{item.intent}</CodeChip> : null}
                          {item.skill ? (
                            <CodeChip>{item.skill.replace(/_skill$/, "")}</CodeChip>
                          ) : null}
                          {item.tools.slice(0, 3).map((tool) => (
                            <CodeChip key={tool}>{tool}</CodeChip>
                          ))}
                          {item.tools.length > 3 ? (
                            <span className="text-[var(--color-ink-faint)]">
                              +{item.tools.length - 3}
                            </span>
                          ) : null}
                          {item.citation_count > 0 ? (
                            <span>引用 {item.citation_count}</span>
                          ) : null}
                        </div>

                        {item.source_names.length > 0 ? (
                          <p
                            className="mt-1 truncate text-2xs text-[var(--color-ink-faint)]"
                            title={item.source_names.join("、")}
                          >
                            来源：{item.source_names.join("、")}
                          </p>
                        ) : null}

                        {item.error ? (
                          <p
                            className="mt-1 text-2xs text-[var(--color-danger)]"
                            title={item.error}
                          >
                            {item.error}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>

              {hasMore ? (
                <div className="flex flex-col items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    loading={loadingMore}
                    onClick={() => void loadMore()}
                  >
                    加载更多（还有 {total - items.length} 条）
                  </Button>
                  {moreError ? <InlineError message={moreError} /> : null}
                </div>
              ) : items.length > ACTIVITY_PAGE_SIZE ? (
                <p className="text-center text-2xs text-[var(--color-ink-faint)]">
                  已显示全部 {items.length} 条
                </p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
