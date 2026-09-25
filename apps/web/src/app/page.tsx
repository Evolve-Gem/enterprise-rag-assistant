"use client";

import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Boxes,
  Clock,
  Cpu,
  Database,
  FileStack,
  FileText,
  Gauge,
  MessageSquareText,
  Search,
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
import {
  ACTIVITY_KIND_LABELS,
  formatCount,
  formatMs,
  formatPercent,
  formatRelative,
  vizColor,
} from "@/lib/utils";

/* ------------------------------------------------------------------ content */

/** The three things a first-time visitor can actually accomplish. */
const PRIMARY_ACTIONS = [
  {
    href: "/ask",
    english: "Ask",
    icon: MessageSquareText,
    title: "知识问答",
    description: "向企业知识库提问，AI 会先检索资料，再基于真实证据回答。",
    cta: "开始提问",
  },
  {
    href: "/agent",
    english: "Agent Workspace",
    icon: Workflow,
    title: "AI 任务",
    description: "告诉 Agent 你想完成什么，它会自动识别任务并调用对应能力。",
    cta: "运行 Agent",
  },
  {
    href: "/solution-studio",
    english: "Solution Studio",
    icon: FileText,
    title: "方案生成",
    description: "输入客户需求，自动形成结构化、可溯源的售前方案。",
    cta: "生成方案",
  },
];

const ASK_EXAMPLE = "Rerank 在 RAG 检索链路里解决什么问题？";
const AGENT_EXAMPLE = "帮我分析当前知识库还缺少哪些售前资料。";
const SOLUTION_EXAMPLE =
  "某职业院校希望把招生政策、教务规定和学生事务答疑统一到一个知识库，希望减少重复人工解答，预算有限，计划先小范围试点。";

/** Three independent entry points — deliberately not a chained tutorial. */
const QUICK_START = [
  {
    step: "Step 1",
    title: "问一个企业知识问题",
    example: ASK_EXAMPLE,
    flow: ["检索企业知识", "筛选证据", "生成回答", "标注来源"],
    cta: "体验知识问答",
    href: `/ask?q=${encodeURIComponent(ASK_EXAMPLE)}`,
  },
  {
    step: "Step 2",
    title: "让 Agent 完成一个任务",
    example: AGENT_EXAMPLE,
    flow: ["任务理解", "意图识别", "选择能力", "调用工具", "执行结果"],
    cta: "体验 AI Agent",
    href: `/agent?task=${encodeURIComponent(AGENT_EXAMPLE)}`,
  },
  {
    step: "Step 3",
    title: "生成一份售前方案",
    example: SOLUTION_EXAMPLE,
    flow: ["需求解析", "检索企业知识", "组织章节", "标注引用"],
    cta: "体验方案生成",
    href: `/solution-studio?requirement=${encodeURIComponent(SOLUTION_EXAMPLE)}`,
  },
];

const CAPABILITIES = [
  {
    icon: ShieldCheck,
    english: "Grounded Q&A",
    title: "可溯源知识问答",
    description: "回答中的关键结论带有可点击来源，可以直接查看原始知识片段。",
    href: "/ask",
  },
  {
    icon: Workflow,
    english: "Agent Execution",
    title: "AI 任务执行",
    description: "Agent 自动识别任务，选择业务能力并执行对应 Tool。",
    href: "/agent",
  },
  {
    icon: FileText,
    english: "Solution Generation",
    title: "售前方案生成",
    description: "结合客户需求与企业知识，生成结构化解决方案。",
    href: "/solution-studio",
  },
  {
    icon: Search,
    english: "Knowledge Insights",
    title: "知识洞察",
    description: "分析当前知识资产的覆盖情况，识别缺失资料并给出补充建议。",
    href: "/insights/gaps",
  },
];

const PIPELINE = ["企业资料", "知识检索", "证据筛选", "AI 生成", "可验证结果"];

const TECH_IMPL: [string, string][] = [
  ["企业资料", "Markdown / PDF / DOCX"],
  ["知识检索", "BM25 + Vector"],
  ["证据融合", "RRF"],
  ["证据排序", "Heuristic Rerank"],
  ["AI 生成", "DeepSeek"],
  ["工作流", "LangGraph Agent"],
];

/* -------------------------------------------------------------------- page */

export default function HomePage() {
  return (
    <div className="space-y-6">
      <Hero />
      <PrimaryActions />
      <QuickStart />
      <Capabilities />
      <HowItWorks />
      <DemoStatus />
    </div>
  );
}

/* -------------------------------------------------------------------- hero */

function Hero() {
  return (
    <section className="relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-6 sm:px-7 sm:py-8">
      <div
        className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full opacity-[0.07]"
        style={{ background: "radial-gradient(circle, var(--color-accent) 0%, transparent 68%)" }}
        aria-hidden
      />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          <p className="text-2xs font-semibold tracking-[0.14em] text-[var(--color-accent)]">
            ENTERPRISE RAG COPILOT
          </p>
          <h1 className="mt-2 text-2xl font-bold leading-snug tracking-tight text-[var(--color-ink)] sm:text-[28px]">
            让企业知识从「文件堆」
            <br className="hidden sm:block" />
            变成可问、可查、可执行的 AI 工作台
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-ink-muted)]">
            基于企业知识库，实现可溯源知识问答、AI Agent 任务执行与售前方案生成。
          </p>

          {/* Deliberately low visual weight: useful to a technical reader,
              noise to everyone else. */}
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <span className="text-2xs text-[var(--color-ink-faint)]">技术栈</span>
            <Badge tone="neutral">Hybrid RAG</Badge>
            <Badge tone="neutral">LangGraph</Badge>
            <Badge tone="neutral">公开只读 Demo</Badge>
          </div>
        </div>
        <div className="hidden shrink-0 lg:block">
          <KnowledgeMascot state="idle" size={104} withLabel />
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- primary actions */

/**
 * The three primary entry points.
 *
 * Laid out as three equal cards on desktop and stacked on phones, because the
 * most common way in is a QR code scanned on a phone.
 */
function PrimaryActions() {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {PRIMARY_ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.href}
            href={action.href}
            className="group flex flex-col rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 transition-colors duration-150 hover:border-[var(--color-accent-line)] hover:bg-[var(--color-accent-soft)]/40"
          >
            <span className="flex size-10 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
              <Icon className="size-5" strokeWidth={2} />
            </span>
            <span className="mt-3.5 flex items-baseline gap-2">
              <span className="text-base font-semibold text-[var(--color-ink)]">
                {action.title}
              </span>
              <span className="text-2xs text-[var(--color-ink-faint)]">{action.english}</span>
            </span>
            <span className="mt-1.5 flex-1 text-sm leading-relaxed text-[var(--color-ink-muted)]">
              {action.description}
            </span>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-accent)]">
              {action.cta}
              <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" />
            </span>
          </Link>
        );
      })}
    </section>
  );
}

/* --------------------------------------------------------------- quickstart */

function QuickStart() {
  return (
    <section className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-5 sm:px-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[var(--color-ink)]">
            第一次来？3 分钟体验 Enterprise RAG Copilot
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-muted)]">
            不需要了解 RAG 或 Agent，跟着三个真实任务体验即可。三个入口互相独立，任选一个开始。
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {QUICK_START.map((item) => (
          <div
            key={item.step}
            className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-canvas)] p-4"
          >
            <p className="text-2xs font-semibold tracking-[0.08em] text-[var(--color-accent)]">
              {item.step}
            </p>
            <p className="mt-1.5 text-sm font-semibold text-[var(--color-ink)]">{item.title}</p>

            <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2">
              <p className="text-2xs text-[var(--color-ink-faint)]">示例</p>
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-ink-soft)]">
                {item.example}
              </p>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1">
              {item.flow.map((step, index) => (
                <span key={step} className="flex items-center gap-1.5">
                  {index > 0 ? (
                    <span aria-hidden className="text-[var(--color-ink-faint)]">
                      →
                    </span>
                  ) : null}
                  <span className="text-2xs text-[var(--color-ink-muted)]">{step}</span>
                </span>
              ))}
            </div>

            <Link href={item.href} className="mt-4 block">
              <Button variant="outline" size="sm" className="w-full">
                {item.cta}
                <ArrowRight className="size-3.5" />
              </Button>
            </Link>
            <p className="mt-2 text-center text-[10px] text-[var(--color-ink-faint)]">
              只填入示例内容，不会自动提问
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- capabilities */

function Capabilities() {
  return (
    <section className="space-y-3">
      <SectionLabel>核心能力</SectionLabel>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {CAPABILITIES.map((capability) => {
          const Icon = capability.icon;
          return (
            <Link
              key={capability.href}
              href={capability.href}
              className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4 transition-colors duration-150 hover:border-[var(--color-line-strong)]"
            >
              <Icon className="size-4 text-[var(--color-accent)]" strokeWidth={2} />
              <p className="mt-2.5 text-sm font-semibold text-[var(--color-ink)]">
                {capability.title}
              </p>
              <p className="mt-1 text-2xs leading-relaxed text-[var(--color-ink-muted)]">
                {capability.description}
              </p>
              <p className="mt-2 text-[10px] text-[var(--color-ink-faint)]">
                {capability.english}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- how it works */

/**
 * Product-level pipeline first, implementation second.
 *
 * A visitor reads "企业资料 → 知识检索 → …" and understands the shape of the
 * system; the engineering terms sit underneath for the reader who wants them.
 */
function HowItWorks() {
  return (
    <section className="space-y-3">
      <SectionLabel>它是怎么工作的</SectionLabel>
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch lg:gap-0">
          {PIPELINE.map((step, index) => (
            <div key={step} className="flex flex-1 items-center gap-2 lg:flex-col lg:gap-3">
              <div className="flex flex-1 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-canvas)] px-3 py-2.5 lg:w-full lg:flex-none">
                <span className="text-xs font-medium text-[var(--color-ink)]">{step}</span>
              </div>
              {index < PIPELINE.length - 1 ? (
                <span
                  aria-hidden
                  className="shrink-0 text-[var(--color-ink-faint)] lg:rotate-90"
                >
                  →
                </span>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-5 border-t border-[var(--color-line-faint)] pt-4">
          <p className="text-2xs font-semibold tracking-[0.08em] text-[var(--color-ink-faint)]">
            技术实现
          </p>
          <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {TECH_IMPL.map(([label, value]) => (
              <div
                key={label}
                className="flex items-baseline justify-between gap-3 border-b border-[var(--color-line-faint)] py-1 last:border-0 sm:last:border-b"
              >
                <dt className="shrink-0 text-2xs text-[var(--color-ink-muted)]">{label}</dt>
                <dd className="min-w-0 truncate text-right font-mono text-2xs text-[var(--color-ink-soft)]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- demo status */

/** Live figures from the running instance — below the fold, never the headline. */
function DemoStatus() {
  const overviewQuery = useAsync<OverviewResponse>(() => api.overview(), []);

  if (overviewQuery.status === "loading") {
    return (
      <section className="space-y-3">
        <SectionLabel>当前 Demo 状态</SectionLabel>
        <SkeletonGrid count={4} />
      </section>
    );
  }

  if (overviewQuery.status === "error") {
    return (
      <section className="space-y-3">
        <SectionLabel>当前 Demo 状态</SectionLabel>
        <ErrorState error={overviewQuery.error} onRetry={overviewQuery.reload} compact />
      </section>
    );
  }

  const overview = overviewQuery.data;
  const { knowledge, agent, rag, system } = overview;

  return (
    <>
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <SectionLabel>当前 Demo 状态</SectionLabel>
          <p className="text-2xs text-[var(--color-ink-faint)]">
            以下数字全部来自运行中的实例，实时接口返回
          </p>
        </div>

        {!overview.data_available && overview.notes.length > 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-warning-line)] bg-[var(--color-warning-soft)] px-4 py-3">
            {overview.notes.map((note) => (
              <p key={note} className="text-xs leading-relaxed text-[var(--color-ink-soft)]">
                {note}
              </p>
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard
            label="企业文档"
            value={formatCount(knowledge.document_count)}
            hint={`已索引 ${knowledge.indexed_document_count} 篇`}
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
            label="知识检索"
            value={system.retriever_mode === "hybrid" ? "混合检索" : system.retriever_mode}
            hint="关键词 + 向量 + 融合 + 重排"
            icon={<Search className="size-4" />}
            tone="success"
          />
          <StatCard
            label="最近索引"
            value={formatRelative(knowledge.last_indexed_at)}
            hint={system.embedding_provider === "hashing" ? "离线哈希向量" : system.embedding_provider}
            icon={<Clock className="size-4" />}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard
            label="Agent 运行"
            value={formatCount(agent.run_count)}
            hint={`成功率 ${formatPercent(agent.success_rate)}`}
            icon={<Workflow className="size-4" />}
            tone="accent"
          />
          <StatCard
            label="业务能力"
            value={agent.skill_count}
            hint="每个能力组织一类业务流程"
            icon={<Sparkles className="size-4" />}
          />
          <StatCard
            label="可执行动作"
            value={agent.tool_count}
            hint={`累计调用 ${formatCount(agent.tool_call_count)} 次`}
            icon={<Cpu className="size-4" />}
          />
          <StatCard
            label="问答次数"
            value={formatCount(rag.question_count)}
            hint={`引用 ${formatCount(rag.citation_count)} 处`}
            icon={<MessageSquareText className="size-4" />}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard
            label="平均响应"
            value={formatMs(rag.average_latency_ms)}
            hint={`平均引用 ${rag.average_citations} 条`}
            icon={<Gauge className="size-4" />}
          />
          <StatCard
            label="带来源回答比例"
            value={formatPercent(rag.grounded_rate)}
            hint="回答包含有效引用编号的比例"
            icon={<ShieldCheck className="size-4" />}
            tone={rag.grounded_rate >= 0.8 ? "success" : "warning"}
          />
          <StatCard
            label="执行引擎"
            value={agent.engine === "langgraph" ? "LangGraph" : agent.engine}
            hint="与内置状态机共用同一套节点"
            icon={<Activity className="size-4" />}
          />
          <StatCard
            label="检索模式"
            value={system.retriever_mode}
            hint={`${system.llm_provider} · ${system.llm_model}`}
            icon={<Database className="size-4" />}
          />
        </div>
      </section>

      {/* ------------------------------------------------- detail panels */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader
            title="知识覆盖"
            description="按资料类型的规则化覆盖判定"
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
                查看知识洞察
                <ArrowUpRight className="size-3.5" />
              </Button>
            </Link>
          </CardContent>
        </Card>

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

        <Card>
          <CardHeader
            title="最近活动"
            description="来自运行台账"
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
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
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
            description="问答链路的问题记录与耗时"
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
                description="在知识问答里提问后，问题、耗时与引用数会记录在这里。"
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
    </>
  );
}
