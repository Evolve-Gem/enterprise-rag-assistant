"use client";

import { AnimatePresence, motion } from "framer-motion";

import { useFocusTrap } from "@/components/ui/use-focus-trap";
import { PRODUCT_TAGLINE, PRODUCT_VERSION } from "@/lib/product-version";
import {
  Activity,
  ChevronDown,
  Compass,
  Database,
  FileStack,
  FileText,
  FlaskConical,
  Info,
  LayoutDashboard,
  Lock,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings as SettingsIcon,
  Workflow,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { StatusDot } from "@/components/ui/badge";
import type { HealthResponse, SettingsResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  /** Product-facing Chinese label. This is the primary text users read. */
  label: string;
  /** Original engineering name, kept as a title/tooltip so technical readers
   *  can still map the page onto the docs and the repository. */
  english?: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  /**
   * Rendered collapsed by default. Used for the advanced/technical pages so
   * they never carry the same visual weight as the three core entry points.
   * A group containing the active route always renders open.
   */
  collapsible?: boolean;
}

/**
 * Product-facing information architecture.
 *
 * Ordered by *what a first-time visitor wants to do* (首页 → 核心能力), then by
 * depth (知识中心 → 高级能力 → 关于项目). The routes themselves are unchanged —
 * this revision only regroups and renames, so deep links and bookmarks keep
 * working.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "首页",
    items: [{ href: "/", label: "首页", english: "Home", icon: LayoutDashboard, exact: true }],
  },
  {
    label: "核心能力",
    items: [
      { href: "/ask", label: "知识问答", english: "Ask", icon: MessageSquareText },
      { href: "/agent", label: "AI 任务", english: "Agent Workspace", icon: Workflow },
      { href: "/solution-studio", label: "方案生成", english: "Solution Studio", icon: FileText },
    ],
  },
  {
    label: "知识中心",
    items: [
      { href: "/knowledge/documents", label: "知识库", english: "Documents", icon: FileStack },
      { href: "/knowledge/explorer", label: "知识探索", english: "Knowledge Explorer", icon: Compass },
      { href: "/insights/gaps", label: "知识洞察", english: "Knowledge Gaps", icon: Search },
    ],
  },
  {
    label: "高级能力",
    collapsible: true,
    items: [
      { href: "/insights/evaluation", label: "RAG 评测", english: "Evaluation", icon: FlaskConical },
      { href: "/insights/activity", label: "运行记录", english: "Activity", icon: Activity },
      { href: "/settings", label: "系统设置", english: "Settings", icon: SettingsIcon },
    ],
  },
  {
    label: "关于",
    items: [{ href: "/about", label: "关于项目", english: "About", icon: Info }],
  },
];

function isActiveItem(item: NavItem, pathname: string) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

/**
 * The navigation body, shared by the desktop rail and the mobile drawer.
 *
 * `onNavigate` lets the drawer close itself after a tap; on desktop it is
 * omitted because the rail never goes away.
 */
function SidebarNav({
  collapsed = false,
  onToggle,
  onNavigate,
  onClose,
  settings,
  health,
}: {
  collapsed?: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
  onClose?: () => void;
  settings?: SettingsResponse;
  health?: HealthResponse;
}) {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const isGroupOpen = (group: NavGroup) => {
    if (!group.collapsible) return true;
    // Never hide the page the user is on.
    if (group.items.some((item) => isActiveItem(item, pathname))) return true;
    return openGroups[group.label] ?? false;
  };

  const indexState = health?.index_ready
    ? `${health.index_document_count} 文档 · ${health.index_chunk_count} 块`
    : "索引未就绪";

  return (
    <>
      {/* brand */}
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-[var(--color-line)] px-3.5">
        {/* Solid fill token, not --color-accent: the glyph is near-white and the
            accent is lightened in dark mode for text use. */}
        <span className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent-solid)] text-white">
          <Database className="size-3.5" strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1">
          {/* Version sits on the product-name line. `shrink-0` on the link and
              `truncate` on the name is what keeps the name from being squeezed —
              the name yields space first, the version never wraps. It is a real
              link (to the release history), so it carries hover, focus-visible
              and keyboard affordance. */}
          <div className="flex min-w-0 items-baseline gap-1.5">
            <p className="truncate text-[13px] font-semibold leading-tight text-[var(--color-ink)]">
              Enterprise RAG Copilot
            </p>
            {!collapsed ? (
              <Link
                href="/about#release-history"
                title={`查看 ${PRODUCT_VERSION} 版本历程`}
                aria-label={`产品版本 ${PRODUCT_VERSION}，查看版本历程`}
                className="shrink-0 rounded-[var(--radius-xs)] px-1 text-2xs font-medium leading-tight text-[var(--color-ink-muted)] transition-colors duration-[var(--motion-fast)] ease-[var(--ease-standard)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-accent-ink)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-accent)]"
              >
                {PRODUCT_VERSION}
              </Link>
            ) : null}
          </div>
          <p className="truncate text-2xs leading-tight text-[var(--color-ink-faint)]">
            {PRODUCT_TAGLINE}
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭导航"
            className="-mr-1 flex size-8 items-center justify-center rounded-[var(--radius-small)] text-[var(--color-ink-muted)] transition-colors duration-[var(--motion-fast)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-ink)]"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {/* navigation */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            {!collapsed ? (
              group.collapsible ? (
                <button
                  type="button"
                  aria-expanded={isGroupOpen(group)}
                  onClick={() =>
                    setOpenGroups((current) => ({
                      ...current,
                      [group.label]: !isGroupOpen(group),
                    }))
                  }
                  className="mb-1.5 flex min-h-11 w-full items-center gap-1.5 rounded-[var(--radius-sm)] px-2 text-left text-2xs font-semibold tracking-[0.04em] text-[var(--color-ink-muted)] transition-colors duration-[var(--motion-fast)] hover:text-[var(--color-ink-soft)] md:min-h-0 md:py-1"
                >
                  {group.label}
                  <ChevronDown
                    className={cn(
                      "size-3 shrink-0 transition-transform duration-[var(--motion-normal)] ease-[var(--ease-standard)]",
                      isGroupOpen(group) && "rotate-180",
                    )}
                  />
                </button>
              ) : (
                <p className="mb-1.5 px-2 text-2xs font-semibold tracking-[0.04em] text-[var(--color-ink-muted)]">
                  {group.label}
                </p>
              )
            ) : (
              <div className="mx-2 mb-2 border-t border-[var(--color-line-faint)]" />
            )}

            <ul className={cn("space-y-0.5", !isGroupOpen(group) && "hidden")}>
              {group.items.map((item) => {
                const active = isActiveItem(item, pathname);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      title={item.english ? `${item.label} · ${item.english}` : item.label}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-[var(--radius-small)] px-2 py-1.5 text-[13px]",
                        "transition-[background-color,color] duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
                        active
                          ? "bg-[var(--color-accent-soft)] font-medium text-[var(--color-accent-ink)]"
                          : "text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-ink)]",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      {active ? (
                        <span className="absolute inset-y-[5px] left-0 w-[3px] rounded-full bg-[var(--color-accent)]" />
                      ) : null}
                      <Icon
                        className={cn(
                          "size-4 shrink-0 transition-colors duration-[var(--motion-fast)] ease-[var(--ease-standard)]",
                          active
                            ? "text-[var(--color-accent)]"
                            : "text-[var(--color-ink-muted)] group-hover:text-[var(--color-ink-soft)]",
                        )}
                        strokeWidth={2}
                      />
                      {!collapsed ? (
                        // Label on its own line, engineering name beneath it in
                        // a faint second line: inline it would wrap mid-word
                        // ("Agent Workspace") and the rail reads as noise.
                        <span className="min-w-0 flex-1">
                          <span className="block truncate leading-tight">{item.label}</span>
                          {item.english ? (
                            <span className="block truncate text-[10px] leading-tight text-[var(--color-ink-muted)]">
                              {item.english}
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* footer: live system status, in user-facing wording */}
      <div className="shrink-0 border-t border-[var(--color-line)] px-2.5 py-2.5">
        {!collapsed ? (
          <div className="mb-2 space-y-1.5 px-1.5">
            <div className="flex items-center gap-2 text-2xs">
              <StatusDot tone={health?.index_ready ? "success" : "warning"} />
              <span className="truncate text-[var(--color-ink-muted)]">
                知识检索已就绪 · {indexState}
              </span>
            </div>
            <div className="flex items-center gap-2 text-2xs">
              <StatusDot tone={health?.llm_configured ? "success" : "warning"} />
              <span className="truncate text-[var(--color-ink-muted)]">
                回答生成模型已配置
              </span>
            </div>
            <p className="pl-4 text-[10px] leading-relaxed text-[var(--color-ink-faint)]">
              Hybrid · BM25 + Vector · {settings?.retrieval.rerank_provider ?? "—"} rerank
            </p>
            {settings?.guard_rails.read_only ? (
              <div className="flex items-center gap-2 pt-0.5 text-2xs text-[var(--color-warning)]">
                <Lock className="size-3" />
                <span>公开只读演示</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {onToggle ? (
          <div className={cn("flex items-center gap-1", collapsed ? "flex-col" : "justify-end")}>
            <button
              type="button"
              onClick={onToggle}
              title={collapsed ? "展开侧边栏" : "收起侧边栏"}
              aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
              className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-ink-faint)] transition-colors hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink)]"
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}

/** Desktop rail. Hidden below `md`, where `MobileNav` takes over. */
export function Sidebar({
  collapsed,
  onToggle,
  settings,
  health,
}: {
  collapsed: boolean;
  onToggle: () => void;
  settings?: SettingsResponse;
  health?: HealthResponse;
}) {
  return (
    <motion.aside
      animate={{ width: collapsed ? 68 : 252 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 z-40 hidden h-dvh shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-surface)] md:flex"
    >
      <SidebarNav
        collapsed={collapsed}
        onToggle={onToggle}
        settings={settings}
        health={health}
      />
    </motion.aside>
  );
}

/**
 * Off-canvas navigation for phones and small tablets.
 *
 * The rail is 252px wide; squeezing it next to content on a 390px viewport is
 * what produces horizontal overflow, so below `md` it becomes a drawer instead.
 */
export function MobileNav({
  open,
  onClose,
  settings,
  health,
}: {
  open: boolean;
  onClose: () => void;
  settings?: SettingsResponse;
  health?: HealthResponse;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  const navRef = useFocusTrap<HTMLElement>(open);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="nav-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-[110] bg-[var(--color-overlay)] md:hidden"
            aria-hidden
          />
          <motion.aside
            key="nav-panel"
            ref={navRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="主导航"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-y-0 left-0 z-[111] flex h-dvh w-[86vw] max-w-[22rem] flex-col border-r border-[var(--color-line)] bg-[var(--color-surface)] shadow-2xl md:hidden"
          >
            <SidebarNav
              collapsed={false}
              onNavigate={onClose}
              onClose={onClose}
              settings={settings}
              health={health}
            />
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
