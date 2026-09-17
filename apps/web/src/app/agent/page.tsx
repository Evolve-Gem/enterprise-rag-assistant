"use client";

import { Bot, Play, ShieldAlert, Sparkles, Wrench } from "lucide-react";
import { useCallback, useState } from "react";

import { TraceTimeline } from "@/components/agent/trace-timeline";
import { KnowledgeMascot, type MascotState } from "@/components/mascot/knowledge-mascot";
import { Markdown } from "@/components/rag/markdown";
import { SourceDrawer } from "@/components/rag/source-drawer";
import { Badge, CodeChip, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, DefRow, SectionLabel } from "@/components/ui/card";
import { TD, TH, TR, Table } from "@/components/ui/data";
import { Field, Select, Textarea } from "@/components/ui/field";
import { EmptyState, InlineError, InlineWarning, SkeletonRows } from "@/components/ui/states";
import { SegmentedControl, Switch } from "@/components/ui/toggle";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/providers/toast-provider";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { AgentCatalogResponse, AgentRunResponse } from "@/lib/types";
import { formatMs, formatPercent } from "@/lib/utils";

const EXAMPLE_TASKS = [
  "Rerank 在 RAG 检索链路里解决什么问题？",
  "当前知识库里有哪些资料？",
  "帮我分析当前知识库还缺少哪些售前资料。",
  "帮我总结一下 RAG.md 这份文档",
  "某职业院校希望建设统一知识库，用于招生咨询、教务政策问答，预算有限。请生成一份售前解决方案。",
  "这个项目还能怎么用 Agent 优化？",
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

/** Map the completion state onto a mascot pose. */
function mascotFor(running: boolean, result: AgentRunResponse | null): MascotState {
  if (running) return "searching";
  if (!result) return "idle";
  if (result.trace.some((step) => step.status === "failed")) return "error";
  return "success";
}

export default function AgentPage() {
  const { toast } = useToast();
  const catalog = useAsync<AgentCatalogResponse>(() => api.agentCatalog(), []);

  const [task, setTask] = useState("");
  const [intent, setIntent] = useState("");
  const [engine, setEngine] = useState<"auto" | "native" | "langgraph">("auto");
  const [humanCheck, setHumanCheck] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AgentRunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>("trace");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeCitation, setActiveCitation] = useState<number | null>(null);

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

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      {/* ------------------------------------------------------- controls */}
      <div className="space-y-4">
        <Card>
          <CardHeader
            title="任务"
            description="Agent 会识别意图、选择 Skill、调用 Tool 并展示完整轨迹"
            icon={<Bot className="size-4" />}
            dense
          />
          <CardContent className="space-y-3">
            <Textarea
              rows={5}
              value={task}
              placeholder="描述要完成的任务，例如：帮我分析当前知识库还缺少哪些售前资料。"
              onChange={(event) => setTask(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  void run();
                }
              }}
            />

            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_TASKS.slice(0, 4).map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setTask(example)}
                  className="max-w-full truncate rounded-full border border-[var(--color-line)] px-2.5 py-1 text-2xs text-[var(--color-ink-muted)] transition-colors hover:border-[var(--color-accent-line)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent-ink)]"
                  title={example}
                >
                  {example}
                </button>
              ))}
            </div>

            <Button
              variant="primary"
              className="w-full"
              loading={running}
              disabled={!task.trim()}
              onClick={() => void run()}
            >
              <Play className="size-3.5" />
              运行 Agent
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="执行设置" icon={<Sparkles className="size-4" />} dense />
          <CardContent className="space-y-4">
            <Field label="执行模式" hint="手动指定会跳过自动路由">
              <Select value={intent} onChange={(event) => setIntent(event.target.value)}>
                {INTENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="执行引擎" hint={`当前生效：${activeEngine}`}>
              <SegmentedControl<"auto" | "native" | "langgraph">
                value={engine}
                onChange={setEngine}
                size="sm"
                className="w-full"
                options={[
                  { value: "auto", label: "auto" },
                  { value: "langgraph", label: "LangGraph" },
                  { value: "native", label: "原生状态机" },
                ]}
              />
            </Field>

            <Switch
              id="human-check"
              checked={humanCheck}
              onChange={setHumanCheck}
              label="启用 Human Check"
              description="方案类输出会被标记为「需人工确认」，用于演示高风险输出的把关节点。"
            />

            {catalog.status === "success" ? (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2">
                <DefRow label="可用 Skill">{catalog.data.skills.length}</DefRow>
                <DefRow label="可用 Tool">{catalog.data.tools.length}</DefRow>
                <DefRow label="LangGraph">
                  {catalog.data.engines.includes("langgraph") ? "可用" : "不可用"}
                </DefRow>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* skill catalog */}
        {catalog.status === "success" ? (
          <Card>
            <CardHeader
              title="Skill 目录"
              description="每个 Skill 组织一类业务能力"
              icon={<Wrench className="size-4" />}
              dense
            />
            <CardContent className="space-y-1.5">
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
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* ---------------------------------------------------------- result */}
      <div className="min-w-0 space-y-4">
        {error ? <InlineError message={error} /> : null}

        {running ? (
          <Card>
            <CardContent className="flex items-center gap-5">
              <KnowledgeMascot state="searching" size={72} />
              <div className="space-y-1">
                <p className="text-sm font-medium text-[var(--color-ink)]">Agent 正在执行…</p>
                <p className="text-xs text-[var(--color-ink-muted)]">
                  正在识别意图 → 制定计划 → 调用 Tool → 检索知识库 → 生成输出
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {running && !result ? <SkeletonRows count={5} /> : null}

        {!running && !result ? (
          <EmptyState
            icon={<Bot className="size-5" />}
            title="还没有执行记录"
            description="在左侧选择一个示例任务并点击「运行 Agent」，这里会展示意图、Skill、Tool 调用与逐步轨迹。"
          />
        ) : null}

        {result ? (
          <>
            {/* summary */}
            <Card>
              <CardHeader
                dense
                icon={<KnowledgeMascot state={mascotFor(false, result)} size={28} />}
                title={result.skill_name || "未匹配 Skill"}
                description={`${result.intent} · 引擎 ${result.engine} · ${formatMs(result.latency_ms)}`}
                actions={
                  <>
                    <Badge tone={result.intent_confidence >= 0.6 ? "success" : "warning"}>
                      置信度 {formatPercent(result.intent_confidence)}
                    </Badge>
                    <Badge tone="neutral">{result.output_type}</Badge>
                  </>
                }
              />
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-2xs text-[var(--color-ink-faint)]">识别意图</p>
                  <p className="mt-0.5 font-mono text-sm text-[var(--color-ink)]">
                    {result.intent}
                  </p>
                </div>
                <div>
                  <p className="text-2xs text-[var(--color-ink-faint)]">Tool 调用</p>
                  <p className="mt-0.5 text-sm text-[var(--color-ink)]">
                    {result.tool_calls.length} 次
                  </p>
                </div>
                <div>
                  <p className="text-2xs text-[var(--color-ink-faint)]">检索证据</p>
                  <p className="mt-0.5 text-sm text-[var(--color-ink)]">
                    {result.retrieved_chunks.length} 段 · {result.citations.length} 引用
                  </p>
                </div>
                <div>
                  <p className="text-2xs text-[var(--color-ink-faint)]">执行节点</p>
                  <p className="mt-0.5 text-sm text-[var(--color-ink)]">
                    {result.trace.length} 个
                  </p>
                </div>
              </CardContent>
            </Card>

            {result.human_check_required ? (
              <div className="flex items-start gap-2.5 rounded-[var(--radius-lg)] border border-[var(--color-warning-line)] bg-[var(--color-warning-soft)] px-4 py-3">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[var(--color-warning)]" />
                <div>
                  <p className="text-xs font-medium text-[var(--color-ink)]">需要人工确认</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-ink-muted)]">
                    {result.human_check_reason}
                  </p>
                </div>
              </div>
            ) : null}

            {result.warnings.length > 0 ? (
              <div className="space-y-2">
                {result.warnings.map((warning) => (
                  <InlineWarning key={warning} message={warning} />
                ))}
              </div>
            ) : null}

            {/* output */}
            <Card>
              <CardHeader
                title="执行输出"
                description={
                  result.used_general_fallback
                    ? "知识库未命中，以下为模型通用建议（未经知识库验证）"
                    : `基于 ${result.retrieved_chunks.length} 段知识库证据生成`
                }
                actions={
                  result.sources.length > 0 ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openCitation(result.sources[0].citation_indexes[0])}
                    >
                      查看来源（{result.sources.length}）
                    </Button>
                  ) : null
                }
                dense
              />
              <CardContent>
                <Markdown content={result.answer || "（无输出）"} onCitation={openCitation} />
              </CardContent>
            </Card>

            {/* detail tabs */}
            <Card>
              <Tabs<DetailTab>
                value={tab}
                onChange={setTab}
                className="px-3"
                options={[
                  { value: "trace", label: "执行轨迹", count: result.trace.length },
                  { value: "tools", label: "Tool 调用", count: result.tool_calls.length },
                  { value: "plan", label: "执行计划", count: result.plan.length },
                ]}
              />
              <CardContent>
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
                            <span className="flex size-5 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--color-accent-soft)] font-mono text-[10px] font-semibold text-[var(--color-accent-ink)]">
                              {step.index}
                            </span>
                            <span className="text-xs font-medium text-[var(--color-ink)]">
                              {step.title}
                            </span>
                            {step.tool ? <CodeChip>{step.tool}</CodeChip> : null}
                            <span className="ml-auto font-mono text-2xs text-[var(--color-ink-faint)]">
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
              </CardContent>
            </Card>

            {/* analysis (requirement parsing / coverage JSON) */}
            {result.analysis ? (
              <Card>
                <CardHeader title="中间分析结果" description="Skill 内部产出的结构化数据" dense />
                <CardContent>
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-sunken)] p-3 font-mono text-2xs text-[var(--color-ink-soft)]">
                    {result.analysis}
                  </pre>
                </CardContent>
              </Card>
            ) : null}

            <SectionLabel>提示</SectionLabel>
            <p className="text-2xs leading-relaxed text-[var(--color-ink-faint)]">
              切换「执行引擎」可以在 LangGraph 与内置状态机之间对比执行结果 —— 两者共用同一套节点函数，
              因此行为一致，只有调度方式不同。若 LangGraph 在运行期失败，会自动回退到内置状态机并在警告中说明。
            </p>
          </>
        ) : null}
      </div>

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
