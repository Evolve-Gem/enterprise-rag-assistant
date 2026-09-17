"use client";

import { Cpu, Database, FileCode2, ShieldCheck, Sliders, Sparkles } from "lucide-react";

import { Badge, CodeChip, StatusDot } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, DefRow, SectionLabel } from "@/components/ui/card";
import { ErrorState, SkeletonRows } from "@/components/ui/states";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/hooks";
import type { SettingsResponse, SystemStatus } from "@/lib/types";
import { formatBytes, formatPercent } from "@/lib/utils";

const CHECK_TONE: Record<string, "success" | "warning" | "danger"> = {
  ok: "success",
  degraded: "warning",
  missing: "danger",
};

export default function SettingsPage() {
  const settings = useAsync<SettingsResponse>(() => api.settings(), []);
  const status = useAsync<SystemStatus>(() => api.systemStatus(), []);
  const prompts = useAsync(() => api.prompts(), []);

  if (settings.status === "error") {
    return <ErrorState error={settings.error} onRetry={settings.reload} />;
  }
  if (settings.status === "loading") {
    return <SkeletonRows count={6} />;
  }

  const s = settings.data;

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
      {/* -------------------------------------------------- system status */}
      <Card className="xl:col-span-2">
        <CardHeader
          title="系统自检"
          description="后端对自身配置的真实判断，不使用假状态"
          icon={<ShieldCheck className="size-4" />}
          dense
          actions={
            status.status === "success" ? (
              <Badge tone={CHECK_TONE[status.data.status] ?? "warning"}>
                <StatusDot tone={CHECK_TONE[status.data.status] ?? "warning"} />
                {status.data.status === "ok" ? "全部就绪" : "存在降级项"}
              </Badge>
            ) : null
          }
        />
        <CardContent className="space-y-2">
          {status.status === "loading" ? (
            <SkeletonRows count={5} />
          ) : status.status === "error" ? (
            <ErrorState error={status.error} onRetry={status.reload} compact />
          ) : (
            status.data.checks.map((check) => (
              <div
                key={check.key}
                className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3.5 py-2.5"
              >
                <StatusDot tone={CHECK_TONE[check.status] ?? "neutral"} />
                <span className="w-32 shrink-0 text-xs font-medium text-[var(--color-ink)]">
                  {check.label}
                </span>
                <Badge tone={CHECK_TONE[check.status] ?? "neutral"}>{check.status}</Badge>
                <span className="min-w-0 flex-1 text-2xs leading-relaxed text-[var(--color-ink-muted)]">
                  {check.detail}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------- providers */}
      <Card>
        <CardHeader
          title="模型服务"
          description="密钥只显示是否存在与尾号，绝不返回明文"
          icon={<Sparkles className="size-4" />}
          dense
        />
        <CardContent>
          <DefRow label="Provider">{s.providers.llm.provider}</DefRow>
          <DefRow label="模型" mono>
            {s.providers.llm.model}
          </DefRow>
          <DefRow label="Base URL" mono>
            {s.providers.llm.base_url}
          </DefRow>
          <DefRow label="密钥状态">
            {s.providers.llm.configured ? (
              <Badge tone="success">已配置 {s.providers.llm.key_hint}</Badge>
            ) : (
              <Badge tone="danger">未配置</Badge>
            )}
          </DefRow>
          <div className="mt-3 border-t border-[var(--color-line-faint)] pt-3">
            <SectionLabel>Embedding</SectionLabel>
            <DefRow label="Provider">{s.providers.embedding.provider}</DefRow>
            <DefRow label="模型 / 算法" mono>
              {s.providers.embedding.model}
            </DefRow>
            <DefRow label="向量维度" mono>
              {s.providers.embedding.dim}
            </DefRow>
            <DefRow label="密钥状态">
              {s.providers.embedding.provider === "hashing" ? (
                <Badge tone="accent">离线哈希向量（无需密钥）</Badge>
              ) : s.providers.embedding.configured ? (
                <Badge tone="success">已配置 {s.providers.embedding.key_hint}</Badge>
              ) : (
                <Badge tone="danger">未配置</Badge>
              )}
            </DefRow>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------- retrieval */}
      <Card>
        <CardHeader
          title="检索与生成"
          description="全部来自环境变量，可在 .env 中调整"
          icon={<Sliders className="size-4" />}
          dense
        />
        <CardContent>
          <DefRow label="配置模式">{s.retrieval.configured_mode}</DefRow>
          <DefRow label="生效模式">
            <Badge tone="accent">{s.retrieval.effective_mode}</Badge>
          </DefRow>
          <DefRow label="向量存储">{s.retrieval.vector_store}</DefRow>
          <DefRow label="召回数量 top_k" mono>
            {s.retrieval.top_k}
          </DefRow>
          <DefRow label="重排后保留" mono>
            {s.retrieval.rerank_top_k}
          </DefRow>
          <DefRow label="融合策略" mono>
            {s.retrieval.fusion}
          </DefRow>
          <DefRow label="重排序器" mono>
            {s.retrieval.rerank_provider}
          </DefRow>
          <div className="mt-3 border-t border-[var(--color-line-faint)] pt-3">
            <SectionLabel>切分</SectionLabel>
            <DefRow label="chunk_size" mono>
              {s.chunking.chunk_size}
            </DefRow>
            <DefRow label="chunk_overlap" mono>
              {s.chunking.chunk_overlap}
            </DefRow>
          </div>
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------- agent */}
      <Card>
        <CardHeader
          title="Agent 与运行时"
          description="引擎、步数上限与观测配置"
          icon={<Cpu className="size-4" />}
          dense
        />
        <CardContent>
          <DefRow label="生效引擎">
            <Badge tone="accent">{s.agent.engine}</Badge>
          </DefRow>
          <DefRow label="配置值" mono>
            {s.agent.requested_engine}
          </DefRow>
          <DefRow label="LangGraph 可用">
            {s.runtime.langgraph_available ? (
              <Badge tone="success">是</Badge>
            ) : (
              <Badge tone="warning">否（回退原生状态机）</Badge>
            )}
          </DefRow>
          <DefRow label="最大执行步数" mono>
            {s.agent.max_steps}
          </DefRow>
          <DefRow label="Human Check 默认">
            {s.agent.human_check_required ? "开启" : "关闭"}
          </DefRow>
          <div className="mt-3 border-t border-[var(--color-line-faint)] pt-3">
            <SectionLabel>活动台账</SectionLabel>
            <DefRow label="是否启用">{s.observability.activity_enabled ? "是" : "否"}</DefRow>
            <DefRow label="后端" mono>
              {s.observability.activity_backend}
            </DefRow>
            <DefRow label="最大记录数" mono>
              {s.observability.max_records}
            </DefRow>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------ guardrails */}
      <Card>
        <CardHeader
          title="演示保护与上传限制"
          description="DEMO_PASSWORD / DEMO_READ_ONLY / 上传白名单"
          icon={<ShieldCheck className="size-4" />}
          dense
        />
        <CardContent>
          <DefRow label="访问密码">
            {s.guard_rails.password_required ? (
              <Badge tone="success">已启用</Badge>
            ) : (
              <Badge tone="neutral">未启用</Badge>
            )}
          </DefRow>
          <DefRow label="只读模式">
            {s.guard_rails.read_only ? (
              <Badge tone="warning">已锁定写操作</Badge>
            ) : (
              <Badge tone="neutral">写操作开放</Badge>
            )}
          </DefRow>
          <DefRow label="上传大小上限">{formatBytes(s.uploads.max_bytes)}</DefRow>
          <DefRow label="允许的扩展名">
            <span className="flex flex-wrap justify-end gap-1">
              {s.uploads.allowed_suffixes.map((suffix) => (
                <CodeChip key={suffix}>{suffix}</CodeChip>
              ))}
            </span>
          </DefRow>
          <div className="mt-3 border-t border-[var(--color-line-faint)] pt-3">
            <SectionLabel>存储路径</SectionLabel>
            <DefRow label="知识库" mono>
              {s.storage.knowledge_base}
            </DefRow>
            <DefRow label="Prompt 目录" mono>
              {s.storage.prompts}
            </DefRow>
            <DefRow label="运行时数据" mono>
              {s.storage.data}
            </DefRow>
          </div>
        </CardContent>
      </Card>

      {/* --------------------------------------------------------- prompts */}
      <Card className="xl:col-span-2">
        <CardHeader
          title="Prompt 模板与版本"
          description={`运行时从 prompts/${s.storage.prompt_version}/ 加载，不在代码里硬编码`}
          icon={<FileCode2 className="size-4" />}
          dense
          actions={<Badge tone="accent">version {s.storage.prompt_version}</Badge>}
        />
        <CardContent>
          {prompts.status === "loading" ? (
            <SkeletonRows count={5} />
          ) : prompts.status === "error" ? (
            <ErrorState error={prompts.error} onRetry={prompts.reload} compact />
          ) : (
            <div className="space-y-1.5">
              {prompts.data.items.map((prompt) => (
                <div
                  key={prompt.name}
                  className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3.5 py-2.5"
                >
                  <CodeChip>{prompt.name}</CodeChip>
                  <Badge tone="neutral">v{prompt.version}</Badge>
                  <span className="min-w-0 flex-1 text-2xs text-[var(--color-ink-muted)]">
                    {prompt.description || "—"}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {prompt.placeholders.map((placeholder) => (
                      <span
                        key={placeholder}
                        className="rounded-[var(--radius-xs)] bg-[var(--color-surface-sunken)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-ink-faint)]"
                      >
                        {`{{${placeholder}}}`}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------- about */}
      <Card className="xl:col-span-2">
        <CardHeader title="关于" icon={<Database className="size-4" />} dense />
        <CardContent className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
          <div>
            <DefRow label="产品">{s.app.name}</DefRow>
            <DefRow label="版本" mono>
              {s.app.version}
            </DefRow>
            <DefRow label="环境" mono>
              {s.app.environment}
            </DefRow>
          </div>
          <div>
            <DefRow label="Python" mono>
              {s.runtime.python}
            </DefRow>
            <DefRow label="Prompt 版本" mono>
              {s.runtime.prompt_version}
            </DefRow>
            <DefRow label="评测数据集" mono>
              {s.evaluation.dataset_path}
            </DefRow>
          </div>
          <p className="mt-3 text-2xs leading-relaxed text-[var(--color-ink-faint)] sm:col-span-2">
            当前全部配置均通过环境变量注入。后端不会向前端返回任何明文密钥，前端也不存储密钥；
            演示密码仅用于访问控制，校验方式为常量时间比较 + HMAC 派生会话令牌。
            {status.status === "success"
              ? ` 本次自检时间：${new Date(status.data.checked_at).toLocaleString("zh-CN")}。`
              : ""}
          </p>
          {status.status === "success" ? (
            <p className="text-2xs text-[var(--color-ink-faint)] sm:col-span-2">
              索引：{status.data.index.document_count} 文档 / {status.data.index.chunk_count} 知识块 /{" "}
              {status.data.index.vectorized_chunk_count} 向量
              {status.data.index.failed_count > 0
                ? ` · ${status.data.index.failed_count} 个文档解析失败`
                : ""}
              {" · "}
              缓存命中 {formatPercent(status.data.index.from_cache ? 1 : 0)}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
