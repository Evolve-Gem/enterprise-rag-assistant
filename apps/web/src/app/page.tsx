"use client";

import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Boxes,
  Clock,
  Cpu,
  Database,
  FileStack,
  Gauge,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import Link from "next/link";

import { KnowledgeMascot } from "@/components/mascot/knowledge-mascot";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, SectionLabel } from "@/components/ui/card";
import { BarChart, Donut, StackedBar, StatCard } from "@/components/ui/data";
import { EmptyState, ErrorState, SkeletonGrid } from "@/components/ui/states";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { OverviewResponse } from "@/lib/types";
import { ACTIVITY_KIND_LABELS, formatCount, formatMs, formatPercent, formatRelative, vizColor } from "@/lib/utils";

const ACTION_ICONS: Record<string, typeof MessageSquareText> = {
  ask: MessageSquareText,
  upload: FileStack,
  solution: Sparkles,
  agent: Workflow,
  gaps: Boxes,
};

export default function OverviewPage() {
  const overviewQuery = useAsync<OverviewResponse>(() => api.overview(), []);

  if (overviewQuery.status === "loading") {
    return (
      <div className="space-y-5">
        <SkeletonGrid count={4} />
        <SkeletonGrid count={4} />
      </div>
    );
  }

  if (overviewQuery.status === "error") {
    return <ErrorState error={overviewQuery.error} onRetry={overviewQuery.reload} />;
  }

  const overview = overviewQuery.data;
  const { knowledge, agent, rag, system } = overview;

  return (
    <div className="space-y-5">
      {/* ---------------------------------------------------------- hero */}
      <section className="relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-6">
        <div
          className="pointer-events-none absolute -right-12 -top-16 size-64 rounded-full opacity-[0.07]"
          style={{ background: "radial-gradient(circle, var(--color-accent) 0%, transparent 68%)" }}
          aria-hidden
        />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="min-w-0 max-w-2xl space-y-2">
            <div className="flex items-center gap-2">
              <Badge tone="accent">
                <Sparkles className="size-3" />v{system.version}
              </Badge>
              <Badge tone={system.llm_configured ? "success" : "warning"}>
                <StatusDot tone={system.llm_configured ? "success" : "warning"} />
                {system.llm_provider} · {system.llm_model}
              </Badge>
              {system.read_only ? (
                <Badge tone="warning">
                  <ShieldCheck className="size-3" />
                  只读模式
                </Badge>
              ) : null}
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-[var(--color-ink)]">
              Enterprise RAG Copilot
            </h2>
            <p className="text-sm leading-relaxed text-[var(--color-ink-muted)]">
              企业知识智能与售前 Agent 工作台。检索链路为
              <span className="mx-1 font-medium text-[var(--color-ink-soft)]">
                {system.retriever_mode}
              </span>
              （BM25 + 向量 + RRF 融合 + 重排序），回答中的每条事实都标注了可点击的引用来源。
            </p>
          </div>
          <KnowledgeMascot state="idle" size={96} withLabel />
        </div>

        {/* quick actions */}
        <div className="relative mt-5 flex flex-wrap gap-2">
          {overview.quick_actions.map((action) => {
            const Icon = ACTION_ICONS[action.id] ?? ArrowUpRight;
            const disabled = !action.enabled;
            return disabled ? (
              <span
                key={action.id}
                title={action.description}
                className="inline-flex cursor-not-allowed items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-1.5 text-xs text-[var(--color-ink-faint)]"
              >
                <Icon className="size-3.5" />
                {action.label}
              </span>
            ) : (
              <Link
                key={action.id}
                href={action.href}
                title={action.description}
                className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-1.5 text-xs text-[var(--color-ink-soft)] transition-colors hover:border-[var(--color-accent-line)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent-ink)]"
              >
                <Icon className="size-3.5" />
                {action.label}
              </Link>
            );
          })}
        </div>
      </section>

      {!overview.data_available && overview.notes.length > 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-warning-line)] bg-[var(--color-warning-soft)] px-4 py-3">
          {overview.notes.map((note) => (
            <p key={note} className="text-xs leading-relaxed text-[var(--color-ink-soft)]">
              {note}
            </p>
          ))}
        </div>
      ) : null}

      {/* ------------------------------------------------------ knowledge */}
      <section className="space-y-3">
        <SectionLabel>Knowledge Base</SectionLabel>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="文档"
            value={formatCount(knowledge.document_count)}
            hint={`已索引 ${knowledge.indexed_document_count} · 共 ${formatCount(knowledge.total_chars)} 字符`}
            icon={<FileStack className="size-4" />}
            tone="accent"
          />
          <StatCard
            label="知识块"
            value={formatCount(knowledge.chunk_count)}
            hint="按标题切分并保留章节路径"
            icon={<Boxes className="size-4" />}
          />
          <StatCard
            label="索引状态"
            value={
              knowledge.index_state === "ready"
                ? "就绪"
                : knowledge.index_state === "empty"
                  ? "空"
                  : knowledge.index_state
            }
            hint={overview.system.embedding_model}
            icon={<Database className="size-4" />}
            tone={knowledge.index_state === "ready" ? "success" : "warning"}
          />
          <StatCard
            label="最近索引"
            value={formatRelative(knowledge.last_indexed_at)}
            hint={system.embedding_provider === "hashing" ? "离线哈希向量" : system.embedding_provider}
            icon={<Clock className="size-4" />}
          />
        </div>
      </section>

      {/* ---------------------------------------------------------- agent */}
      <section className="space-y-3">
        <SectionLabel>Agent</SectionLabel>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Agent 运行"
            value={formatCount(agent.run_count)}
            hint={`成功率 ${formatPercent(agent.success_rate)}`}
            icon={<Workflow className="size-4" />}
            tone="accent"
          />
          <StatCard
            label="可用 Skill"
            value={agent.skill_count}
            hint="意图 → Skill → Tool 三层"
            icon={<Sparkles className="size-4" />}
          />
          <StatCard
            label="可用 Tool"
            value={agent.tool_count}
            hint={`累计调用 ${formatCount(agent.tool_call_count)} 次`}
            icon={<Cpu className="size-4" />}
          />
          <StatCard
            label="执行引擎"
            value={agent.engine}
            hint="LangGraph 与内置状态机共用同一套节点"
            icon={<Activity className="size-4" />}
          />
        </div>
      </section>

      {/* ------------------------------------------------------------ rag */}
      <section className="space-y-3">
        <SectionLabel>RAG</SectionLabel>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="问答次数"
            value={formatCount(rag.question_count)}
            hint={`已记录 ${rag.answered_count} 次完整执行`}
            icon={<MessageSquareText className="size-4" />}
            tone="accent"
          />
          <StatCard
            label="召回片段"
            value={formatCount(rag.retrieval_hit_count)}
            hint={`引用 ${formatCount(rag.citation_count)} 处`}
            icon={<Boxes className="size-4" />}
          />
          <StatCard
            label="平均延迟"
            value={formatMs(rag.average_latency_ms)}
            hint={`平均引用 ${rag.average_citations} 条`}
            icon={<Gauge className="size-4" />}
          />
          <StatCard
            label="溯源率"
            value={formatPercent(rag.grounded_rate)}
            hint="回答包含有效引用编号的比例"
            icon={<ShieldCheck className="size-4" />}
            tone={rag.grounded_rate >= 0.8 ? "success" : "warning"}
          />
        </div>
      </section>

      {/* -------------------------------------------------- detail panels */}
      <div className="grid gap-5 xl:grid-cols-3">
        {/* coverage */}
        <Card className="xl:col-span-1">
          <CardHeader
            title="知识覆盖"
            description="按预设资料类型的规则化覆盖判定"
            icon={<BookOpen className="size-4" />}
            dense
          />
          <CardContent className="space-y-4">
            <div className="flex items-center gap-5">
              <Donut
                value={Number(overview.coverage_summary.coverage_ratio ?? 0)}
                label={formatPercent(Number(overview.coverage_summary.coverage_ratio ?? 0))}
                sublabel="完全覆盖"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <StackedBar
                  segments={[
                    {
                      label: "已覆盖",
                      value: Number(overview.coverage_summary.covered ?? 0),
                      color: "var(--color-success)",
                    },
                    {
                      label: "部分覆盖",
                      value: Number(overview.coverage_summary.partial ?? 0),
                      color: "var(--color-warning)",
                    },
                    {
                      label: "缺失",
                      value: Number(overview.coverage_summary.missing ?? 0),
                      color: "var(--color-danger)",
                    },
                  ]}
                />
                <ul className="space-y-1 text-xs">
                  <li className="flex items-center justify-between">
                    <span className="text-[var(--color-ink-muted)]">已覆盖</span>
                    <span className="font-mono tabular-nums text-[var(--color-ink)]">
                      {String(overview.coverage_summary.covered ?? 0)}
                    </span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-[var(--color-ink-muted)]">部分覆盖</span>
                    <span className="font-mono tabular-nums text-[var(--color-ink)]">
                      {String(overview.coverage_summary.partial ?? 0)}
                    </span>
                  </li>
                  <li className="flex items-center justify-between">
                    <span className="text-[var(--color-ink-muted)]">缺失</span>
                    <span className="font-mono tabular-nums text-[var(--color-ink)]">
                      {String(overview.coverage_summary.missing ?? 0)}
                    </span>
                  </li>
                </ul>
              </div>
            </div>
            <Link href="/insights/gaps" className="block">
              <Button size="sm" variant="outline" className="w-full">
                查看缺口详情与补录建议
                <ArrowUpRight className="size-3.5" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* category breakdown */}
        <Card>
          <CardHeader
            title="资料分类分布"
            description="由文件名与正文关键词规则判定"
            icon={<Boxes className="size-4" />}
            dense
          />
          <CardContent>
            {Object.keys(knowledge.category_breakdown).length === 0 ? (
              <EmptyState
                title="暂无分类数据"
                description="上传文档并重建索引后会显示分类分布。"
              />
            ) : (
              <BarChart
                data={Object.entries(knowledge.category_breakdown)
                  .sort((a, b) => b[1] - a[1])
                  .map(([label, value], index) => ({
                    label,
                    value,
                    tone: vizColor(index),
                  }))}
              />
            )}
          </CardContent>
        </Card>

        {/* recent activity */}
        <Card>
          <CardHeader
            title="最近活动"
            description="来自 SQLite 活动台账"
            icon={<Activity className="size-4" />}
            dense
            actions={
              <Link
                href="/insights/activity"
                className="text-2xs text-[var(--color-accent)] hover:underline"
              >
                全部
              </Link>
            }
          />
          <CardContent className="space-y-1.5">
            {overview.recent_activity.length === 0 ? (
              <EmptyState
                icon={<Activity className="size-5" />}
                title="暂无运行记录"
                description="发起一次问答或运行一次 Agent 后，这里会出现真实记录。"
              />
            ) : (
              overview.recent_activity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2.5 border-b border-[var(--color-line-faint)] py-1.5 last:border-0"
                >
                  <StatusDot
                    tone={item.status === "success" ? "success" : "danger"}
                    className="mt-1.5"
                    label={item.status}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-[var(--color-ink-soft)]" title={item.title}>
                      {item.title}
                    </p>
                    <p className="text-2xs text-[var(--color-ink-faint)]">
                      {ACTIVITY_KIND_LABELS[item.kind] ?? item.kind} · {formatRelative(item.created_at)}
                      {item.latency_ms ? ` · ${formatMs(item.latency_ms)}` : ""}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* ------------------------------------------- recent documents row */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="最近更新的文档"
            description="按文件修改时间排序"
            icon={<FileStack className="size-4" />}
            dense
            actions={
              <Link
                href="/knowledge/documents"
                className="text-2xs text-[var(--color-accent)] hover:underline"
              >
                管理
              </Link>
            }
          />
          <CardContent className="space-y-1">
            {overview.recent_documents.length === 0 ? (
              <EmptyState title="知识库为空" description="上传 Markdown / PDF / Word 文档后开始使用。" />
            ) : (
              overview.recent_documents.map((doc) => (
                <Link
                  key={doc.id}
                  href={`/knowledge/explorer?doc=${encodeURIComponent(doc.id)}`}
                  className="flex items-center gap-3 rounded-[var(--radius-md)] px-2 py-2 transition-colors hover:bg-[var(--color-surface-sunken)]"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-surface-sunken)] text-[var(--color-ink-faint)]">
                    <FileStack className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-[var(--color-ink)]">{doc.name}</span>
                    <span className="block text-2xs text-[var(--color-ink-faint)]">
                      {doc.category} · {doc.chunks} 个知识块
                    </span>
                  </span>
                  <span className="shrink-0 text-2xs text-[var(--color-ink-faint)]">
                    {formatRelative(doc.modified_at)}
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="最近提问"
            description="问答链路的问题记录与延迟"
            icon={<MessageSquareText className="size-4" />}
            dense
            actions={
              <Link href="/ask" className="text-2xs text-[var(--color-accent)] hover:underline">
                去提问
              </Link>
            }
          />
          <CardContent className="space-y-1">
            {overview.recent_questions.length === 0 ? (
              <EmptyState
                icon={<MessageSquareText className="size-5" />}
                title="还没有提问记录"
                description="在 Ask 页面提问后，问题、耗时与引用数会记录在这里。"
              />
            ) : (
              overview.recent_questions.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-[var(--radius-md)] px-2 py-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-[var(--color-ink-soft)]" title={item.title}>
                      {item.title}
                    </span>
                    <span className="block text-2xs text-[var(--color-ink-faint)]">
                      {formatRelative(item.created_at)} · {formatMs(item.latency_ms)} ·{" "}
                      {item.citations} 条引用
                    </span>
                  </span>
                  {item.status !== "success" ? <Badge tone="danger">失败</Badge> : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
