"use client";

import { Moon, RefreshCw, Sun } from "lucide-react";
import { usePathname } from "next/navigation";

import { useTheme } from "@/components/providers/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import type { HealthResponse } from "@/lib/types";

const TITLES: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "Overview", subtitle: "平台运行态势与知识资产概览" },
  "/ask": { title: "Ask", subtitle: "基于企业知识库的带引用问答" },
  "/agent": { title: "Agent Workspace", subtitle: "意图 → Skill → Tool 的可观测执行" },
  "/solution-studio": { title: "Solution Studio", subtitle: "客户需求到售前方案的完整链路" },
  "/knowledge/documents": { title: "文档管理", subtitle: "上传、解析、索引与维护知识文档" },
  "/knowledge/explorer": { title: "Knowledge Explorer", subtitle: "浏览文档、知识块与检索元数据" },
  "/insights/gaps": { title: "知识缺口", subtitle: "按资料类型的覆盖分析与补录建议" },
  "/insights/evaluation": { title: "Evaluation", subtitle: "检索指标与人工作答评分" },
  "/insights/activity": { title: "Activity", subtitle: "全量运行记录与延迟统计" },
  "/settings": { title: "Settings", subtitle: "运行时配置、Prompt 版本与系统自检" },
};

export function Topbar({
  health,
  onRefresh,
  refreshing,
}: {
  health?: HealthResponse;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const { toast } = useToast();

  const meta = TITLES[pathname] ?? { title: "Enterprise RAG Copilot", subtitle: "" };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-[var(--color-line)] bg-[var(--color-surface)]/85 px-5 backdrop-blur-md">
      <div className="min-w-0">
        <h1 className="truncate text-sm font-semibold text-[var(--color-ink)]">{meta.title}</h1>
        {meta.subtitle ? (
          <p className="truncate text-2xs text-[var(--color-ink-muted)]">{meta.subtitle}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* The status badge cannot shrink and is the only thing that overflows on
            a narrow viewport; hide it below `sm` and keep it for real work widths. */}
        {health ? (
          <Badge
            tone={health.status === "ok" ? "success" : "warning"}
            className="max-sm:hidden"
          >
            {health.status === "ok" ? "服务正常" : "降级运行"}
            <span className="opacity-60">·</span>
            {health.agent_engine}
          </Badge>
        ) : null}

        {onRefresh ? (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              onRefresh();
              toast({ title: "已刷新数据", variant: "info", duration: 1600 });
            }}
            title="刷新数据"
            aria-label="刷新数据"
          >
            <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
          </Button>
        ) : null}

        <Button
          size="icon"
          variant="ghost"
          onClick={toggle}
          title={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
          aria-label="切换主题"
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </div>
    </header>
  );
}
