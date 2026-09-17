"use client";

import { Activity, Filter, Gauge, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useState } from "react";

import { Badge, CodeChip, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BarChart, StatCard, TD, TH, TR, Table } from "@/components/ui/data";
import { Field, Select } from "@/components/ui/field";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/states";
import { useToast } from "@/components/providers/toast-provider";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import { ACTIVITY_KIND_LABELS, formatMs, formatPercent, formatRelative, vizColor } from "@/lib/utils";

export default function ActivityPage() {
  const { toast } = useToast();
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");

  const records = useAsync(
    () => api.activity({ kind, status, limit: 120 }),
    [kind, status],
  );
  const stats = useAsync(() => api.activityStats(30), []);

  const reloadAll = useCallback(() => {
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

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------------ stats */}
      {stats.status === "success" ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
            />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
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
                  <p className="py-6 text-center text-xs text-[var(--color-ink-faint)]">
                    还没有 Agent 运行记录。
                  </p>
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
        </>
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
              <Button size="sm" variant="ghost" onClick={reloadAll}>
                <RefreshCw className="size-3.5" />
                刷新
              </Button>
              <Button size="sm" variant="outline" onClick={() => void clear()}>
                清空
              </Button>
            </>
          }
        />
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="类型" className="w-44">
              <Select value={kind} onChange={(event) => setKind(event.target.value)}>
                <option value="">全部</option>
                {Object.keys(ACTIVITY_KIND_LABELS).map((key) => (
                  <option key={key} value={key}>
                    {ACTIVITY_KIND_LABELS[key]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="状态" className="w-36">
              <Select value={status} onChange={(event) => setStatus(event.target.value)}>
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
          ) : records.data.items.length === 0 ? (
            <EmptyState
              icon={<Activity className="size-5" />}
              title="没有活动记录"
              description="发起一次问答、Agent 运行或方案生成后，这里会出现真实记录。"
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <TH>时间</TH>
                  <TH>类型</TH>
                  <TH>标题</TH>
                  <TH>意图 / Skill</TH>
                  <TH>Tool</TH>
                  <TH align="right">引用</TH>
                  <TH align="right">耗时</TH>
                  <TH>状态</TH>
                </tr>
              </thead>
              <tbody>
                {records.data.items.map((item) => (
                  <TR key={item.id}>
                    <TD>
                      <span className="text-2xs text-[var(--color-ink-muted)]" title={item.created_at}>
                        {formatRelative(item.created_at)}
                      </span>
                    </TD>
                    <TD>
                      <Badge tone="neutral">
                        {ACTIVITY_KIND_LABELS[item.kind] ?? item.kind}
                      </Badge>
                    </TD>
                    <TD>
                      <span className="block max-w-[24rem] truncate text-xs text-[var(--color-ink)]" title={item.title}>
                        {item.title}
                      </span>
                      {item.source_names.length > 0 ? (
                        <span className="mt-0.5 block max-w-[24rem] truncate text-2xs text-[var(--color-ink-faint)]">
                          来源：{item.source_names.join("、")}
                        </span>
                      ) : null}
                    </TD>
                    <TD>
                      <span className="flex flex-wrap gap-1">
                        {item.intent ? <CodeChip>{item.intent}</CodeChip> : null}
                        {item.skill ? <CodeChip>{item.skill.replace(/_skill$/, "")}</CodeChip> : null}
                      </span>
                    </TD>
                    <TD>
                      <span className="flex flex-wrap gap-1">
                        {item.tools.slice(0, 3).map((tool) => (
                          <CodeChip key={tool}>{tool}</CodeChip>
                        ))}
                        {item.tools.length > 3 ? (
                          <span className="text-2xs text-[var(--color-ink-faint)]">
                            +{item.tools.length - 3}
                          </span>
                        ) : null}
                      </span>
                    </TD>
                    <TD align="right" mono>
                      {item.citation_count}
                    </TD>
                    <TD align="right" mono>
                      {formatMs(item.latency_ms)}
                    </TD>
                    <TD>
                      <span className="inline-flex items-center gap-1.5">
                        <StatusDot
                          tone={
                            item.status === "success"
                              ? "success"
                              : item.status === "failed"
                                ? "danger"
                                : "warning"
                          }
                        />
                        <span className="text-xs">{item.status}</span>
                      </span>
                      {item.error ? (
                        <span className="mt-0.5 block max-w-[12rem] truncate text-2xs text-[var(--color-danger)]" title={item.error}>
                          {item.error}
                        </span>
                      ) : null}
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
