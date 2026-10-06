"use client";

import { AlertOctagon, Boxes, CheckCircle2, FilePlus2, Target } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/card";
import { CompactMetric, Donut, StackedBar } from "@/components/ui/data";
import { PageIntro } from "@/components/ui/page-intro";
import {
  MainTaskBody,
  MainTaskHeader,
  MainTaskPanel,
  ResultSection,
  SectionAccordion,
} from "@/components/ui/section";
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

/** P0 排最前，其余保持后端返回顺序。 */
const PRIORITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2 };

/** 首屏只铺前几条补充建议，其余收进折叠区。 */
const TOP_RECOMMENDATIONS = 3;

export default function GapsPage() {
  const query = useAsync<GapReport>(() => api.gaps(), []);

  if (query.status === "loading") return <SkeletonGrid count={3} />;
  if (query.status === "error") return <ErrorState error={query.error} onRetry={query.reload} />;

  const report = query.data;
  const totalTypes = report.covered.length + report.partial.length + report.missing.length;

  const recommendations = [...report.recommended_documents].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9),
  );
  const topRecommendations = recommendations.slice(0, TOP_RECOMMENDATIONS);
  const restRecommendations = recommendations.slice(TOP_RECOMMENDATIONS);

  const uploadAction = (
    <Link href="/knowledge/documents">
      <Button size="sm" variant="outline">
        去上传
      </Button>
    </Link>
  );

  return (
    <div className="space-y-5">
      <PageIntro
        title="知识洞察"
        subtitle="按预设资料类型核对当前知识库覆盖了什么、还缺什么，并给出可执行的补充清单。"
      />

      {/* --------------------------------------------- summary · 主任务 */}
      <MainTaskPanel>
        <MainTaskHeader
          title="知识覆盖总览"
          description="完全覆盖的类型数 ÷ 期望类型总数"
          icon={<Target className="size-4" />}
          actions={uploadAction}
        />
        <MainTaskBody className="space-y-4">
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
              <p className="text-2xs text-[var(--color-ink-muted)]">
                已覆盖 {report.covered.length} · 部分覆盖 {report.partial.length} · 缺失{" "}
                {report.missing.length}（期望类型共 {totalTypes}）
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <CompactMetric
              label="已覆盖"
              value={report.covered.length}
              hint="covered"
              tone="success"
              icon={<CheckCircle2 className="size-3.5" />}
            />
            <CompactMetric
              label="部分覆盖"
              value={report.partial.length}
              hint="partial"
              tone="warning"
              icon={<AlertOctagon className="size-3.5" />}
            />
            <CompactMetric
              label="缺失"
              value={report.missing.length}
              hint="missing"
              tone="danger"
              icon={<Target className="size-3.5" />}
            />
            <CompactMetric
              label="分析文档数"
              value={formatCount(report.analyzed_document_count)}
              hint={`${formatCount(report.analyzed_chunk_count)} 个知识块`}
              tone="accent"
              icon={<Boxes className="size-3.5" />}
            />
          </div>

          <p className="text-2xs leading-relaxed text-[var(--color-ink-faint)]">
            该比例是「完全覆盖的类型数 ÷ 期望类型总数」的简单计数：基于规则与真实资料匹配，不是 AI
            随机评分，也不代表内容质量的百分比。
          </p>
        </MainTaskBody>
      </MainTaskPanel>

      {/* --------------------------------------------- 优先补充建议 */}
      <ResultSection
        label="优先补充建议"
        meta={recommendations.length ? `${recommendations.length} 条 · P0 优先` : undefined}
        icon={<FilePlus2 className="size-4" />}
        actions={uploadAction}
      >
        {recommendations.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="size-5" />}
            title="没有发现明显缺口"
            description="当前所有期望的资料类型都已覆盖。"
          />
        ) : (
          <div className="space-y-1.5">
            {topRecommendations.map((item, index) => (
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
      </ResultSection>

      {restRecommendations.length > 0 ? (
        <SectionAccordion
          label="查看全部补充建议"
          description={`另有 ${restRecommendations.length} 条`}
          icon={<FilePlus2 className="size-4" />}
        >
          <div className="space-y-1.5">
            {restRecommendations.map((item, index) => (
              <div
                key={`${item.category}-rest-${index}`}
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
        </SectionAccordion>
      ) : null}

      {/* --------------------------------------------- 完整判定依据 · 折叠 */}
      <SectionAccordion
        label="查看完整覆盖判定依据"
        description={`${report.coverage.length} 个类型逐条给出证据文档与判定理由`}
        icon={<Target className="size-4" />}
      >
        <div className="space-y-2">
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
        </div>
      </SectionAccordion>
    </div>
  );
}
