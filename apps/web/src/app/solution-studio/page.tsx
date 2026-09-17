"use client";

import { Download, FileText, Lightbulb, Sparkles, Wand2 } from "lucide-react";
import { useCallback, useState } from "react";

import { KnowledgeMascot } from "@/components/mascot/knowledge-mascot";
import { Markdown } from "@/components/rag/markdown";
import { RetrievalPanel } from "@/components/rag/retrieval-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, DefRow, SectionLabel } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { EmptyState, InlineError, InlineWarning } from "@/components/ui/states";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/providers/toast-provider";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { RequirementForm, SolutionResponse } from "@/lib/types";
import { formatMs, formatPercent } from "@/lib/utils";

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

type Tab = "sections" | "analysis" | "evidence";

export default function SolutionStudioPage() {
  const { toast } = useToast();
  const config = useAsync(() => api.solutionConfig(), []);

  const [requirement, setRequirement] = useState("");
  const [form, setForm] = useState<RequirementForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SolutionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("sections");
  const [exporting, setExporting] = useState<"markdown" | "docx" | null>(null);

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
        toast({ title: `已导出 ${format === "docx" ? "Word" : "Markdown"} 文件`, variant: "success" });
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

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      {/* ----------------------------------------------------- intake form */}
      <div className="space-y-4">
        <Card>
          <CardHeader
            title="客户需求"
            description="自然语言与结构化表单可任意组合，Agent 会自动解析为需求画像"
            icon={<Wand2 className="size-4" />}
            dense
          />
          <CardContent className="space-y-3">
            <Textarea
              rows={5}
              value={requirement}
              placeholder="用自然语言描述客户背景、场景与诉求…"
              onChange={(event) => setRequirement(event.target.value)}
            />

            <button
              type="button"
              onClick={() => {
                setRequirement(EXAMPLE.requirement);
                setForm(EXAMPLE.form);
              }}
              className="flex items-center gap-1.5 text-2xs text-[var(--color-accent)] transition-colors hover:underline"
            >
              <Lightbulb className="size-3" />
              填入示例客户需求（职业院校知识库）
            </button>

            <div className="grid gap-3 border-t border-[var(--color-line-faint)] pt-3 sm:grid-cols-2">
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

            <Button
              variant="primary"
              className="w-full"
              loading={loading}
              onClick={() => void generate()}
            >
              <Sparkles className="size-3.5" />
              生成售前方案
            </Button>

            {config.status === "success" ? (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-1">
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
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* ---------------------------------------------------------- output */}
      <div className="min-w-0 space-y-4">
        {error ? <InlineError message={error} /> : null}

        {loading ? (
          <Card>
            <CardContent className="flex items-center gap-5">
              <KnowledgeMascot state="generating" size={72} />
              <div className="space-y-1">
                <p className="text-sm font-medium text-[var(--color-ink)]">正在生成售前方案…</p>
                <p className="text-xs text-[var(--color-ink-muted)]">
                  解析客户需求 → 检索方案资料 → 逐章节生成（8 个章节，全部标注引用）
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {!loading && !result ? (
          <EmptyState
            icon={<FileText className="size-5" />}
            title="还没有生成方案"
            description="填写左侧客户需求（或直接点「填入示例客户需求」），然后点击「生成售前方案」。生成的方案包含 Executive Summary 到 Next Steps 共 8 个章节，并在正文标注引用来源。"
          />
        ) : null}

        {result ? (
          <>
            {/* meta strip */}
            <Card>
              <CardHeader
                dense
                title="方案概览"
                description={`${result.sections.length} 个章节 · ${result.citations.length} 条引用 · ${formatMs(result.latency_ms)}`}
                actions={
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      loading={exporting === "markdown"}
                      onClick={() => void download("markdown")}
                    >
                      <Download className="size-3.5" />
                      Markdown
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      loading={exporting === "docx"}
                      onClick={() => void download("docx")}
                    >
                      <Download className="size-3.5" />
                      Word
                    </Button>
                  </>
                }
              />
              <CardContent className="grid gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-2xs text-[var(--color-ink-faint)]">客户类型</p>
                  <p className="mt-0.5 text-sm text-[var(--color-ink)]">
                    {analysis?.customer_type || "未提及"}
                  </p>
                </div>
                <div>
                  <p className="text-2xs text-[var(--color-ink-faint)]">行业</p>
                  <p className="mt-0.5 text-sm text-[var(--color-ink)]">
                    {analysis?.industry || "未提及"}
                  </p>
                </div>
                <div>
                  <p className="text-2xs text-[var(--color-ink-faint)]">需求解析来源</p>
                  <p className="mt-0.5 text-sm text-[var(--color-ink)]">
                    {analysis?.generated_by === "llm" ? "模型解析" : "规则提取"}
                  </p>
                </div>
                <div>
                  <p className="text-2xs text-[var(--color-ink-faint)]">溯源强度</p>
                  <p className="mt-0.5 text-sm text-[var(--color-ink)]">
                    {result.sections.filter((section) => section.grounded).length}/
                    {result.sections.length} 章节带引用
                  </p>
                </div>
              </CardContent>
            </Card>

            {result.warnings.length > 0 ? (
              <div className="space-y-2">
                {result.warnings.map((warning) => (
                  <InlineWarning key={warning} message={warning} />
                ))}
              </div>
            ) : null}

            <Card>
              <Tabs<Tab>
                value={tab}
                onChange={setTab}
                className="px-3"
                options={[
                  { value: "sections", label: "方案正文", count: result.sections.length },
                  { value: "analysis", label: "需求解析" },
                  { value: "evidence", label: "引用证据", count: result.retrieved_chunks.length },
                ]}
              />
              <CardContent>
                {tab === "sections" ? (
                  <div className="space-y-6">
                    {result.sections.map((section) => (
                      <section key={section.key}>
                        <div className="mb-2 flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-[var(--color-ink)]">
                            {section.title}
                          </h3>
                          <Badge tone={section.grounded ? "success" : "warning"}>
                            {section.grounded ? "含引用" : "无引用依据"}
                          </Badge>
                        </div>
                        <Markdown content={section.content} />
                      </section>
                    ))}
                  </div>
                ) : null}

                {tab === "analysis" && analysis ? (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-3">
                      <div>
                        <SectionLabel>核心需求</SectionLabel>
                        <ul className="mt-1.5 space-y-1">
                          {analysis.core_needs.map((item) => (
                            <li key={item} className="text-xs leading-relaxed text-[var(--color-ink-soft)]">
                              · {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <SectionLabel>主要痛点</SectionLabel>
                        <ul className="mt-1.5 space-y-1">
                          {analysis.pain_points.map((item) => (
                            <li key={item} className="text-xs leading-relaxed text-[var(--color-ink-soft)]">
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
                              <li key={item} className="text-xs leading-relaxed text-[var(--color-ink-soft)]">
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
                            <li key={item} className="text-xs leading-relaxed text-[var(--color-ink-soft)]">
                              · {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <SectionLabel>检索查询词（由需求解析产出）</SectionLabel>
                        <p className="mt-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-sunken)] px-3 py-2 font-mono text-2xs text-[var(--color-ink-soft)]">
                          {analysis.search_query || "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {tab === "evidence" ? (
                  <div className="space-y-3">
                    <p className="text-2xs text-[var(--color-ink-muted)]">
                      方案正文中的 <span className="font-mono">[n]</span> 编号即对应下列片段顺序。
                      共引用 {result.citations.length} 处，来源{" "}
                      {formatPercent(
                        result.sources.length
                          ? result.citations.length /
                              Math.max(result.retrieved_chunks.length, 1)
                          : 0,
                      )}
                      。
                    </p>
                    <RetrievalPanel chunks={result.retrieved_chunks} />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}
