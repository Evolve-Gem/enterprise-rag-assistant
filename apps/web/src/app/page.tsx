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
import { Card, CardContent, CardHeader, Kicker } from "@/components/ui/card";
import { BarChart, CompactMetric, Donut, StackedBar } from "@/components/ui/data";
import { HeroPanel } from "@/components/ui/hero-panel";
import { SectionAccordion } from "@/components/ui/section";
import { EmptyState, ErrorState, SkeletonGrid } from "@/components/ui/states";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { OverviewResponse } from "@/lib/types";
import {
  ACTIVITY_KIND_LABELS,
  cn,
  formatCount,
  formatMs,
  formatPercent,
  formatRelative,
  vizColor,
} from "@/lib/utils";

/* ------------------------------------------------------------------ content */

const ASK_EXAMPLE = "Rerank 在 RAG 检索链路里解决什么问题？";
const AGENT_EXAMPLE = "帮我分析当前知识库还缺少哪些售前资料。";
const SOLUTION_EXAMPLE = "某职业院校希望把招生政策、教务规定和学生事务答疑统一到一个知识库。";

/** The three things a first-time visitor can actually accomplish. */
const PRIMARY_ACTIONS = [
  {
    href: "/ask",
    english: "Ask",
    icon: MessageSquareText,
    title: "知识问答",
    description: "向企业知识库提问，AI 先检索资料，再基于真实证据回答。",
    short: "基于企业知识库提问，答案带来源",
    cta: "开始提问",
  },
  {
    href: "/agent",
    english: "Agent Workspace",
    icon: Workflow,
    title: "AI 任务",
    description: "告诉 Agent 你想完成什么，它自动识别任务并调用对应能力。",
    short: "描述目标，Agent 自动选择能力执行",
    cta: "运行 Agent",
  },
  {
    href: "/solution-studio",
    english: "Solution Studio",
    icon: FileText,
    title: "方案生成",
    description: "输入客户需求，自动形成结构化、可溯源的售前方案。",
    short: "输入客户需求，生成可溯源售前方案",
    cta: "生成方案",
  },
];

/**
 * Three real examples, used as a "try it" list.
 *
 * V5 reshaped this from a second row of three cards into a single divided
 * list: the page already opens with a three-column action rail, and two
 * identical card rows in a row is exactly the "template" reading this release
 * removes. A list of prompts reads as something *different* — a set of things
 * to say, not a set of places to go.
 */
const QUICK_START = [
  {
    title: "问一个知识问题",
    example: ASK_EXAMPLE,
    cta: "体验知识问答",
    href: `/ask?q=${encodeURIComponent(ASK_EXAMPLE)}`,
  },
  {
    title: "让 Agent 完成一个任务",
    example: AGENT_EXAMPLE,
    cta: "体验 AI Agent",
    href: `/agent?task=${encodeURIComponent(AGENT_EXAMPLE)}`,
  },
  {
    title: "生成一份售前方案",
    example: SOLUTION_EXAMPLE,
    cta: "体验方案生成",
    href: `/solution-studio?requirement=${encodeURIComponent(SOLUTION_EXAMPLE)}`,
  },
];

/** Deliberately terse — the entry rail above already says what you can do. */
const CAPABILITIES = [
  { icon: ShieldCheck, title: "可溯源问答", description: "关键结论带可点击来源" },
  { icon: Workflow, title: "任务执行", description: "Agent 自动选择能力与工具" },
  { icon: FileText, title: "方案生成", description: "结合需求与企业知识产出" },
  { icon: Search, title: "知识洞察", description: "看清覆盖了什么、缺什么" },
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
    <div className="space-y-5">
      <Hero />
      <PrimaryActions />
      <TryExamples />
      <HowItWorks />
      <DemoStatus />
    </div>
  );
}

/* -------------------------------------------------------------------- hero */

function Hero() {
  return (
    <HeroPanel
      aside={
        <>
          {/* Phone: a single compact status line. Height is load-bearing — this
              row plus the hero above it is what keeps the third entry card
              inside a 390x844 first screen. */}
          <div className="flex items-center gap-2 lg:hidden">
            <MascotHalo size={38}>
              <KnowledgeMascot state="idle" size={38} />
            </MascotHalo>
            <StatusPill />
          </div>

          {/* Desktop: the mascot as the AI status carrier — floating pose,
              breathing halo, labelled state. */}
          <div className="hidden flex-col items-center gap-2.5 lg:flex">
            <MascotHalo size={72} breathing>
              <div className="animate-float relative">
                <KnowledgeMascot state="idle" size={72} />
              </div>
            </MascotHalo>
            <StatusPill />
          </div>
        </>
      }
    >
      <p className="kicker kicker-stage">Enterprise RAG Copilot</p>
      <h1 className="mt-2.5 text-[27px] font-bold leading-[1.24] tracking-[-0.024em] text-[var(--color-stage-ink)] sm:text-[36px] lg:text-[40px]">
        让企业知识从「文件堆」
        <br className="hidden sm:block" />
        <span className="sm:hidden"> </span>
        变成可问、可查、可执行的 AI 工作台
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--color-stage-ink-soft)]">
        基于企业知识库，实现可溯源知识问答、AI Agent 任务执行与售前方案生成。
      </p>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Link href="/ask" className="sm:w-auto">
          <Button variant="primary" size="lg" className="w-full sm:w-auto">
            <MessageSquareText className="size-4" />
            立即提问
          </Button>
        </Link>
        <Link href="/agent" className="sm:w-auto">
          <Button variant="stage" size="lg" className="w-full sm:w-auto">
            <Workflow className="size-4" />
            体验 AI Agent
          </Button>
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <Badge tone="ink">Hybrid RAG</Badge>
        <Badge tone="ink">LangGraph</Badge>
        {/* The phone hero is height-critical and these two are engineering
            labels, not decisions: "Public Read-only Demo" was also wrapping
            onto a line of its own below md. */}
        <Badge tone="ink" className="max-sm:hidden">
          Citation
        </Badge>
        <Badge tone="ink" className="max-sm:hidden">
          Public Read-only Demo
        </Badge>
      </div>
    </HeroPanel>
  );
}

/* ---------------------------------------------------------- primary actions */

function PrimaryActions() {
  return (
    <>
      {/* Phone: three Compact Action Rows (~76px each) so all three entries fit
          the first screen. Not a shrunken card — one short line, no paragraph. */}
      <section className="space-y-2 md:hidden">
        {PRIMARY_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={`row-${action.href}`}
              href={action.href}
              className="flex min-h-[76px] items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 py-2.5 transition-colors duration-150 active:bg-[var(--color-accent-soft)]"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                <Icon className="size-5" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-tight text-[var(--color-ink)]">
                  {action.title}
                </span>
                <span className="mt-0.5 block truncate text-2xs text-[var(--color-ink-muted)]">
                  {action.short}
                </span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-[var(--color-ink-faint)]" />
            </Link>
          );
        })}
      </section>

      {/* Desktop: ONE connected rail instead of three floating cards.
          A three-column panel with interior hairlines reads as a designed
          component; three identical boxes read as a template. The rail sits a
          material level above the supporting bands below it, so it is
          unmistakably the page's primary action. */}
      <section className="hidden overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--elevation-2)] md:block">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--color-line-faint)] px-5 py-3">
          <Kicker rule className="flex-1">
            从这里开始 · Start here
          </Kicker>
          <p className="shrink-0 text-2xs text-[var(--color-ink-faint)]">三个入口，任选其一</p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-[var(--color-line-faint)]">
          {PRIMARY_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group relative flex flex-col gap-3 p-5 transition-colors duration-150 hover:bg-[var(--color-accent-soft)]/35"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                  <Icon className="size-5" strokeWidth={2} />
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-baseline gap-1.5">
                    <span className="text-[15px] font-semibold text-[var(--color-ink)]">
                      {action.title}
                    </span>
                    <span className="text-2xs text-[var(--color-ink-faint)]">{action.english}</span>
                  </span>
                  <span className="mt-1.5 block text-xs leading-relaxed text-[var(--color-ink-muted)]">
                    {action.description}
                  </span>
                </span>
                <span className="mt-auto inline-flex items-center gap-1.5 pt-1 text-xs font-medium text-[var(--color-accent)]">
                  {action.cta}
                  <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}

/* --------------------------------------------------------------- try-it list */

function TryExamples() {
  return (
    <section className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-line-faint)] bg-[var(--color-surface)]">
      <div className="flex items-start gap-2.5 border-b border-[var(--color-line-faint)] px-4 py-3 sm:px-5">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
          <Sparkles className="size-3.5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-[var(--color-ink)]">
            第一次来？用一条真实示例感受一下
          </h2>
          <p className="mt-0.5 text-2xs leading-relaxed text-[var(--color-ink-muted)]">
            不需要了解 RAG 或 Agent，任选一条开始。只填入示例，不会自动提问。
          </p>
        </div>
      </div>

      <ol className="divide-y divide-[var(--color-line-faint)]">
        {QUICK_START.map((item, index) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="group flex min-h-[64px] items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-[var(--color-surface-subtle)] sm:px-5"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-[var(--color-accent-line)] bg-[var(--color-accent-soft)] font-mono text-[10px] font-semibold text-[var(--color-accent-ink)]">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-[var(--color-ink)]">
                  {item.title}
                </span>
                <span className="mt-0.5 block truncate text-2xs text-[var(--color-ink-muted)]">
                  {item.example}
                </span>
              </span>
              <span className="hidden shrink-0 items-center gap-1.5 text-xs font-medium text-[var(--color-accent)] sm:inline-flex">
                {item.cta}
                <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
              </span>
              <ArrowRight className="size-4 shrink-0 text-[var(--color-ink-faint)] sm:hidden" />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------- capabilities */

/**
 * Renders the capability set as a tight strip.
 *
 * These four used to sit in their own section directly under three entry cards
 * that already said 知识问答 / AI 任务 / 方案生成 — the same three things twice.
 * Folding them in here keeps the information without paying a second block.
 */
function CapabilityStrip() {
  return (
    <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[var(--color-line-faint)] pt-3.5 lg:grid-cols-4">
      {CAPABILITIES.map((capability) => {
        const Icon = capability.icon;
        return (
          <li key={capability.title} className="flex min-w-0 items-center gap-1.5">
            <Icon className="size-3.5 shrink-0 text-[var(--color-accent)]" strokeWidth={2} />
            <span className="min-w-0 truncate text-2xs text-[var(--color-ink-soft)]">
              {capability.title}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------- how it works */

function HowItWorks() {
  return (
    <section className="rounded-[var(--radius-xl)] border border-[var(--color-line-faint)] bg-[var(--color-surface-subtle)] px-4 py-4 sm:px-5">
      <Kicker rule>How it works</Kicker>
      <h2 className="mt-2 text-[16px] font-semibold tracking-[-0.012em] text-[var(--color-ink)]">
        五步，把企业资料变成可验证的回答
      </h2>

      {/* Desktop: a real pipeline — numbered nodes on a connecting rail. It
          communicates "process" better than five boxes ever did, and it gives
          the page a second visual landmark under the hero. */}
      <ol className="relative mt-5 hidden grid-cols-5 gap-2 lg:grid">
        <span
          aria-hidden
          className="absolute left-[10%] right-[10%] top-[13px] h-px bg-[var(--color-line-strong)]/70"
        />
        {PIPELINE.map((step, index) => (
          <li key={step} className="relative flex flex-col items-center gap-2 text-center">
            <span className="relative z-10 flex size-7 items-center justify-center rounded-full border border-[var(--color-accent-line)] bg-[var(--color-surface)] font-mono text-[11px] font-semibold text-[var(--color-accent)]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="text-xs font-medium text-[var(--color-ink)]">{step}</span>
          </li>
        ))}
      </ol>

      {/* Phone: the same five steps as a compact numbered list. */}
      <ol className="mt-3.5 space-y-1.5 lg:hidden">
        {PIPELINE.map((step, index) => (
          <li key={step} className="flex items-center gap-2.5">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] font-mono text-[10px] font-semibold text-[var(--color-accent-ink)]">
              {index + 1}
            </span>
            <span className="text-xs font-medium text-[var(--color-ink)]">{step}</span>
          </li>
        ))}
      </ol>

      <CapabilityStrip />

      {/* Implementation layer folds away — it is detail, not the story. */}
      <SectionAccordion
        label="查看技术实现"
        description="资料解析 · 检索 · 融合 · 重排 · 生成 · 工作流"
        className="mt-3 border-0 bg-transparent"
        contentClassName="px-0"
      >
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {TECH_IMPL.map(([label, value]) => (
            <div
              key={label}
              className="flex items-baseline justify-between gap-3 border-b border-[var(--color-line-faint)] py-1 last:border-0"
            >
              <dt className="shrink-0 text-2xs text-[var(--color-ink-muted)]">{label}</dt>
              <dd className="min-w-0 truncate text-right font-mono text-2xs text-[var(--color-ink-soft)]">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </SectionAccordion>
    </section>
  );
}

/* --------------------------------------------------------------- demo status */

function DemoStatus() {
  const overviewQuery = useAsync<OverviewResponse>(() => api.overview(), []);

  return (
    <SectionAccordion
      label="查看完整 Demo 状态"
      description="实时指标 · 知识覆盖 · 资料分类 · 最近活动 · 最近文档与提问"
      icon={<Gauge className="size-4" />}
    >
      {overviewQuery.status === "loading" ? (
        <SkeletonGrid count={4} />
      ) : overviewQuery.status === "error" ? (
        <ErrorState error={overviewQuery.error} onRetry={overviewQuery.reload} compact />
      ) : (
        <DemoStatusBody overview={overviewQuery.data} />
      )}
    </SectionAccordion>
  );
}

/**
 * The instrument board.
 *
 * V5: twelve bordered metric boxes became ONE hairline grid. The `gap-px` +
 * shared-background trick draws true dividers no matter how the grid wraps,
 * and the numerals were promoted to the display style — this is the product's
 * data face, and a wall of identical small boxes was the least "designed"
 * surface on the page.
 */
function MetricBoard({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-large)] border border-[var(--color-line-faint)] bg-[var(--color-line-faint)]">
      <div className="grid grid-cols-2 gap-px sm:grid-cols-3 xl:grid-cols-6">{children}</div>
    </div>
  );
}

function MetricCell({ children }: { children: React.ReactNode }) {
  return <div className="bg-[var(--color-surface)] px-4 py-3">{children}</div>;
}

function DemoStatusBody({ overview }: { overview: OverviewResponse }) {
  const { knowledge, agent, rag, system } = overview;

  return (
    <div className="space-y-4">
      {!overview.data_available && overview.notes.length > 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-warning-line)] bg-[var(--color-warning-soft)] px-4 py-3">
          {overview.notes.map((note) => (
            <p key={note} className="text-xs leading-relaxed text-[var(--color-ink-soft)]">
              {note}
            </p>
          ))}
        </div>
      ) : null}

      <MetricBoard>
        <MetricCell>
          <CompactMetric
            plain
            size="lg"
            label="企业文档"
            value={formatCount(knowledge.document_count)}
            icon={<FileStack className="size-3.5" />}
            tone="accent"
          />
        </MetricCell>
        <MetricCell>
          <CompactMetric
            plain
            size="lg"
            label="知识块"
            value={formatCount(knowledge.chunk_count)}
            icon={<Boxes className="size-3.5" />}
          />
        </MetricCell>
        <MetricCell>
          <CompactMetric
            plain
            size="lg"
            label="知识检索"
            value={system.retriever_mode === "hybrid" ? "混合检索" : system.retriever_mode}
            icon={<Search className="size-3.5" />}
            tone="success"
          />
        </MetricCell>
        <MetricCell>
          <CompactMetric
            plain
            size="lg"
            label="Agent 运行"
            value={formatCount(agent.run_count)}
            hint={`成功率 ${formatPercent(agent.success_rate)}`}
            icon={<Workflow className="size-3.5" />}
          />
        </MetricCell>
        <MetricCell>
          <CompactMetric
            plain
            size="lg"
            label="问答次数"
            value={formatCount(rag.question_count)}
            hint={`引用 ${formatCount(rag.citation_count)} 处`}
            icon={<MessageSquareText className="size-3.5" />}
          />
        </MetricCell>
        <MetricCell>
          <CompactMetric
            plain
            size="lg"
            label="带来源回答"
            value={formatPercent(rag.grounded_rate)}
            icon={<ShieldCheck className="size-3.5" />}
            tone={rag.grounded_rate >= 0.8 ? "success" : "warning"}
          />
        </MetricCell>
        <MetricCell>
          <CompactMetric
            plain
            size="lg"
            label="平均响应"
            value={formatMs(rag.average_latency_ms)}
            hint={`平均引用 ${rag.average_citations} 条`}
            icon={<Gauge className="size-3.5" />}
          />
        </MetricCell>
        <MetricCell>
          <CompactMetric
            plain
            size="lg"
            label="业务能力"
            value={agent.skill_count}
            hint={`${agent.tool_count} 个可执行动作`}
            icon={<Sparkles className="size-3.5" />}
          />
        </MetricCell>
        <MetricCell>
          <CompactMetric
            plain
            size="lg"
            label="执行引擎"
            value={agent.engine === "langgraph" ? "LangGraph" : agent.engine}
            icon={<Activity className="size-3.5" />}
          />
        </MetricCell>
        <MetricCell>
          <CompactMetric
            plain
            size="lg"
            label="最近索引"
            value={formatRelative(knowledge.last_indexed_at)}
            hint={system.embedding_provider === "hashing" ? "离线哈希向量" : system.embedding_provider}
            icon={<Clock className="size-3.5" />}
          />
        </MetricCell>
        <MetricCell>
          <CompactMetric
            plain
            size="lg"
            label="检索模式"
            value={system.retriever_mode}
            hint={`${system.llm_provider} · ${system.llm_model}`}
            icon={<Database className="size-3.5" />}
          />
        </MetricCell>
        <MetricCell>
          <CompactMetric
            plain
            size="lg"
            label="累计 Tool 调用"
            value={formatCount(agent.tool_call_count)}
            icon={<Cpu className="size-3.5" />}
          />
        </MetricCell>
      </MetricBoard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
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
                  {(
                    [
                      ["已覆盖", overview.coverage_summary.covered],
                      ["部分覆盖", overview.coverage_summary.partial],
                      ["缺失", overview.coverage_summary.missing],
                    ] as const
                  ).map(([label, value]) => (
                    <li key={label} className="flex items-center justify-between">
                      <span className="text-[var(--color-ink-muted)]">{label}</span>
                      <span className="font-mono tabular-nums text-[var(--color-ink)]">
                        {String(value ?? 0)}
                      </span>
                    </li>
                  ))}
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
              <EmptyState title="暂无分类数据" description="上传文档并重建索引后会显示分类分布。" />
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
                      {ACTIVITY_KIND_LABELS[item.kind] ?? item.kind} ·{" "}
                      {formatRelative(item.created_at)}
                      {item.latency_ms ? ` · ${formatMs(item.latency_ms)}` : ""}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
              <EmptyState
                title="知识库为空"
                description="上传 Markdown / PDF / Word 文档后开始使用。"
              />
            ) : (
              overview.recent_documents.map((doc) => (
                <Link
                  key={doc.id}
                  href={`/knowledge/explorer?doc=${encodeURIComponent(doc.id)}`}
                  className="flex min-h-11 items-center gap-3 rounded-[var(--radius-md)] px-2 py-1.5 transition-colors hover:bg-[var(--color-surface-sunken)]"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-surface-sunken)] text-[var(--color-ink-faint)]">
                    <FileStack className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-[var(--color-ink)]">
                      {doc.name}
                    </span>
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
                    <span
                      className="block truncate text-xs text-[var(--color-ink-soft)]"
                      title={item.title}
                    >
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

/* ------------------------------------------------------------ hero furniture */

/**
 * A soft halo behind the mascot.
 *
 * Two stacked radials rather than one: a tighter core so the character reads as
 * emitting light, plus a wider and weaker field so it sits inside an
 * environment. Both stay under 20% alpha — lit, not radioactive. On the stage
 * this is the one warm point of the composition.
 */
function MascotHalo({
  size,
  children,
  breathing = false,
}: {
  size: number;
  children: React.ReactNode;
  breathing?: boolean;
}) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        aria-hidden
        className={cn("absolute -inset-3 rounded-full", breathing && "animate-breathe")}
        style={{
          background:
            "radial-gradient(circle, var(--aurora-violet) 0%, transparent 66%)," +
            "radial-gradient(circle, var(--aurora-indigo) 0%, transparent 84%)",
          filter: "blur(10px)",
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

/**
 * The AI status pill.
 *
 * Carries a live-looking indicator — an expanding ring plus a solid core — so
 * the hero states a fact about the system instead of decorating a corner. Same
 * height as the V4.1 pill, so nothing below it moves.
 */
function StatusPill() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-stage-line-strong)] bg-[rgb(255_255_255/0.06)] px-2.5 py-1 text-2xs text-[var(--color-stage-ink-soft)] backdrop-blur">
      <span className="relative flex size-1.5 shrink-0 items-center justify-center">
        <span
          aria-hidden
          className="animate-pulse-ring absolute inline-flex size-1.5 rounded-full"
          style={{ background: "#5fdd90" }}
        />
        <span className="relative inline-flex size-1.5 rounded-full" style={{ background: "#5fdd90" }} />
      </span>
      AI Copilot 已就绪
    </span>
  );
}
