"use client";

import { CornerDownLeft, Eraser, Settings2, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { AnswerCard, AnswerPlaceholder } from "@/components/rag/answer-card";
import { GenerationState, RAG_STAGES } from "@/components/rag/generation-state";
import { SourceDrawer } from "@/components/rag/source-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Select, Textarea } from "@/components/ui/field";
import { InlineError, InlineWarning } from "@/components/ui/states";
import { SegmentedControl, Switch } from "@/components/ui/toggle";
import { useToast } from "@/components/providers/toast-provider";
import { api, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { ChatMessage, RagQueryResponse, SettingsResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  "Rerank 在 RAG 检索链路里解决什么问题？",
  "Top K 设置过大或过小分别有什么影响？",
  "RAG 和微调有什么区别？",
  "Skill 和 Tool 有什么区别？",
  "如何评估一个 RAG 系统的效果？",
];

type Mode = "hybrid" | "keyword" | "vector";
type RerankProvider = "heuristic" | "llm" | "off";

export default function AskPage() {
  const { toast } = useToast();
  const settings = useAsync<SettingsResponse>(() => api.settings(), []);

  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [response, setResponse] = useState<RagQueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<{ question: string; answer: string }[]>([]);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [mode, setMode] = useState<Mode>("hybrid");
  const [rerankProvider, setRerankProvider] = useState<RerankProvider>("heuristic");
  const [topK, setTopK] = useState(8);
  const [rerankTopK, setRerankTopK] = useState(4);
  const [allowFallback, setAllowFallback] = useState(true);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeCitation, setActiveCitation] = useState<number | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  /* advance the stage indicator while the request is in flight */
  useEffect(() => {
    if (!loading) return;
    setStage(0);
    const timer = setInterval(() => {
      setStage((current) => (current < RAG_STAGES.length - 1 ? current + 1 : current));
    }, 900);
    return () => clearInterval(timer);
  }, [loading]);

  const submit = useCallback(
    async (raw?: string) => {
      const text = (raw ?? question).trim();
      if (!text || loading) return;

      setLoading(true);
      setError(null);
      setResponse(null);

      const history: ChatMessage[] = turns.flatMap((turn) => [
        { role: "user" as const, content: turn.question },
        { role: "assistant" as const, content: turn.answer.slice(0, 600) },
      ]);

      try {
        const result = await api.chat({
          question: text,
          top_k: topK,
          rerank_top_k: rerankTopK,
          mode,
          rerank_provider: rerankProvider,
          allow_general_fallback: allowFallback,
          history: history.slice(-6),
        });
        setResponse(result);
        setTurns((current) => [...current, { question: text, answer: result.answer }].slice(-6));
        setQuestion("");
      } catch (caught) {
        const message =
          caught instanceof ApiError ? caught.message : "请求失败，请确认后端服务状态。";
        setError(message);
        toast({ title: "问答失败", description: message, variant: "error" });
      } finally {
        setLoading(false);
      }
    },
    [question, loading, turns, topK, rerankTopK, mode, rerankProvider, allowFallback, toast],
  );

  const openCitation = useCallback((index: number) => {
    setActiveCitation(index);
    setDrawerOpen(true);
  }, []);

  const llmReady = settings.status === "success" && settings.data.providers.llm.configured;

  return (
    <div className="space-y-5">
      {settings.status === "success" && !llmReady ? (
        <InlineWarning message="后端未配置 LLM API Key，问答将只返回检索证据而不会生成回答。请在 .env 中设置 DEEPSEEK_API_KEY 或 LLM_API_KEY。" />
      ) : null}

      {/* ------------------------------------------------------ composer */}
      <Card>
        <CardContent className="space-y-3">
          <div className="relative">
            <Textarea
              ref={inputRef}
              rows={3}
              value={question}
              placeholder="向企业知识库提问，例如：Rerank 在 RAG 检索链路里解决什么问题？"
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  void submit();
                }
              }}
              className="pr-24"
            />
            <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5">
              <span className="hidden text-2xs text-[var(--color-ink-faint)] sm:inline">
                ⌘/Ctrl + ↵
              </span>
              <Button
                variant="primary"
                size="sm"
                loading={loading}
                onClick={() => void submit()}
                disabled={!question.trim()}
              >
                <CornerDownLeft className="size-3.5" />
                提问
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-2xs text-[var(--color-ink-faint)]">试试：</span>
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setQuestion(example);
                  inputRef.current?.focus();
                }}
                className="rounded-full border border-[var(--color-line)] px-2.5 py-1 text-2xs text-[var(--color-ink-muted)] transition-colors hover:border-[var(--color-accent-line)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent-ink)]"
              >
                {example}
              </button>
            ))}
          </div>

          {/* advanced */}
          <div className="border-t border-[var(--color-line-faint)] pt-3">
            <button
              type="button"
              onClick={() => setShowAdvanced((value) => !value)}
              className="flex items-center gap-1.5 text-2xs font-medium text-[var(--color-ink-muted)] transition-colors hover:text-[var(--color-ink)]"
            >
              <Settings2 className="size-3" />
              检索参数
              <span className="text-[var(--color-ink-faint)]">
                （{mode} · rerank {rerankProvider} · top_k {topK} → {rerankTopK}）
              </span>
            </button>

            {showAdvanced ? (
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="检索模式" hint="hybrid = 关键词 + 向量">
                  <SegmentedControl<Mode>
                    value={mode}
                    onChange={setMode}
                    size="sm"
                    className="w-full"
                    options={[
                      { value: "hybrid", label: "混合" },
                      { value: "keyword", label: "关键词" },
                      { value: "vector", label: "向量" },
                    ]}
                  />
                </Field>

                <Field label="重排序" hint="heuristic 为确定性词法重排">
                  <Select
                    value={rerankProvider}
                    onChange={(event) => setRerankProvider(event.target.value as RerankProvider)}
                  >
                    <option value="heuristic">heuristic（默认）</option>
                    <option value="llm">llm（模型打分）</option>
                    <option value="off">off（不重排）</option>
                  </Select>
                </Field>

                <Field label="召回数量 top_k">
                  <Select
                    value={String(topK)}
                    onChange={(event) => setTopK(Number(event.target.value))}
                  >
                    {[4, 6, 8, 12, 16, 20].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="重排后保留" hint="进入 Prompt 的证据数">
                  <Select
                    value={String(rerankTopK)}
                    onChange={(event) => setRerankTopK(Number(event.target.value))}
                  >
                    {[2, 3, 4, 6, 8].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </Select>
                </Field>

                <div className="sm:col-span-2 lg:col-span-4">
                  <Switch
                    id="allow-fallback"
                    checked={allowFallback}
                    onChange={setAllowFallback}
                    label="知识库未命中时允许模型给出通用建议"
                    description="开启后，未召回到证据时会明确标注「未经知识库验证」再给出通用回答；关闭则直接返回未命中。"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {error ? <InlineError message={error} /> : null}

      {/* --------------------------------------------------------- result */}
      {loading ? <GenerationState stage={stage} question={question || undefined} /> : null}

      {!loading && response ? (
        <div className="space-y-3">
          <AnswerCard response={response} onCitation={openCitation} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-2xs text-[var(--color-ink-faint)]">
              <Badge tone="neutral">{turns.length} 轮对话上下文</Badge>
              <span>多轮提问时，历史仅用于理解指代，不作为事实来源。</span>
            </div>
            {turns.length > 0 ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setTurns([]);
                  setResponse(null);
                  toast({ title: "已清空对话上下文", variant: "info", duration: 1600 });
                }}
              >
                <Eraser className="size-3.5" />
                清空上下文
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!loading && !response ? (
        <AnswerPlaceholder hints={EXAMPLES.slice(0, 3)} />
      ) : null}

      {/* session history */}
      {turns.length > 1 ? (
        <Card>
          <CardContent className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
              <Sparkles className="size-3" />
              本次会话
            </p>
            {turns.slice(0, -1).map((turn, index) => (
              <button
                key={`${turn.question}-${index}`}
                type="button"
                onClick={() => setQuestion(turn.question)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[var(--radius-md)] px-2 py-1.5 text-left transition-colors",
                  "hover:bg-[var(--color-surface-sunken)]",
                )}
              >
                <span className="font-mono text-2xs text-[var(--color-ink-faint)]">
                  Q{index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-[var(--color-ink-soft)]">
                  {turn.question}
                </span>
                <span className="shrink-0 text-2xs text-[var(--color-ink-faint)]">
                  {turn.answer.length} 字
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <SourceDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        citations={response?.citations ?? []}
        chunks={response?.retrieved_chunks ?? []}
        activeIndex={activeCitation}
        onSelect={setActiveCitation}
      />
    </div>
  );
}
