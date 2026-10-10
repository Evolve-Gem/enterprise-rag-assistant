"use client";

import { FlaskConical, Play, RotateCcw, Target, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";

import { StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar, TD, TH, TR, Table } from "@/components/ui/data";
import { Field, Input, Select } from "@/components/ui/field";
import { PageIntro } from "@/components/ui/page-intro";
import {
  MainTaskBody,
  MainTaskHeader,
  MainTaskPanel,
  ResultSection,
  SectionAccordion,
} from "@/components/ui/section";
import { EmptyState, ErrorState, InlineError, InlineInfo, SkeletonRows } from "@/components/ui/states";
import { useToast } from "@/components/providers/toast-provider";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { EvalRunResponse } from "@/lib/types";
import { formatMs, formatPercent } from "@/lib/utils";

const GRADES = [
  { value: "correct", label: "正确", tone: "success" as const },
  { value: "partial", label: "部分正确", tone: "warning" as const },
  { value: "wrong", label: "错误", tone: "danger" as const },
];

const METRIC_HELP = [
  {
    label: "Hit@K",
    plain: "前 K 条检索结果里，至少有一条是正确资料的比例。",
    tech: "命中用例数 ÷ 有期望文档的用例数；没有期望文档的用例不计入。",
  },
  {
    label: "MRR",
    plain: "正确资料排得越靠前，分数越高。",
    tech: "对每个用例取首个正确资料名次的倒数（1/rank），再对所有用例求平均。",
  },
  {
    label: "Recall@K",
    plain: "该被找出来的正确资料，有多大比例真的出现在前 K 条里。",
    tech: "前 K 条命中的期望文档数 ÷ 期望文档总数，再对用例求平均。",
  },
  {
    label: "关键词覆盖",
    plain: "召回的片段覆盖了问题所要求关键词的比例。",
    tech: "命中关键词数 ÷ 期望关键词总数；期望关键词为空时不计入。",
  },
];

/**
 * 用户结论，纯函数。
 *
 * 只用确定性指标 hit_at_k 计算，不调用模型、不写死整段文案；
 * 阈值与页面其它地方保持一致（0.8 / 0.5）。
 */
function hitVerdict(hitAtK: number): string {
  if (hitAtK >= 0.8) return "当前测试集中，大多数正确资料能够进入前 K 条结果。";
  if (hitAtK >= 0.5) return "当前测试集中，约一半以上的正确资料能进入前 K 条结果。";
  return "当前测试集中，正确资料进入前 K 条的比例偏低。";
}

export default function EvaluationPage() {
  const { toast } = useToast();
  const dataset = useAsync(() => api.evalDataset(), []);
  const history = useAsync(() => api.evalRuns(8), []);

  const [k, setK] = useState(4);
  const [mode, setMode] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<EvalRunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newQuestion, setNewQuestion] = useState("");
  const [newKeywords, setNewKeywords] = useState("");
  const [adding, setAdding] = useState(false);
  const [grading, setGrading] = useState<string | null>(null);

  const reloadAll = useCallback(() => {
    void dataset.reload();
    void history.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset.reload, history.reload]);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const response = await api.evalRun({ k, mode: mode || null });
      setResult(response);
      toast({
        title: "评测完成",
        description: `Hit@${k} = ${formatPercent(response.summary.hit_at_k, 1)} · MRR = ${response.summary.mrr.toFixed(3)}`,
        variant: "success",
      });
      void history.reload();
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : "评测运行失败。";
      setError(message);
      toast({ title: "评测失败", description: message, variant: "error" });
    } finally {
      setRunning(false);
    }
  }, [k, mode, toast, history]);

  const addCase = useCallback(async () => {
    if (!newQuestion.trim()) return;
    setAdding(true);
    try {
      await api.evalAddCase({
        question: newQuestion.trim(),
        expected_keywords: newKeywords
          .split(/[,，、\s]+/)
          .map((item) => item.trim())
          .filter(Boolean),
        expected_document_ids: [],
        notes: "手工添加，期望文档待校准",
      });
      setNewQuestion("");
      setNewKeywords("");
      toast({
        title: "已添加用例",
        description: "期望文档为空时，该用例只统计关键词覆盖度，不计入 Hit@K。",
        variant: "success",
      });
      void dataset.reload();
    } catch (caught) {
      toast({
        title: "添加失败",
        description: caught instanceof ApiError ? caught.message : "请重试。",
        variant: "error",
      });
    } finally {
      setAdding(false);
    }
  }, [newQuestion, newKeywords, toast, dataset]);

  const grade = useCallback(
    async (caseId: string, value: string) => {
      setGrading(caseId);
      try {
        const response = await api.evalFeedback({ case_id: caseId, grade: value });
        setResult((current) =>
          current
            ? {
                ...current,
                cases: current.cases.map((item) =>
                  item.case_id === caseId
                    ? { ...item, answer_grade: value as typeof item.answer_grade }
                    : item,
                ),
                summary: {
                  ...current.summary,
                  graded_count: response.total_graded,
                  answer_accuracy: response.answer_accuracy,
                },
              }
            : current,
        );
        toast({ title: "评分已记录", variant: "success", duration: 1500 });
      } catch (caught) {
        toast({
          title: "评分失败",
          description: caught instanceof ApiError ? caught.message : "请重试。",
          variant: "error",
        });
      } finally {
        setGrading(null);
      }
    },
    [toast],
  );

  const removeCase = useCallback(
    async (caseId: string) => {
      try {
        await api.evalDeleteCase(caseId);
        void dataset.reload();
        toast({ title: "用例已删除", variant: "success", duration: 1500 });
      } catch (caught) {
        toast({
          title: "删除失败",
          description: caught instanceof ApiError ? caught.message : "请重试。",
          variant: "error",
        });
      }
    },
    [dataset, toast],
  );

  return (
    <div className="space-y-5">
      <PageIntro
        kicker="Evaluation"
        title="RAG 评测"
        subtitle="用固定测试集检验检索是否真的找到正确资料。选好参数运行一次，就能看到结果与结论。"
      />

      <InlineInfo message="检索指标（Hit@K / MRR / Recall@K / 关键词覆盖）全部由确定性计算得出；答案准确率只在人工评分后才有数值，本项目不使用模型自评分数。" />

      {/* ----------------------------------------------------------- runner · 主任务 */}
      <MainTaskPanel>
        <MainTaskHeader
          title="运行检索评测"
          description="对评测数据集逐条执行检索，统计命中与排序质量"
          icon={<FlaskConical className="size-4" />}
          actions={
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await api.evalSeed();
                    void dataset.reload();
                    toast({ title: "已重置为内置种子数据集", variant: "success" });
                  } catch {
                    toast({ title: "重置失败", variant: "error" });
                  }
                }}
              >
                <RotateCcw className="size-3.5" />
                重置数据集
              </Button>
              <Button size="sm" variant="primary" loading={running} onClick={() => void run()}>
                <Play className="size-3.5" />
                运行评测
              </Button>
            </>
          }
        />
        <MainTaskBody className="flex flex-wrap items-end gap-3">
          <Field label="K 值" className="w-28">
            <Select value={String(k)} onChange={(event) => setK(Number(event.target.value))}>
              {[1, 2, 4, 6, 8, 10].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="检索模式" className="w-40">
            <Select value={mode} onChange={(event) => setMode(event.target.value)}>
              <option value="">使用服务默认</option>
              <option value="hybrid">hybrid</option>
              <option value="keyword">keyword</option>
              <option value="vector">vector</option>
            </Select>
          </Field>
          {dataset.status === "success" ? (
            <p className="text-2xs text-[var(--color-ink-muted)]">
              数据集共 {dataset.data.total} 条用例 · 文件 {dataset.data.path.split(/[\\/]/).pop()}
            </p>
          ) : null}
        </MainTaskBody>
      </MainTaskPanel>

      {error ? <InlineError message={error} /> : null}

      {/* ----------------------------------------------------------- result */}
      {result ? (
        <>
          <ResultSection
            label="评测结果"
            meta={`模式 ${result.summary.mode} · ${result.summary.case_count} 条用例 · 平均检索耗时 ${formatMs(result.summary.average_latency_ms)}`}
            icon={<Target className="size-4" />}
          >
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-[var(--color-ink)]">
                {hitVerdict(result.summary.hit_at_k)}
              </p>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <MetricCard
                  label={`Hit@${result.summary.k}`}
                  value={formatPercent(result.summary.hit_at_k, 1)}
                  meaning="前 K 条结果里至少有一条正确资料的比例"
                  ratio={result.summary.hit_at_k}
                />
                <MetricCard
                  label="MRR"
                  value={result.summary.mrr.toFixed(3)}
                  meaning="首个正确资料名次的倒数均值，越靠前越高"
                  ratio={result.summary.mrr}
                />
                <MetricCard
                  label={`Recall@${result.summary.k}`}
                  value={formatPercent(result.summary.recall_at_k, 1)}
                  meaning="期望资料中真正被召回的比例"
                  ratio={result.summary.recall_at_k}
                />
              </div>
            </div>
          </ResultSection>

          <SectionAccordion
            label="查看逐条评测结果"
            description={`${result.cases.length} 条用例，可逐条做人工评分`}
            icon={<Target className="size-4" />}
          >
            <Table>
              <thead>
                <tr>
                  <TH>问题</TH>
                  <TH>命中</TH>
                  <TH align="right">名次</TH>
                  <TH align="right">关键词覆盖</TH>
                  <TH>缺失关键词</TH>
                  <TH>失败归因</TH>
                  <TH>人工评分</TH>
                </tr>
              </thead>
              <tbody>
                {result.cases.map((item) => (
                  <TR key={item.case_id}>
                    <TD>
                      <span className="block max-w-[20rem] text-xs text-[var(--color-ink)]">
                        {item.question}
                      </span>
                    </TD>
                    <TD>
                      <span className="inline-flex items-center gap-1.5">
                        <StatusDot tone={item.hit_at_k ? "success" : "danger"} />
                        <span className="text-xs">{item.hit_at_k ? "HIT" : "MISS"}</span>
                      </span>
                    </TD>
                    <TD align="right" mono>
                      {item.first_hit_rank ?? "—"}
                    </TD>
                    <TD align="right" mono>
                      {formatPercent(item.keyword_coverage)}
                    </TD>
                    <TD>
                      <span className="text-2xs text-[var(--color-ink-muted)]">
                        {item.missing_keywords.slice(0, 4).join("、") || "—"}
                      </span>
                    </TD>
                    <TD>
                      <span className="text-2xs text-[var(--color-ink-muted)]">
                        {item.failure_reason || "—"}
                      </span>
                    </TD>
                    <TD>
                      <span className="flex items-center gap-1">
                        {GRADES.map((g) => (
                          <button
                            key={g.value}
                            type="button"
                            disabled={grading === item.case_id}
                            onClick={() => void grade(item.case_id, g.value)}
                            title={g.label}
                            className={
                              item.answer_grade === g.value
                                ? "rounded-[var(--radius-xs)] border border-[var(--color-accent-line)] bg-[var(--color-accent-soft)] px-1.5 py-0.5 text-2xs text-[var(--color-accent-ink)]"
                                : "rounded-[var(--radius-xs)] border border-[var(--color-line)] px-1.5 py-0.5 text-2xs text-[var(--color-ink-muted)] transition-colors hover:border-[var(--color-line-strong)] hover:text-[var(--color-ink)]"
                            }
                          >
                            {g.label}
                          </button>
                        ))}
                      </span>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </SectionAccordion>

          <SectionAccordion
            label="查看其余指标（关键词覆盖 · 答案准确率）"
            description="答案准确率只在人工评分后才有数值，未评分显示「未评分」"
          >
            <div className="grid grid-cols-2 gap-2.5">
              <MetricCard
                label="关键词覆盖"
                value={formatPercent(result.summary.keyword_coverage, 1)}
                meaning="召回片段覆盖问题关键词的比例"
                ratio={result.summary.keyword_coverage}
              />
              <MetricCard
                label="答案准确率"
                value={
                  result.summary.answer_accuracy === null
                    ? "未评分"
                    : formatPercent(result.summary.answer_accuracy, 1)
                }
                meaning={`已人工评分 ${result.summary.graded_count} 条`}
                ratio={result.summary.answer_accuracy}
              />
            </div>
          </SectionAccordion>
        </>
      ) : (
        <EmptyState
          icon={<FlaskConical className="size-5" />}
          title="还没有运行结果"
          description="选好 K 值与检索模式，点击「运行评测」对数据集执行一次检索评估。会输出 Hit@K、MRR、Recall@K 与关键词覆盖度，并可对每条结果做人工评分。"
        />
      )}

      {/* ----------------------------------------------------------- 指标定义 · 折叠 */}
      <SectionAccordion
        label="查看指标定义"
        description="Hit@K / MRR / Recall@K / 关键词覆盖 的通俗解释与技术定义"
        icon={<Target className="size-4" />}
      >
        <dl className="space-y-3">
          {METRIC_HELP.map((item) => (
            <div key={item.label}>
              <dt className="text-xs font-semibold text-[var(--color-ink)]">{item.label}</dt>
              <dd className="mt-0.5 text-xs leading-relaxed text-[var(--color-ink-muted)]">
                {item.plain}
                <span className="mt-0.5 block text-2xs text-[var(--color-ink-faint)]">
                  技术定义：{item.tech}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </SectionAccordion>

      {/* ----------------------------------------------------------- 数据集 · 折叠 */}
      <SectionAccordion
        label="查看完整评测数据集"
        description={
          dataset.status === "success"
            ? `期望文档由文档名匹配生成，建议人工校准 · 共 ${dataset.data.total} 条`
            : "期望文档由文档名匹配生成，建议人工校准"
        }
        icon={<Target className="size-4" />}
      >
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={reloadAll}>
              <RotateCcw className="size-3.5" />
              刷新
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-3">
            <Field label="新增用例" className="min-w-[18rem] flex-1">
              <Input
                value={newQuestion}
                placeholder="输入评测问题"
                onChange={(event) => setNewQuestion(event.target.value)}
              />
            </Field>
            <Field label="期望关键词（逗号分隔）" className="min-w-[14rem] flex-1">
              <Input
                value={newKeywords}
                placeholder="召回, 排序, 候选"
                onChange={(event) => setNewKeywords(event.target.value)}
              />
            </Field>
            <Button
              variant="primary"
              loading={adding}
              disabled={!newQuestion.trim()}
              onClick={() => void addCase()}
            >
              添加
            </Button>
          </div>

          {dataset.status === "loading" ? (
            <SkeletonRows count={5} />
          ) : dataset.status === "error" ? (
            <ErrorState error={dataset.error} onRetry={dataset.reload} compact />
          ) : dataset.data.cases.length === 0 ? (
            <EmptyState title="数据集为空" description="添加用例或点击「重置数据集」生成内置种子用例。" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <TH>问题</TH>
                  <TH align="right">期望文档</TH>
                  <TH>期望关键词</TH>
                  <TH>备注</TH>
                  <TH align="right">操作</TH>
                </tr>
              </thead>
              <tbody>
                {dataset.data.cases.map((item) => (
                  <TR key={item.id}>
                    <TD>
                      <span className="block max-w-[22rem] text-xs text-[var(--color-ink)]">
                        {item.question}
                      </span>
                    </TD>
                    <TD align="right" mono>
                      {item.expected_document_ids.length}
                    </TD>
                    <TD>
                      <span className="text-2xs text-[var(--color-ink-muted)]">
                        {item.expected_keywords.join("、") || "—"}
                      </span>
                    </TD>
                    <TD>
                      <span className="text-2xs text-[var(--color-ink-faint)]">
                        {item.notes || "—"}
                      </span>
                    </TD>
                    <TD align="right">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="删除用例"
                        onClick={() => void removeCase(item.id)}
                      >
                        <Trash2 className="size-3.5 text-[var(--color-danger)]" />
                      </Button>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </SectionAccordion>

      {/* ----------------------------------------------------------- 历史 · 折叠 */}
      <SectionAccordion
        label="查看历史运行"
        description="最近 8 次运行的检索指标"
        icon={<FlaskConical className="size-4" />}
      >
        {history.status === "success" && history.data.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <TH>时间</TH>
                <TH align="right">用例数</TH>
                <TH align="right">K</TH>
                <TH>模式</TH>
                <TH align="right">Hit@K</TH>
                <TH align="right">MRR</TH>
                <TH align="right">Recall</TH>
                <TH align="right">答案准确率</TH>
                <TH align="right">耗时</TH>
              </tr>
            </thead>
            <tbody>
              {history.data.map((runItem) => (
                <TR key={runItem.run_id}>
                  <TD>
                    <span className="text-2xs text-[var(--color-ink-muted)]">
                      {runItem.started_at
                        ? new Date(runItem.started_at).toLocaleString("zh-CN")
                        : "—"}
                    </span>
                  </TD>
                  <TD align="right" mono>
                    {runItem.case_count}
                  </TD>
                  <TD align="right" mono>
                    {runItem.k}
                  </TD>
                  <TD mono>{runItem.mode}</TD>
                  <TD align="right" mono>
                    {formatPercent(runItem.hit_at_k, 1)}
                  </TD>
                  <TD align="right" mono>
                    {runItem.mrr.toFixed(3)}
                  </TD>
                  <TD align="right" mono>
                    {formatPercent(runItem.recall_at_k, 1)}
                  </TD>
                  <TD align="right" mono>
                    {runItem.answer_accuracy === null
                      ? "—"
                      : formatPercent(runItem.answer_accuracy, 1)}
                  </TD>
                  <TD align="right" mono>
                    {formatMs(runItem.duration_ms)}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="py-6 text-center text-xs text-[var(--color-ink-faint)]">还没有历史记录。</p>
        )}
      </SectionAccordion>

      {/* ----------------------------------------------------------- 评分说明 · 折叠 */}
      <SectionAccordion label="查看人工评分说明">
        <div className="flex items-center gap-2 text-2xs text-[var(--color-ink-faint)]">
          <ThumbsUp className="size-3" />
          <ThumbsDown className="size-3" />
          <span>
            人工评分用于衡量「回答是否正确」，与检索指标分开统计，避免把两件事混为一谈。
          </span>
        </div>
      </SectionAccordion>
    </div>
  );
}

/**
 * Metric display tier.
 *
 * Presentation only: reuses the same two cut-offs already used by `hitVerdict`
 * in this file (0.8 / 0.5). No metric, threshold or verdict is computed here
 * beyond turning an existing ratio into a readable status word.
 */
function metricStatus(ratio: number | null): {
  label: string;
  tone: "success" | "warning" | "danger";
} {
  if (ratio === null) return { label: "未评分", tone: "warning" };
  if (ratio >= 0.8) return { label: "良好", tone: "success" };
  if (ratio >= 0.5) return { label: "一般", tone: "warning" };
  return { label: "偏低", tone: "danger" };
}

/**
 * Metric / Meaning / Status.
 *
 * A bare number does not say what it measures or whether it is acceptable, so
 * every metric carries three things: the value, one plain sentence explaining
 * it, and a status indicator (a dot + word, plus a thin meter when the metric
 * is a 0–1 ratio).
 */
function MetricCard({
  label,
  value,
  meaning,
  ratio,
}: {
  label: string;
  value: React.ReactNode;
  meaning: string;
  ratio: number | null;
}) {
  const status = metricStatus(ratio);
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line-faint)] surface-subtle px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-2xs font-semibold tracking-[0.04em] text-[var(--color-ink-muted)]">
          {label}
        </p>
        <span className="inline-flex items-center gap-1.5">
          <StatusDot tone={status.tone} />
          <span className="text-2xs text-[var(--color-ink-muted)]">{status.label}</span>
        </span>
      </div>
      <p className="mt-1 text-xl font-semibold leading-tight tabular-nums text-[var(--color-ink)]">
        {value}
      </p>
      <p className="mt-1 text-2xs leading-relaxed text-[var(--color-ink-muted)]">{meaning}</p>
      {ratio !== null ? (
        <ProgressBar className="mt-2" value={ratio} tone={status.tone} height="h-1" />
      ) : null}
    </div>
  );
}
