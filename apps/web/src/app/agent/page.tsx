"use client";

import { ArrowDown, Bot, FileText, Play, ShieldAlert, Sparkles, Wrench } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { TraceTimeline } from "@/components/agent/trace-timeline";
import { KnowledgeMascot } from "@/components/mascot/knowledge-mascot";
import { Markdown } from "@/components/rag/markdown";
import { SourceDrawer } from "@/components/rag/source-drawer";
import { Badge, CodeChip, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, DefRow } from "@/components/ui/card";
import { TD, TH, TR, Table } from "@/components/ui/data";
import { Field, Select, Textarea } from "@/components/ui/field";
import { PageIntro } from "@/components/ui/page-intro";
import {
  MainTaskBody,
  MainTaskHeader,
  MainTaskPanel,
  ResultSection,
  SectionAccordion,
} from "@/components/ui/section";
import { InlineError, InlineWarning, SkeletonRows } from "@/components/ui/states";
import { SegmentedControl, Switch } from "@/components/ui/toggle";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/providers/toast-provider";
import { api, ApiError } from "@/lib/api";
import { useAsync, usePresetParam } from "@/lib/hooks";
import type { AgentCatalogResponse, AgentRunResponse } from "@/lib/types";
import { formatMs, formatPercent } from "@/lib/utils";

const EXAMPLE_TASKS = [
  "帮我分析当前知识库还缺少哪些售前资料。",
  "总结当前知识库的主要内容。",
  "分析这个项目还能怎样优化。",
  "根据客户需求生成售前方案。",
  "Rerank 在 RAG 检索链路里解决什么问题？",
  "帮我总结一下 RAG.md 这份文档",
];

const INTENT_OPTIONS = [
  { value: "", label: "自动判断" },
  { value: "rag_answer", label: "知识库问答" },
  { value: "kb_overview", label: "知识库概览" },
  { value: "kb_gap_analysis", label: "知识缺口分析" },
  { value: "requirement_analysis", label: "客户需求解析" },
  { value: "solution_generation", label: "售前方案生成" },
  { value: "document_intelligence", label: "文档智能分析" },
  { value: "agent_optimization", label: "Agent 化建议" },
];

type DetailTab = "trace" | "tools" | "plan";
type Engine = "auto" | "native" | "langgraph";

/** One shape for both layouts, so the idle and result views cannot drift. */
interface TaskFormProps {
  task: string;
  onTaskChange: (value: string) => void;
  intent: string;
  onIntentChange: (value: string) => void;
  engine: Engine;
  onEngineChange: (value: Engine) => void;
  humanCheck: boolean;
  onHumanCheckChange: (value: boolean) => void;
  activeEngine: string;
  running: boolean;
  onRun: () => void;
  rows?: number;
}

function TaskFields({ task, onTaskChange, onRun }: Pick<TaskFormProps, "task" | "onTaskChange" | "onRun">) {
  return (
    <div className="space-y-3">
      <Textarea
        rows={3}
        className="min-h-[76px] sm:min-h-[112px]"
        value={task}
        placeholder="描述要完成的任务，例如：帮我分析当前知识库还缺少哪些售前资料。"
        onChange={(event) => onTaskChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            onRun();
          }
        }}
      />
      <div className="flex flex-wrap gap-1.5">
        {EXAMPLE_TASKS.slice(0, 4).map((example, index) => (
          <button
            key={example}
            type="button"
            onClick={() => onTaskChange(example)}
            className={`max-w-full truncate rounded-full border border-[var(--color-line)] px-2.5 py-1 text-2xs text-[var(--color-ink-muted)] transition-colors hover:border-[var(--color-accent-line)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent-ink)]${index === 3 ? " hidden sm:inline-block" : ""}`}
            title={example}
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}

function SettingsFields({
  intent,
  onIntentChange,
  engine,
  onEngineChange,
  humanCheck,
  onHumanCheckChange,
  activeEngine,
}: Omit<TaskFormProps, "task" | "onTaskChange" | "onRun" | "running" | "rows">) {
  return (
    <div className="space-y-3">
      <Field label="执行模式" hint="手动指定会跳过自动路由">
        <Select value={intent} onChange={(event) => onIntentChange(event.target.value)}>
          {INTENT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="执行引擎" hint={`当前生效：${activeEngine}`}>
        <SegmentedControl<Engine>
          value={engine}
          onChange={onEngineChange}
          size="sm"
          className="w-full"
          options={[
            { value: "auto", label: "auto" },
            { value: "langgraph", label: "LangGraph" },
            { value: "native", label: "原生" },
          ]}
        />
      </Field>

      <Switch
        id="human-check"
        checked={humanCheck}
        onChange={onHumanCheckChange}
        label="启用 Human Check"
        description="方案类输出会被标记为「需人工确认」，用于演示高风险输出的把关节点。"
      />
    </div>
  );
}

export default function AgentPage() {
  const { toast } = useToast();
  const catalog = useAsync<AgentCatalogResponse>(() => api.agentCatalog(), []);

  const [task, setTask] = useState("");
  const [intent, setIntent] = useState("");
  const [engine, setEngine] = useState<Engine>("auto");
  const [humanCheck, setHumanCheck] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AgentRunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>("trace");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeCitation, setActiveCitation] = useState<number | null>(null);
  const traceRef = useRef<HTMLDivElement>(null);

  // `/agent?task=…` from the home page: prefill only, never auto-run.
  usePresetParam("task", setTask);

  const run = useCallback(async () => {
    const text = task.trim();
    if (!text || running) return;

    setRunning(true);
    setError(null);
    setResult(null);

    try {
      const response = await api.agentRun({
        task: text,
        preferred_intent: intent || null,
        engine,
        require_human_check: humanCheck,
      });
      setResult(response);
      toast({
        title: "Agent 执行完成",
        description: `${response.skill_name} · ${response.trace.length} 个节点 · ${formatMs(response.latency_ms)}`,
        variant: "success",
      });
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : "Agent 执行失败。";
      setError(message);
      toast({ title: "Agent 执行失败", description: message, variant: "error" });
    } finally {
      setRunning(false);
    }
  }, [task, running, intent, engine, humanCheck, toast]);

  const openCitation = useCallback((index: number) => {
    setActiveCitation(index);
    setDrawerOpen(true);
  }, []);

  const activeEngine = catalog.status === "success" ? catalog.data.active_engine : "—";
  const skillCount = catalog.status === "success" ? catalog.data.skills.length : null;
  const toolCount = catalog.status === "success" ? catalog.data.tools.length : null;

  // The backend ships a human-readable label per intent; fall back to the raw id.
  const intentLabel =
    catalog.status === "success"
      ? (catalog.data.intents.find((item) => item.intent === result?.intent)?.label ??
        result?.intent ??
        "—")
      : (result?.intent ?? "—");

  /**
   * Before a run the input owns the page; after a run the result does.
   * Rendering an empty result placeholder in the idle state is what made the
   * old layout read as "narrow form + big void".
   */
  const hasOutput = running || result !== null;

  const formProps: TaskFormProps = {
    task,
    onTaskChange: setTask,
    intent,
    onIntentChange: setIntent,
    engine,
    onEngineChange: setEngine,
    humanCheck,
    onHumanCheckChange: setHumanCheck,
    activeEngine,
    running,
    onRun: () => void run(),
  };

  return (
    <div className="space-y-5">
      <PageIntro
        title="AI 任务"
        subtitle="告诉 Agent 你希望完成什么。它会自动识别任务类型，选择对应能力并执行。"
      />

      {!hasOutput ? (
        /* ------------------------------------------------- IDLE: full width */
        <>
          <MainTaskPanel>
            <MainTaskHeader
              title="要完成的任务"
              description="用一句话描述目标即可，不需要说明该用哪个能力"
              icon={<Bot className="size-4" />}
            />
            <MainTaskBody>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]">
                <TaskFields {...formProps} />
                <div className="lg:border-l lg:border-[var(--color-line-faint)] lg:pl-4">
                  <SettingsFields {...formProps} />
                </div>
              </div>

              <Button
                variant="primary"
                size="lg"
                className="mt-4 w-full"
                disabled={!task.trim()}
                onClick={() => void run()}
              >
                <Play className="size-4" />
                运行 Agent
              </Button>
            </MainTaskBody>
          </MainTaskPanel>

          {error ? <InlineError message={error} /> : null}

          {catalog.status === "success" ? (
            <SectionAccordion
              label="查看 Agent 可以完成哪些任务"
              description={
                skillCount !== null && toolCount !== null
                  ? `${skillCount} Skills · ${toolCount} Tools`
                  : undefined
              }
              icon={<Wrench className="size-4" />}
            >
              <div className="space-y-3">
                <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2">
                  <DefRow label="可用 Skill">{catalog.data.skills.length}</DefRow>
                  <DefRow label="可用 Tool">{catalog.data.tools.length}</DefRow>
                  <DefRow label="LangGraph">
                    {catalog.data.engines.includes("langgraph") ? "可用" : "不可用"}
                  </DefRow>
                </div>

                <div className="space-y-1.5">
                  {catalog.data.skills.map((skill) => (
                    <div
                      key={skill.id}
                      className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium text-[var(--color-ink)]">
                          {skill.name}
                        </span>
                        <Badge tone={skill.requires_retrieval ? "accent" : "neutral"}>
                          {skill.requires_retrieval ? "需检索" : "确定性"}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-2xs leading-relaxed text-[var(--color-ink-muted)]">
                        {skill.description}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {skill.tools.map((tool) => (
                          <CodeChip key={tool}>{tool}</CodeChip>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </SectionAccordion>
          ) : null}
        </>
      ) : (
        /* -------------------------------------- RUNNING / RESULT: full width */
        <>
          {/* The input collapses to one summary line; expanding it brings the
              whole form back so a second task can be run without leaving. */}
          <SectionAccordion
            label="本次任务"
            description={task.trim() || "未填写"}
            icon={<Bot className="size-4" />}
          >
            <div className="space-y-4">
              <TaskFields {...formProps} />
              <SettingsFields {...formProps} />
              <Button
                variant="primary"
                className="w-full"
                loading={running}
                disabled={!task.trim()}
                onClick={() => void run()}
              >
                <Play className="size-4" />
                重新运行
              </Button>
            </div>
          </SectionAccordion>

          {error ? <InlineError message={error} /> : null}

          {running && !result ? (
            <Card>
              <CardContent className="flex items-center gap-4">
                <KnowledgeMascot state="searching" size={56} />
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium text-[var(--color-ink)]">正在执行你的任务…</p>
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    正在理解任务 → 选择业务能力 → 执行必要步骤 → 整理结果
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {running && !result ? <SkeletonRows count={4} /> : null}

          {result ? (
            <>
              {result.human_check_required ? (
                <div className="flex items-start gap-2.5 rounded-[var(--radius-xl)] border border-[var(--color-warning-line)] bg-[var(--color-warning-soft)] px-4 py-3">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[var(--color-warning)]" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[var(--color-ink)]">需要人工确认</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-ink-muted)]">
                      {result.human_check_reason}
                    </p>
                  </div>
                </div>
              ) : null}

              <ResultSection
                label="执行结果"
                meta={`${result.skill_name || "未匹配能力"} · ${formatMs(result.latency_ms)}`}
                icon={<FileText className="size-4" />}
                actions={
                  result.sources.length > 0 ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openCitation(result.sources[0].citation_indexes[0])}
                    >
                      查看引用证据（{result.sources.length}）
                    </Button>
                  ) : null
                }
              >
                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                  <Badge tone={result.intent_confidence >= 0.6 ? "success" : "warning"}>
                    置信度 {formatPercent(result.intent_confidence)}
                  </Badge>
                  <Badge tone="neutral">{result.output_type}</Badge>
                  <Badge tone="neutral">{result.engine}</Badge>
                  {result.used_general_fallback ? (
                    <Badge tone="warning">未命中知识库 · 通用建议</Badge>
                  ) : null}
                </div>
                <Markdown content={result.answer || "（无输出）"} onCitation={openCitation} />
              </ResultSection>

              {result.warnings.length > 0 ? (
                <div className="space-y-2">
                  {result.warnings.map((warning) => (
                    <InlineWarning key={warning} message={warning} />
                  ))}
                </div>
              ) : null}

              <Card>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-2xs font-semibold tracking-[0.08em] text-[var(--color-ink-faint)]">
                      刚刚发生了什么
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        traceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                      }
                      className="inline-flex min-h-11 items-center gap-1 text-2xs text-[var(--color-accent)] hover:underline"
                    >
                      查看完整执行轨迹
                      <ArrowDown className="size-3" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-x-8 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    <Fact label="识别任务" value={intentLabel} />
                    <Fact label="选择能力" value={result.skill_name || "未匹配到能力"} />
                    <Fact label="调用工具" value={`${result.tool_calls.length} 个`} />
                    <Fact label="执行步骤" value={`${result.trace.length} 个`} />
                    <Fact label="耗时" value={formatMs(result.latency_ms)} />
                    <Fact
                      label="证据"
                      value={
                        result.retrieved_chunks.length > 0
                          ? `${result.retrieved_chunks.length} 段 · ${result.citations.length} 引用`
                          : "未检索知识库"
                      }
                    />
                  </div>
                </CardContent>
              </Card>

              <div ref={traceRef} className="scroll-mt-20">
                <SectionAccordion
                  label="查看完整执行轨迹"
                  description="执行节点、Tool 调用与执行计划"
                  icon={<Sparkles className="size-4" />}
                >
                  <Tabs<DetailTab>
                    value={tab}
                    onChange={setTab}
                    options={[
                      { value: "trace", label: "执行轨迹", count: result.trace.length },
                      { value: "tools", label: "Tool 调用", count: result.tool_calls.length },
                      { value: "plan", label: "执行计划", count: result.plan.length },
                    ]}
                  />
                  <div className="pt-3">
                    {tab === "trace" ? <TraceTimeline steps={result.trace} /> : null}

                    {tab === "tools" ? (
                      result.tool_calls.length === 0 ? (
                        <p className="py-6 text-center text-xs text-[var(--color-ink-faint)]">
                          本次执行没有调用任何 Tool。
                        </p>
                      ) : (
                        <Table>
                          <thead>
                            <tr>
                              <TH>Tool</TH>
                              <TH>状态</TH>
                              <TH align="right">耗时</TH>
                              <TH>摘要</TH>
                            </tr>
                          </thead>
                          <tbody>
                            {result.tool_calls.map((call, index) => (
                              <TR key={`${call.name}-${index}`}>
                                <TD mono>{call.name}</TD>
                                <TD>
                                  <span className="inline-flex items-center gap-1.5">
                                    <StatusDot
                                      tone={
                                        call.status === "success"
                                          ? "success"
                                          : call.status === "failed"
                                            ? "danger"
                                            : "neutral"
                                      }
                                    />
                                    <span className="text-xs">{call.status}</span>
                                  </span>
                                </TD>
                                <TD align="right" mono>
                                  {formatMs(call.duration_ms)}
                                </TD>
                                <TD>
                                  <span className="text-xs">{call.summary || "—"}</span>
                                  {call.error ? (
                                    <span className="mt-0.5 block text-2xs text-[var(--color-danger)]">
                                      {call.error}
                                    </span>
                                  ) : null}
                                </TD>
                              </TR>
                            ))}
                          </tbody>
                        </Table>
                      )
                    ) : null}

                    {tab === "plan" ? (
                      result.plan.length === 0 ? (
                        <p className="py-6 text-center text-xs text-[var(--color-ink-faint)]">
                          没有生成执行计划。
                        </p>
                      ) : (
                        <ol className="space-y-2">
                          {result.plan.map((step) => (
                            <li
                              key={step.index}
                              className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3.5 py-2.5"
                            >
                              <div className="flex items-center gap-2">
                                <span className="flex size-5 shrink-0 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--color-accent-soft)] font-mono text-[10px] font-semibold text-[var(--color-accent-ink)]">
                                  {step.index}
                                </span>
                                <span className="min-w-0 truncate text-xs font-medium text-[var(--color-ink)]">
                                  {step.title}
                                </span>
                                {step.tool ? <CodeChip>{step.tool}</CodeChip> : null}
                                <span className="ml-auto shrink-0 font-mono text-2xs text-[var(--color-ink-faint)]">
                                  {step.node}
                                </span>
                              </div>
                              <p className="mt-1 pl-7 text-2xs leading-relaxed text-[var(--color-ink-muted)]">
                                {step.rationale}
                              </p>
                            </li>
                          ))}
                        </ol>
                      )
                    ) : null}
                  </div>
                </SectionAccordion>
              </div>

              {result.analysis ? (
                <SectionAccordion label="查看中间分析结果" description="Skill 内部产出的结构化数据">
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-sunken)] p-3 font-mono text-2xs text-[var(--color-ink-soft)]">
                    {result.analysis}
                  </pre>
                </SectionAccordion>
              ) : null}

              <SectionAccordion
                label="查看执行引擎说明"
                description="LangGraph 与内置状态机的差异与回退行为"
              >
                <p className="text-2xs leading-relaxed text-[var(--color-ink-faint)]">
                  切换「执行引擎」可以在 LangGraph 与内置状态机之间对比执行结果 —— 两者共用同一套节点函数，
                  因此行为一致，只有调度方式不同。若 LangGraph 在运行期失败，会自动回退到内置状态机并在警告中说明。
                </p>
              </SectionAccordion>
            </>
          ) : null}
        </>
      )}

      <SourceDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        citations={result?.citations ?? []}
        chunks={result?.retrieved_chunks ?? []}
        activeIndex={activeCitation}
        onSelect={setActiveCitation}
      />
    </div>
  );
}

/** One label/value pair in the plain-language run summary. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--color-line-faint)] py-1 last:border-0">
      <span className="shrink-0 text-2xs text-[var(--color-ink-muted)]">{label}</span>
      <span className="min-w-0 truncate text-right text-xs text-[var(--color-ink)]">{value}</span>
    </div>
  );
}
