"use client";

import { FlaskConical, Play, RotateCcw, Target, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";

import { StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TD, TH, TR, Table } from "@/components/ui/data";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState, ErrorState, InlineError, InlineInfo, SkeletonRows } from "@/components/ui/states";
import { StatCard } from "@/components/ui/data";
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
      <InlineInfo message="检索指标（Hit@K / MRR / Recall@K / 关键词覆盖）全部由确定性计算得出。答案准确率只在人工评分后才有数值，未评分时为 null —— 本项目不使用模型自评分数。" />

      {/* ----------------------------------------------------------- runner */}
      <Card>
        <CardHeader
          title="运行检索评测"
          description="对评测数据集逐条执行检索，统计命中与排序质量"
          icon={<FlaskConical className="size-4" />}
          dense
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
        <CardContent className="flex flex-wrap items-end gap-3">
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
              数据集共 {dataset.data.total} 条用例 · 存储于 {dataset.data.path}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {error ? <InlineError message={error} /> : null}

      {/* ----------------------------------------------------------- metrics */}
      {result ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard
              label={`Hit@${result.summary.k}`}
              value={formatPercent(result.summary.hit_at_k, 1)}
              hint="期望文档进入 Top-K 的比例"
              tone={result.summary.hit_at_k >= 0.8 ? "success" : "warning"}
              icon={<Target className="size-4" />}
            />
            <StatCard
              label="MRR"
              value={result.summary.mrr.toFixed(3)}
              hint="首个命中名次的倒数均值"
              tone="accent"
            />
            <StatCard
              label={`Recall@${result.summary.k}`}
              value={formatPercent(result.summary.recall_at_k, 1)}
              hint="期望文档被召回的比例"
            />
            <StatCard
              label="关键词覆盖"
              value={formatPercent(result.summary.keyword_coverage, 1)}
              hint="召回片段覆盖问题关键词的比例"
            />
            <StatCard
              label="答案准确率"
              value={
                result.summary.answer_accuracy === null
                  ? "未评分"
                  : formatPercent(result.summary.answer_accuracy, 1)
              }
              hint={`已人工评分 ${result.summary.graded_count} 条`}
              tone={result.summary.answer_accuracy === null ? "warning" : "success"}
            />
          </div>

          <Card>
            <CardHeader
              dense
              title="逐条结果"
              description={`模式 ${result.summary.mode} · 平均检索耗时 ${formatMs(result.summary.average_latency_ms)}`}
            />
            <CardContent>
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
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          icon={<FlaskConical className="size-5" />}
          title="还没有运行结果"
          description="点击「运行评测」对数据集执行一次检索评估。会输出 Hit@K、MRR、Recall@K 与关键词覆盖度，并可对每条结果做人工评分。"
        />
      )}

      {/* ----------------------------------------------------------- dataset */}
      <Card>
        <CardHeader
          title="评测数据集"
          description="期望文档由文档名匹配生成；建议人工校准"
          icon={<Target className="size-4" />}
          dense
          actions={
            <Button size="sm" variant="ghost" onClick={reloadAll}>
              <RotateCcw className="size-3.5" />
              刷新
            </Button>
          }
        />
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------- history */}
      <Card>
        <CardHeader dense title="历史评测记录" description="最近 8 次运行" />
        <CardContent>
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
                {history.data.map((run) => (
                  <TR key={run.run_id}>
                    <TD>
                      <span className="text-2xs text-[var(--color-ink-muted)]">
                        {run.started_at ? new Date(run.started_at).toLocaleString("zh-CN") : "—"}
                      </span>
                    </TD>
                    <TD align="right" mono>
                      {run.case_count}
                    </TD>
                    <TD align="right" mono>
                      {run.k}
                    </TD>
                    <TD mono>{run.mode}</TD>
                    <TD align="right" mono>
                      {formatPercent(run.hit_at_k, 1)}
                    </TD>
                    <TD align="right" mono>
                      {run.mrr.toFixed(3)}
                    </TD>
                    <TD align="right" mono>
                      {formatPercent(run.recall_at_k, 1)}
                    </TD>
                    <TD align="right" mono>
                      {run.answer_accuracy === null ? "—" : formatPercent(run.answer_accuracy, 1)}
                    </TD>
                    <TD align="right" mono>
                      {formatMs(run.duration_ms)}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="py-6 text-center text-xs text-[var(--color-ink-faint)]">
              还没有历史记录。
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-2xs text-[var(--color-ink-faint)]">
        <ThumbsUp className="size-3" />
        <ThumbsDown className="size-3" />
        <span>人工评分用于衡量「回答是否正确」，与检索指标分开统计，避免把两件事混为一谈。</span>
      </div>
    </div>
  );
}
