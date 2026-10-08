"use client";

import { CheckCircle2, Download, FileText, Lightbulb, Sparkles, Wand2 } from "lucide-react";
import { useCallback, useState } from "react";

import { KnowledgeMascot } from "@/components/mascot/knowledge-mascot";
import { Markdown } from "@/components/rag/markdown";
import { RetrievalPanel } from "@/components/rag/retrieval-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DefRow, SectionLabel } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { PageIntro, StepNote } from "@/components/ui/page-intro";
import {
  MainTaskBody,
  MainTaskHeader,
  MainTaskPanel,
  ResultSection,
  SectionAccordion,
} from "@/components/ui/section";
import { InlineError, InlineWarning } from "@/components/ui/states";
import { useToast } from "@/components/providers/toast-provider";
import { api, ApiError } from "@/lib/api";
import { useAsync, usePresetParam } from "@/lib/hooks";
import type { RequirementForm, SolutionResponse } from "@/lib/types";
import { cn, formatMs, formatPercent } from "@/lib/utils";

const EMPTY_FORM: RequirementForm = {
  customer: "",
  industry: "",
  scenario: "",
  pain_points: "",
  requirements: "",
  constraints: "",
};

const EXAMPLE = {
  requirement:
    "某职业院校希望把招生政策、教务规定和学生事务答疑资料统一到一个知识库中，让老师和学生随时提问，减少重复的人工解答。学校预算有限，希望先小范围试点。",
  form: {
    customer: "某职业院校",
    industry: "教育",
    scenario: "招生咨询 / 教务政策问答 / 学生事务答疑",
    pain_points: "政策文件分散，人工答疑重复度高，新生和家长咨询高峰期压力大",
    requirements: "统一知识库、支持自然语言提问、回答需可追溯到原始政策文件",
    constraints: "预算有限，需要私有化部署，数据不出校园",
  } satisfies RequirementForm,
};

/** Stated up front so the form is not a leap of faith. */
const EXPECTED = ["需求分析", "推荐方案", "实施路径", "风险说明", "参考依据", "可导出 Markdown / Word"];

export default function SolutionStudioPage() {
  const { toast } = useToast();
  const config = useAsync(() => api.solutionConfig(), []);

  const [requirement, setRequirement] = useState("");
  const [form, setForm] = useState<RequirementForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SolutionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"markdown" | "docx" | null>(null);

  // `/solution-studio?requirement=…` from the home page: prefill only.
  usePresetParam("requirement", setRequirement);

  const updateForm = (key: keyof RequirementForm, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const generate = useCallback(async () => {
    if (!requirement.trim() && !Object.values(form).some(Boolean)) {
      setError("请至少填写客户需求描述或表单中的任意字段。");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await api.generateSolution({ requirement, form, top_k: 8 });
      setResult(response);
      toast({
        title: "方案生成完成",
        description: `${response.sections.length} 个章节 · ${response.citations.length} 条引用 · ${formatMs(response.latency_ms)}`,
        variant: "success",
      });
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : "方案生成失败。";
      setError(message);
      toast({ title: "方案生成失败", description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [requirement, form, toast]);

  const download = useCallback(
    async (format: "markdown" | "docx") => {
      if (!result) return;
      setExporting(format);
      try {
        const blob = await api.exportSolution({
          format,
          title: "售前解决方案",
          markdown: result.markdown,
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = format === "docx" ? "solution.docx" : "solution.md";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        toast({
          title: `已导出 ${format === "docx" ? "Word" : "Markdown"} 文件`,
          variant: "success",
        });
      } catch (caught) {
        toast({
          title: "导出失败",
          description: caught instanceof ApiError ? caught.message : "请重试。",
          variant: "error",
        });
      } finally {
        setExporting(null);
      }
    },
    [result, toast],
  );

  const analysis = result?.analysis;
  const groundedSections = result?.sections.filter((section) => section.grounded).length ?? 0;
  const hasOutput = loading || result !== null;

  /** The requirement block, shared by the idle panel and the collapsed summary. */
  const requirementFields = (
    <>
      <Textarea
        rows={5}
        value={requirement}
        placeholder="用自然语言描述客户背景、场景与诉求…"
        onChange={(event) => setRequirement(event.target.value)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setRequirement(EXAMPLE.requirement);
            setForm(EXAMPLE.form);
          }}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-accent-line)] bg-[var(--color-accent-soft)] px-3 text-xs text-[var(--color-accent-ink)] transition-colors hover:bg-[var(--color-accent-soft-hover)]"
        >
          <Lightbulb className="size-3.5" />
          快速体验示例：职业院校知识库
        </button>
        <span className="text-[10px] text-[var(--color-ink-faint)]">只填入内容，不会自动生成</span>
      </div>

      <SectionAccordion
        label="查看结构化需求字段"
        description="可选：客户名称 / 行业 / 场景 / 痛点 / 需求 / 约束"
        className="border-0 bg-transparent"
        contentClassName="px-0"
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="客户名称">
              <Input
                value={form.customer}
                placeholder="如：某职业院校"
                onChange={(event) => updateForm("customer", event.target.value)}
              />
            </Field>
            <Field label="所属行业">
              <Input
                value={form.industry}
                placeholder="如：教育 / 零售 / 制造"
                onChange={(event) => updateForm("industry", event.target.value)}
              />
            </Field>
          </div>

          <Field label="业务场景">
            <Textarea
              rows={2}
              value={form.scenario}
              placeholder="如：招生咨询、教务政策问答"
              onChange={(event) => updateForm("scenario", event.target.value)}
            />
          </Field>

          <Field label="主要痛点">
            <Textarea
              rows={2}
              value={form.pain_points}
              placeholder="如：政策文件分散、人工答疑重复"
              onChange={(event) => updateForm("pain_points", event.target.value)}
            />
          </Field>

          <Field label="核心需求">
            <Textarea
              rows={2}
              value={form.requirements}
              placeholder="如：统一知识库、回答可追溯"
              onChange={(event) => updateForm("requirements", event.target.value)}
            />
          </Field>

          <Field label="约束条件">
            <Textarea
              rows={2}
              value={form.constraints}
              placeholder="如：预算有限、私有化部署"
              onChange={(event) => updateForm("constraints", event.target.value)}
            />
          </Field>
        </div>
      </SectionAccordion>
    </>
  );

  const generateButton = (
    <Button
      variant="primary"
      size="lg"
      className="w-full"
      loading={loading}
      disabled={!requirement.trim() && !Object.values(form).some(Boolean)}
      onClick={() => void generate()}
    >
      <Sparkles className="size-4" />
      生成售前方案
    </Button>
  );

  return (
    <div className="space-y-5">
      <PageIntro
        title="方案生成"
        subtitle="输入客户需求，AI 会理解需求、检索相关企业知识，并生成带来源依据的结构化售前方案。"
      />

      {!hasOutput ? (
        /* ------------------------------------------------- IDLE: full width */
        <>
          <MainTaskPanel>
            <MainTaskHeader
              title="客户需求"
              description="用一段话描述客户背景、场景与诉求即可"
              icon={<Wand2 className="size-4" />}
            />
            <MainTaskBody className="space-y-3">
              {requirementFields}

              <div className="rounded-[var(--radius-medium)] surface-inset border border-[var(--color-line-faint)] px-3 py-2.5">
                <p className="text-2xs font-medium tracking-[0.04em] text-[var(--color-ink-muted)]">
                  你将得到
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                  {EXPECTED.map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-1.5 text-2xs text-[var(--color-ink-soft)]"
                    >
                      <CheckCircle2 className="size-3 shrink-0 text-[var(--color-success)]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {generateButton}
            </MainTaskBody>
          </MainTaskPanel>

          {error ? <InlineError message={error} /> : null}

          <SectionAccordion label="查看生成设置" description="模型 · 检索模式 · 引用上限">
            {config.status === "success" ? (
              <div className="rounded-[var(--radius-medium)] surface-inset border border-[var(--color-line-faint)] px-3 py-1">
                <DefRow label="生成模型" mono>
                  {config.data.model}
                </DefRow>
                <DefRow label="检索模式" mono>
                  {config.data.retriever_mode}
                </DefRow>
                <DefRow label="引用上限" mono>
                  {config.data.rerank_top_k} 段
                </DefRow>
              </div>
            ) : (
              <p className="text-xs text-[var(--color-ink-muted)]">正在读取生成配置…</p>
            )}
          </SectionAccordion>
        </>
      ) : (
        /* ---------------------------------------------- RESULT: full width */
        <>
          {/* The input collapses to a single line. Expanding restores the whole
              form so the requirement can be edited and regenerated in place. */}
          <SectionAccordion
            label="本次客户需求"
            description={
              requirement.trim()
                ? requirement.trim().slice(0, 60) + (requirement.trim().length > 60 ? "…" : "")
                : "使用结构化字段"
            }
            icon={<Wand2 className="size-4" />}
          >
            <div className="space-y-3">
              {requirementFields}
              {generateButton}
            </div>
          </SectionAccordion>

          {error ? <InlineError message={error} /> : null}

          {loading && !result ? (
            <div className="flex items-center gap-4 rounded-[var(--radius-large)] surface-base border border-[var(--color-line-faint)] px-4 py-4">
              <KnowledgeMascot state="generating" size={56} />
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-[var(--color-ink)]">正在生成售前方案…</p>
                <p className="text-xs text-[var(--color-ink-muted)]">
                  理解需求 → 检索企业知识 → 逐章节生成
                </p>
              </div>
            </div>
          ) : null}

          {result ? (
            <>
              {/* The plan gets the full reading width — eight sections in a
                  2/3 column was the single worst readability problem. */}
              <ResultSection
                label="售前方案"
                className="animate-reveal"
                meta={`${result.sections.length} 章节 · ${result.citations.length} 引用 · ${formatMs(result.latency_ms)}`}
                icon={<FileText className="size-4" />}
                actions={
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      title="导出为 Markdown 文件（.md）"
                      loading={exporting === "markdown"}
                      onClick={() => void download("markdown")}
                    >
                      <Download className="size-3.5" />
                      Markdown
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      title="导出为 Word 文件（.docx）"
                      loading={exporting === "docx"}
                      onClick={() => void download("docx")}
                    >
                      <Download className="size-3.5" />
                      Word
                    </Button>
                  </>
                }
              >
                {/* The plan is a report: constrain the measure and give the
                    sections real document rhythm instead of one long scroll. */}
                <div className="mx-auto w-full max-w-[68ch]">
                  <div className="mb-5 flex flex-wrap items-center gap-1.5">
                    <Badge tone="neutral">{analysis?.customer_type || "未提及客户类型"}</Badge>
                    <Badge tone="neutral">{analysis?.industry || "未提及行业"}</Badge>
                    <Badge tone={groundedSections === result.sections.length ? "success" : "warning"}>
                      {groundedSections}/{result.sections.length} 章节带引用
                    </Badge>
                  </div>

                  <div>
                    {result.sections.map((section, index) => {
                      const risk = section.key === "risks";
                      return (
                        <section
                          key={section.key}
                          className={cn(
                            "border-t border-[var(--color-line-faint)] py-5 first:border-t-0 first:pt-0",
                            risk &&
                              "border-l-2 border-l-[var(--color-warning-line)] pl-4",
                          )}
                        >
                          <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <span className="font-mono text-2xs tabular-nums text-[var(--color-ink-faint)]">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <h3 className="text-[15px] font-semibold tracking-[-0.006em] text-[var(--color-ink)]">
                              {section.title}
                            </h3>
                            {/* Only the exception is badged. When 7 of 8 sections
                                are grounded, a green "含引用" on each one is
                                seven restatements of the strip above ("7/8
                                章节带引用") — noise, not signal. */}
                            {section.grounded ? null : (
                              <Badge tone="warning">无引用依据</Badge>
                            )}
                          </div>
                          <Markdown
                            content={section.content}
                            className="[&_tbody_tr:hover]:bg-[var(--color-surface-subtle)]"
                          />
                        </section>
                      );
                    })}
                  </div>
                </div>
              </ResultSection>

              {result.warnings.length > 0 ? (
                <div className="space-y-2">
                  {result.warnings.map((warning) => (
                    <InlineWarning key={warning} message={warning} />
                  ))}
                </div>
              ) : null}

              <StepNote
                label="本次方案生成过程"
                steps={["理解需求", "提取检索问题", "检索企业知识", "组织方案", "添加引用"]}
                detail={
                  <p className="text-2xs leading-relaxed text-[var(--color-ink-muted)]">
                    方案共 <b className="font-mono">{result.sections.length}</b> 个章节，其中{" "}
                    <b className="font-mono">{groundedSections}</b> 个章节带引用依据；使用{" "}
                    <b className="font-mono">{result.retrieved_chunks.length}</b> 段知识库证据，
                    正文引用 <b className="font-mono">{result.citations.length}</b> 处。
                  </p>
                }
              />

              {analysis ? (
                <SectionAccordion
                  label="查看需求解析"
                  description={`${analysis.core_needs.length} 条核心需求 · ${analysis.missing_info.length} 项待确认`}
                >
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="space-y-3">
                      <div>
                        <SectionLabel>核心需求</SectionLabel>
                        <ul className="mt-1.5 space-y-1">
                          {analysis.core_needs.map((item) => (
                            <li
                              key={item}
                              className="text-xs leading-relaxed text-[var(--color-ink-soft)]"
                            >
                              · {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <SectionLabel>主要痛点</SectionLabel>
                        <ul className="mt-1.5 space-y-1">
                          {analysis.pain_points.map((item) => (
                            <li
                              key={item}
                              className="text-xs leading-relaxed text-[var(--color-ink-soft)]"
                            >
                              · {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {analysis.constraints.length > 0 ? (
                        <div>
                          <SectionLabel>约束条件</SectionLabel>
                          <ul className="mt-1.5 space-y-1">
                            {analysis.constraints.map((item) => (
                              <li
                                key={item}
                                className="text-xs leading-relaxed text-[var(--color-ink-soft)]"
                              >
                                · {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <SectionLabel>推荐解决方向</SectionLabel>
                        <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-ink-soft)]">
                          {analysis.recommended_direction || "—"}
                        </p>
                      </div>
                      <div>
                        <SectionLabel>需要向客户确认</SectionLabel>
                        <ul className="mt-1.5 space-y-1">
                          {analysis.missing_info.map((item) => (
                            <li
                              key={item}
                              className="text-xs leading-relaxed text-[var(--color-ink-soft)]"
                            >
                              · {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <SectionLabel>检索查询词（由需求解析产出）</SectionLabel>
                        <p className="mt-1.5 rounded-[var(--radius-medium)] surface-inset border border-[var(--color-line-faint)] px-3 py-2 font-mono text-2xs text-[var(--color-ink-soft)]">
                          {analysis.search_query || "—"}
                        </p>
                      </div>
                      <div>
                        <SectionLabel>需求解析来源</SectionLabel>
                        <p className="mt-1.5 text-xs text-[var(--color-ink-soft)]">
                          {analysis.generated_by === "llm" ? "模型解析" : "规则提取"}
                        </p>
                      </div>
                    </div>
                  </div>
                </SectionAccordion>
              ) : null}

              <SectionAccordion
                label="查看检索证据与引用详情"
                description={`${result.retrieved_chunks.length} 段召回 · ${result.citations.length} 处引用`}
              >
                <p className="mb-3 text-2xs text-[var(--color-ink-muted)]">
                  方案正文中的 <span className="font-mono">[n]</span> 编号即对应下列片段顺序。引用覆盖{" "}
                  {formatPercent(
                    result.citations.length / Math.max(result.retrieved_chunks.length, 1),
                  )}
                  。
                </p>
                <RetrievalPanel chunks={result.retrieved_chunks} />
              </SectionAccordion>

              <SectionAccordion label="查看生成技术过程" description="本次生成经过的 8 个节点">
                <ol className="space-y-2">
                  {result.trace.map((step) => (
                    <li
                      key={`${step.index}-${step.node}`}
                      className="rounded-[var(--radius-medium)] surface-inset border border-[var(--color-line-faint)] px-3.5 py-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--color-accent-soft)] font-mono text-[10px] font-semibold text-[var(--color-accent-ink)]">
                          {step.index}
                        </span>
                        <span className="min-w-0 truncate text-xs font-medium text-[var(--color-ink)]">
                          {step.title}
                        </span>
                        <span className="ml-auto shrink-0 font-mono text-2xs text-[var(--color-ink-faint)]">
                          {formatMs(step.duration_ms)}
                        </span>
                      </div>
                      {step.summary ? (
                        <p className="mt-1 pl-7 text-2xs leading-relaxed text-[var(--color-ink-muted)]">
                          {step.summary}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </SectionAccordion>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
