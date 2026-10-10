"use client";

import { Menu, Moon, RefreshCw, Sun } from "lucide-react";
import { usePathname } from "next/navigation";

import { useTheme } from "@/components/providers/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import type { HealthResponse } from "@/lib/types";

/**
 * Page titles in product language.
 *
 * The engineering name (`Ask`, `Agent Workspace`, …) still lives in the sidebar
 * tooltip and in the docs; what a first-time visitor sees here is the job the
 * page does.
 */
const TITLES: Record<string, { title: string; subtitle: string }> = {
  "/": { title: "首页", subtitle: "这是什么、能做什么，从这里开始" },
  "/ask": { title: "知识问答", subtitle: "向企业知识库提问，回答带可核对来源" },
  "/agent": { title: "AI 任务", subtitle: "告诉 Agent 要完成什么，它自动选择能力并执行" },
  "/solution-studio": { title: "方案生成", subtitle: "从客户需求到结构化售前方案" },
  "/knowledge/documents": { title: "知识库", subtitle: "管理用于检索的企业知识文档" },
  "/knowledge/explorer": { title: "知识探索", subtitle: "浏览文档、知识块与检索结果" },
  "/insights/gaps": { title: "知识洞察", subtitle: "看清知识资产覆盖了什么、还缺什么" },
  "/insights/evaluation": { title: "RAG 评测", subtitle: "用固定测试集检验检索是否真的找到正确资料" },
  "/insights/activity": { title: "运行记录", subtitle: "每一次问答、任务与评测的完整台账" },
  "/settings": { title: "系统设置", subtitle: "运行时配置、Prompt 版本与系统自检" },
  "/about": { title: "关于项目", subtitle: "为什么做、解决什么问题、边界在哪里" },
};

function lookup(pathname: string) {
  if (TITLES[pathname]) return TITLES[pathname];
  // Longest matching prefix, so nested routes still get a sensible header.
  const match = Object.keys(TITLES)
    .filter((key) => key !== "/" && pathname.startsWith(`${key}/`))
    .sort((a, b) => b.length - a.length)[0];
  return match ? TITLES[match] : { title: "Enterprise RAG Copilot", subtitle: "" };
}

/**
 * Top of the chrome.
 *
 * V5: the bar is part of the ink frame, not a floating white strip. The page
 * title now sits on dark in both themes, which is what makes the whole shell
 * read as one designed object; a single aurora hairline runs under the bar as
 * the brand signature.
 */
export function Topbar({
  health,
  readOnly = false,
  onRefresh,
  onOpenNav,
  refreshing,
}: {
  health?: HealthResponse;
  readOnly?: boolean;
  onRefresh?: () => void;
  onOpenNav?: () => void;
  refreshing?: boolean;
}) {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const { toast } = useToast();

  const meta = lookup(pathname);

  return (
    <header className="ink-frame relative sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-[var(--color-frame-line)] px-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-1.5">
        {onOpenNav ? (
          <button
            type="button"
            onClick={onOpenNav}
            aria-label="打开导航"
            className="-ml-1 rounded-[var(--radius-md)] p-2 text-[var(--color-frame-ink-soft)] transition-colors hover:bg-[var(--color-frame-hover)] hover:text-[var(--color-frame-ink)] md:hidden"
          >
            <Menu className="size-5" />
          </button>
        ) : null}

        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-[var(--color-frame-ink)]">
            {meta.title}
          </h1>
          {meta.subtitle ? (
            <p className="truncate text-2xs text-[var(--color-frame-ink-muted)]">{meta.subtitle}</p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* These badges cannot shrink and are the first thing to overflow on a
            narrow viewport, so they only appear once there is room. The mobile
            drawer and the home hero carry the same information. */}
        {health ? (
          <Badge
            tone={health.status === "ok" ? "ink-success" : "ink-warning"}
            className="max-md:hidden"
          >
            {health.status === "ok" ? "服务正常" : "降级运行"}
          </Badge>
        ) : null}

        {readOnly ? (
          <Badge tone="ink-accent" className="max-sm:hidden">
            公开只读演示
          </Badge>
        ) : null}

        {/* A phone header carries the page name, the menu and the theme toggle
            only — every extra control costs horizontal room the title needs. */}
        {onRefresh ? (
          <Button
            size="icon"
            variant="frame"
            className="max-sm:hidden"
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
          variant="frame"
          onClick={toggle}
          title={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
          aria-label="切换主题"
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </div>

      {/* The aurora hairline: a 1px signature that ties the chrome to the
          stage surfaces. Fades at both ends so it reads as light, not a
          divider. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-[-1px] h-px opacity-70"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgb(124 93 250 / 0.55) 16%, rgb(34 211 238 / 0.35) 58%, transparent 100%)",
        }}
      />
    </header>
  );
}
