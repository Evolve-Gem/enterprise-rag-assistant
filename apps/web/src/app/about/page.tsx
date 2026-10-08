"use client";

import {
  ArrowRight,
  Boxes,
  Compass,
  Database,
  FileStack,
  FlaskConical,
  History,
  Layers,
  Ruler,
  Search,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageIntro } from "@/components/ui/page-intro";
import { InlineInfo, SkeletonRows, ErrorState } from "@/components/ui/states";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { OverviewResponse } from "@/lib/types";
import { formatCount } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  PRODUCT_VERSION,
  RELEASES,
  STATUS_LABEL,
} from "@/lib/product-version";

/** Problem → the capability that answers it. */
const PROBLEMS = [
  {
    problem: "找不到",
    detail: "关键词搜不到语义相近的表述，资料散落在多份文档里。",
    solution: "混合知识检索",
    href: "/ask",
  },
  {
    problem: "说不清",
    detail: "答案没有出处，无法复核结论来自哪份文件的哪一段。",
    solution: "引用与溯源",
    href: "/ask",
  },
  {
    problem: "做不完",
    detail: "问答之后还有任务与交付物，需要人工逐步拼装。",
    solution: "Agent 任务执行",
    href: "/agent",
  },
  {
    problem: "不知道哪里缺",
    detail: "反复答不上来的问题背后是知识资产的结构性缺口。",
    solution: "知识洞察",
    href: "/insights/gaps",
  },
  {
    problem: "不知道效果如何",
    detail: "改了检索链路之后，没有可对比的量化依据。",
    solution: "RAG 评测",
    href: "/insights/evaluation",
  },
];

const PIPELINE = [
  { label: "Knowledge", cn: "企业资料" },
  { label: "Retrieval", cn: "知识检索" },
  { label: "Rerank", cn: "证据重排" },
  { label: "Grounded Generation", cn: "带来源生成" },
  { label: "Agent / Skill / Tool", cn: "任务执行" },
  { label: "Trace", cn: "执行轨迹" },
  { label: "Evaluation", cn: "效果评测" },
];

/** Reported as implemented-but-not-default, exactly as the code stands. */
const BOUNDARIES = [
  "当前是单实例公开 Demo，不是多租户 SaaS，也没有完整的企业用户与权限体系。",
  "向量存储默认使用 numpy 实现；pgvector 代码已实现，但尚未作为生产默认并完成集成验证。",
  "扫描版 PDF 不支持 OCR，遇到时会明确报解析失败，不做假的成功。",
  "未做高并发压测，没有 token 配额与成本控制。",
  "回答质量目前只接受人工评分，不使用模型自评分数。",
];

const ROLES = [
  { title: "Product Design", detail: "需求判断、信息架构、页面与交互设计" },
  { title: "RAG Architecture", detail: "四层检索链路（BM25 / 向量 / RRF / 重排）与引用契约" },
  { title: "Agent Workflow", detail: "意图 → Skill → Tool 的编排与可观测轨迹" },
  { title: "Full-stack Implementation", detail: "FastAPI 后端与 Next.js 前端" },
  { title: "Evaluation & Deployment", detail: "冻结评测集、容器化与 Nginx / HTTPS 部署" },
];

export default function AboutPage() {
  // Live figures only — nothing on this page is a hard-coded number.
  const overview = useAsync<OverviewResponse>(() => api.overview(), []);

  return (
    <div className="space-y-6">
      <PageIntro
        title="关于项目"
        subtitle="这不是一个功能列表，而是一个关于「企业知识为什么难用、以及可以怎么改」的判断，以及围绕这个判断做出的完整实现。"
      />

      {/* --------------------------------------------------------- A: why */}
      <Card>
        <CardHeader
          title="A. 为什么做这个产品？"
          icon={<Sparkles className="size-4" />}
          dense
        />
        <CardContent className="space-y-3">
          <p className="text-sm leading-relaxed text-[var(--color-ink-soft)]">
            企业知识通常散落在产品资料、FAQ、成功案例、解决方案与内部文档中。传统搜索能找到文件，
            但很难直接回答问题、说明答案依据、执行进一步任务，也很难发现知识缺口。
          </p>
          <p className="text-sm leading-relaxed text-[var(--color-ink-soft)]">
            因此构建 Enterprise RAG Copilot：把「先检索证据、再基于证据生成」作为默认路径，
            并把检索过程与引用依据保留下来，让结论可以被核对，而不是只能被相信。
          </p>
        </CardContent>
      </Card>

      {/* ------------------------------------------------ B: what it solves */}
      <Card>
        <CardHeader
          title="B. 产品解决什么问题？"
          description="每个问题都对应一个可以现场验证的能力，而不是一句承诺"
          icon={<Ruler className="size-4" />}
          dense
        />
        <CardContent className="space-y-2">
          {PROBLEMS.map((item) => (
            <div
              key={item.problem}
              className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-line-faint)] surface-subtle px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--color-ink)]">{item.problem}</p>
                <p className="mt-0.5 text-2xs leading-relaxed text-[var(--color-ink-muted)]">
                  {item.detail}
                </p>
              </div>
              <Link
                href={item.href}
                className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-[var(--color-accent)] hover:underline"
              >
                {item.solution}
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* --------------------------------------------------- C: core chain */}
      <Card surface="raised">
        <CardHeader
          title="C. 核心链路"
          description="从资料到可验证结论的完整路径"
          icon={<Layers className="size-4" />}
          dense
        />
        <CardContent>
          <ol className="relative space-y-1.5">
            {PIPELINE.map((step, index) => (
              <li key={step.label} className="flex items-stretch gap-3">
                <span className="flex w-6 shrink-0 flex-col items-center">
                  <span className="flex size-6 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--color-accent-soft)] font-mono text-[10px] font-semibold text-[var(--color-accent-ink)]">
                    {index + 1}
                  </span>
                  {index < PIPELINE.length - 1 ? (
                    <span
                      aria-hidden
                      className="mt-1 w-px flex-1 bg-[var(--color-line-faint)]"
                    />
                  ) : null}
                </span>
                <span className="flex min-w-0 flex-1 items-baseline gap-2 pb-1.5 pt-0.5">
                  <span className="font-mono text-xs text-[var(--color-ink)]">{step.label}</span>
                  <span className="text-2xs text-[var(--color-ink-muted)]">{step.cn}</span>
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* ---------------------------------------------------- D: this demo */}
      {/* Recessed like E: both are reference data rather than narrative, and
          four identical white slabs in a row was the page's whole visual
          problem — six sections, one material. */}
      <Card surface="subtle">
        <CardHeader
          title="D. 当前 Demo"
          description="以下数字来自正在运行的实例，由接口实时返回"
          icon={<Database className="size-4" />}
          dense
        />
        <CardContent>
          {overview.status === "loading" ? (
            <SkeletonRows count={2} />
          ) : overview.status === "error" ? (
            <ErrorState error={overview.error} onRetry={overview.reload} compact />
          ) : (
            /* A fragment because this is the last branch of a ternary chain and
               therefore takes exactly one JSX expression — the grid and the
               API-version footnote are two. */
            <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="企业文档" value={formatCount(overview.data.knowledge.document_count)} icon={<FileStack className="size-4" />} />
              <Stat label="知识块" value={formatCount(overview.data.knowledge.chunk_count)} icon={<Boxes className="size-4" />} />
              <Stat
                label="知识检索"
                value={overview.data.system.retriever_mode === "hybrid" ? "混合检索" : overview.data.system.retriever_mode}
                icon={<Search className="size-4" />}
              />
              <Stat
                label="工作流引擎"
                value={overview.data.agent.engine === "langgraph" ? "LangGraph" : overview.data.agent.engine}
                icon={<Workflow className="size-4" />}
              />
              <Stat label="业务能力" value={String(overview.data.agent.skill_count)} icon={<Sparkles className="size-4" />} />
              <Stat label="可执行动作" value={String(overview.data.agent.tool_count)} icon={<Workflow className="size-4" />} />
              <Stat label="产品版本" value={PRODUCT_VERSION} icon={<ShieldCheck className="size-4" />} />
              <Stat
                label="访问模式"
                value={overview.data.system.read_only ? "公开只读" : "可写"}
                icon={<ShieldCheck className="size-4" />}
              />
            </div>
            {/* The product version and the API version are different things and
                the tile above used to conflate them (it showed the backend's
                3.0.0 as the product version). Spelled out here so a visitor is
                not misled, without touching the backend constant.

                Kept INSIDE this block on purpose: `overview` is a discriminated
                union, so `overview.data` is only readable inside the guard that
                narrows it — a sibling `overview.data ? ...` ternary outside the
                guard does not type-check. */}
            <p className="mt-3 text-2xs leading-relaxed text-[var(--color-ink-muted)]">
              产品版本 {PRODUCT_VERSION}；API 版本 v{overview.data.system.version}
              —— 后者是后端接口版本，与产品版本无关，V4.0 起三次发布均未改动后端。
            </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------ E: boundary */}
      <Card surface="subtle">
        <CardHeader
          title="E. 项目边界"
          description="未实现的能力如实列出，不包装成生产级企业 SaaS"
          icon={<Ruler className="size-4" />}
          dense
        />
        <CardContent className="space-y-2">
          <ul className="space-y-1.5">
            {BOUNDARIES.map((item) => (
              <li key={item} className="flex gap-2 text-xs leading-relaxed text-[var(--color-ink-soft)]">
                <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--color-ink-faint)]" />
                <span className="min-w-0">{item}</span>
              </li>
            ))}
          </ul>
          <InlineInfo message="以上边界同时写在 README 的功能矩阵与作品集的事实卡里；对外材料只引用实测值。" />
        </CardContent>
      </Card>

      {/* ---------------------------------------------------------- F: role */}
      <Card>
        <CardHeader
          title="F. 项目角色"
          description="独立完成，措辞保持克制"
          icon={<Compass className="size-4" />}
          dense
        />
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ROLES.map((role) => (
              <div
                key={role.title}
                className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3.5 py-3"
              >
                <p className="text-xs font-semibold text-[var(--color-ink)]">{role.title}</p>
                <p className="mt-1 text-2xs leading-relaxed text-[var(--color-ink-muted)]">
                  {role.detail}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------ technical readers */}
      <Card surface="subtle">
        <CardHeader
          title="想继续深入？"
          description="技术面试可以沿着这几条链路查看实现细节"
          icon={<FlaskConical className="size-4" />}
          dense
        />
        <CardContent className="flex flex-wrap gap-2">
          <DeepDive href="/ask" label="引用下钻与检索分数" />
          <DeepDive href="/agent" label="执行轨迹与 Tool 调用" />
          <DeepDive href="/insights/evaluation" label="检索指标与人工评分" />
          <DeepDive href="/knowledge/explorer" label="知识块与检索探测" />
          <DeepDive href="/settings" label="运行时配置与系统自检" />
        </CardContent>
      </Card>

      {/* ------------------------------------------- G: release history */}
      <Card id="release-history" className="scroll-mt-20">
        <CardHeader
          title="G. 产品迭代历程"
          description="Release History · 只写有据可查的版本与日期；未发布的版本不标日期"
          icon={<History className="size-4" />}
        />
        <CardContent>
          <ol className="relative space-y-7 border-l border-[var(--color-line-faint)] pl-6">
            {RELEASES.map((release) => {
              const released = release.status === "released";
              return (
                <li key={release.version} className="relative">
                  {/* Node: filled for a shipped version, hollow for one that has
                      only passed review. Shape carries the state, so it does not
                      depend on colour alone. */}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute -left-[30px] top-[5px] size-2.5 rounded-full ring-4 ring-[var(--color-surface)]",
                      released
                        ? "bg-[var(--color-accent-solid)]"
                        : "border-2 border-[var(--color-line-strong)] bg-[var(--color-surface)]",
                    )}
                  />
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="font-mono text-[13px] font-semibold tracking-tight text-[var(--color-ink)]">
                      {release.version}
                    </span>
                    <span className="text-[13px] font-medium text-[var(--color-ink)]">
                      {release.title}
                    </span>
                    <Badge tone={released ? "neutral" : "accent"} className="font-normal">
                      {released ? `已发布 · ${release.releasedAt}` : STATUS_LABEL[release.status]}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-ink-soft)]">
                    {release.summary}
                  </p>
                  <ul className="mt-2.5 space-y-1.5">
                    {release.highlights.map((item) => (
                      <li
                        key={item}
                        className="flex gap-2 text-xs leading-relaxed text-[var(--color-ink-muted)]"
                      >
                        <span
                          aria-hidden
                          className="mt-[7px] size-1 shrink-0 rounded-full bg-[var(--color-ink-faint)]"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    // Raises on the recessed card above so the eight tiles stay readable.
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line-faint)] bg-[var(--color-surface)] px-3.5 py-3">
      <div className="flex items-center gap-2 text-[var(--color-ink-faint)]">
        {icon}
        <span className="text-2xs">{label}</span>
      </div>
      <p className="mt-1.5 truncate text-base font-semibold text-[var(--color-ink)]">{value}</p>
    </div>
  );
}

function DeepDive({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href}>
      <Badge tone="neutral" className="cursor-pointer px-3 py-1 text-xs hover:border-[var(--color-accent-line)]">
        {label}
      </Badge>
    </Link>
  );
}
