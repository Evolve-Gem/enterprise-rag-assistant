"use client";

import { AlertOctagon, Boxes, CheckCircle2, FilePlus2, Target } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, SectionLabel } from "@/components/ui/card";
import { Donut, StackedBar, StatCard } from "@/components/ui/data";
import { EmptyState, ErrorState, SkeletonGrid } from "@/components/ui/states";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { GapReport } from "@/lib/types";
import { cn, formatCount, formatPercent } from "@/lib/utils";

const STATUS_META = {
  covered: { tone: "success" as const, label: "已覆盖", icon: CheckCircle2 },
  partial: { tone: "warning" as const, label: "部分覆盖", icon: AlertOctagon },
  missing: { tone: "danger" as const, label: "缺失", icon: Target },
};

export default function GapsPage() {
  const query = useAsync<GapReport>(() => api.gaps(), []);

  if (query.status === "loading") return <SkeletonGrid count={3} />;
  if (query.status === "error") return <ErrorState error={query.error} onRetry={query.reload} />;

  const report = query.data;

  return (
    <div className="space-y-5">
      {/* ---------------------------------------------------------- summary */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <Card>
          <CardHeader dense title="覆盖总览" description="按预设资料类型的确定性判定" icon={<Target className="size-4" />} />
          <CardContent className="space-y-4">
            <div className="flex items-center gap-5">
              <Donut
                value={report.coverage_ratio}
                label={formatPercent(report.coverage_ratio)}
                sublabel="完全覆盖"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <StackedBar
                  segments={[
                    { label: "已覆盖", value: report.covered.length, color: "var(--color-success)" },
                    { label: "部分覆盖", value: report.partial.length, color: "var(--color-warning)" },
                    { label: "缺失", value: report.missing.length, color: "var(--color-danger)" },
                  ]}
                />
                <ul className="space-y-0.5 text-2xs">
                  <li className="flex justify-between">
                    <span className="text-[var(--color-ink-muted)]">已覆盖</span>
                    <span className="font-mono">{report.covered.length}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-[var(--color-ink-muted)]">部分覆盖</span>
                    <span className="font-mono">{report.partial.length}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-[var(--color-ink-muted)]">缺失</span>
                    <span className="font-mono">{report.missing.length}</span>
                  </li>
                </ul>
              </div>
            </div>
            <p className="text-2xs leading-relaxed text-[var(--color-ink-faint)]">
              该比例是「完全覆盖的类型数 ÷ 期望类型总数」的简单计数，由规则引擎产出，
              不使用模型打分，也不代表内容质量的百分比。
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard
            label="分析文档数"
            value={formatCount(report.analyzed_document_count)}
            hint={`${formatCount(report.analyzed_chunk_count)} 个知识块`}
            icon={<Boxes className="size-4" />}
            tone="accent"
          />
          <StatCard
            label="建议补充文档"
            value={report.recommended_documents.length}
            hint="按 missing / partial 生成"
            icon={<FilePlus2 className="size-4" />}
          />
          <StatCard
            label="完全缺失类型"
            value={report.missing.length}
            hint={report.missing.slice(0, 2).join("、") || "无"}
            tone={report.missing.length ? "danger" : "success"}
          />
          <StatCard
            label="部分覆盖类型"
            value={report.partial.length}
            hint={report.partial.slice(0, 2).join("、") || "无"}
            tone={report.partial.length ? "warning" : "success"}
          />
        </div>
      </div>

      {/* --------------------------------------------------------- coverage */}
      <Card>
        <CardHeader
          title="分类覆盖明细"
          description="每一项都给出证据文档与判定理由，可以逐条核对"
          icon={<Target className="size-4" />}
          dense
        />
        <CardContent className="space-y-2">
          {report.coverage.map((item) => {
            const meta = STATUS_META[item.status];
            const Icon = meta.icon;
            return (
              <div
                key={item.category}
                className={cn(
                  "rounded-[var(--radius-lg)] border px-4 py-3",
                  item.status === "covered"
                    ? "border-[var(--color-line)]"
                    : item.status === "partial"
                      ? "border-[var(--color-warning-line)] bg-[var(--color-warning-soft)]/40"
                      : "border-[var(--color-danger-line)] bg-[var(--color-danger-soft)]/40",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      item.status === "covered"
                        ? "text-[var(--color-success)]"
                        : item.status === "partial"
                          ? "text-[var(--color-warning)]"
                          : "text-[var(--color-danger)]",
                    )}
                  />
                  <span className="text-sm font-medium text-[var(--color-ink)]">{item.label}</span>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  {item.document_count > 0 ? (
                    <Badge tone="neutral">{item.document_count} 个文档</Badge>
                  ) : null}
                  <span className="ml-auto font-mono text-2xs text-[var(--color-ink-faint)]">
                    {item.category}
                  </span>
                </div>

                <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-ink-muted)]">
                  {item.description} · {item.reason}
                </p>

                {item.evidence_documents.length > 0 ? (
                  <div className="mt-2">
                    <SectionLabel>证据文档</SectionLabel>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {item.evidence_documents.map((name) => (
                        <span
                          key={name}
                          className="rounded-[var(--radius-xs)] border border-[var(--color-line)] bg-[var(--color-surface)] px-1.5 py-0.5 text-2xs text-[var(--color-ink-soft)]"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {item.matched_keywords.length > 0 && item.status !== "covered" ? (
                  <div className="mt-2">
                    <SectionLabel>命中的特征关键词</SectionLabel>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {item.matched_keywords.map((keyword) => (
                        <span
                          key={keyword}
                          className="rounded-[var(--radius-xs)] bg-[var(--color-surface-sunken)] px-1.5 py-0.5 font-mono text-2xs text-[var(--color-ink-muted)]"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* --------------------------------------------------- recommendations */}
      <Card>
        <CardHeader
          title="建议补充的资料"
          description="按缺口类型生成的可执行清单，含建议责任方"
          icon={<FilePlus2 className="size-4" />}
          dense
          actions={
            <Link href="/knowledge/documents">
              <Button size="sm" variant="outline">
                去上传
              </Button>
            </Link>
          }
        />
        <CardContent>
          {report.recommended_documents.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="size-5" />}
              title="没有发现明显缺口"
              description="当前所有期望的资料类型都已覆盖。"
            />
          ) : (
            <div className="space-y-1.5">
              {report.recommended_documents.map((item, index) => (
                <div
                  key={`${item.category}-${index}`}
                  className="flex flex-wrap items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3.5 py-2.5"
                >
                  <Badge tone={item.priority === "P0" ? "danger" : "warning"}>{item.priority}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[var(--color-ink)]">{item.title}</p>
                    <p className="mt-0.5 text-2xs leading-relaxed text-[var(--color-ink-muted)]">
                      {item.reason}
                    </p>
                  </div>
                  <span className="shrink-0 text-2xs text-[var(--color-ink-faint)]">{item.owner}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
