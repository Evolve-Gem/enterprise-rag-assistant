"use client";

import { motion } from "framer-motion";
import {
  Activity,
  Compass,
  Database,
  FileStack,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Lock,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings as SettingsIcon,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { StatusDot } from "@/components/ui/badge";
import type { HealthResponse, SettingsResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "工作台",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard, exact: true },
      { href: "/ask", label: "Ask", icon: MessageSquareText },
      { href: "/agent", label: "Agent Workspace", icon: Workflow },
      { href: "/solution-studio", label: "Solution Studio", icon: FileText },
    ],
  },
  {
    label: "知识",
    items: [
      { href: "/knowledge/documents", label: "文档管理", icon: FileStack },
      { href: "/knowledge/explorer", label: "Knowledge Explorer", icon: Compass },
    ],
  },
  {
    label: "洞察",
    items: [
      { href: "/insights/gaps", label: "知识缺口", icon: Search },
      { href: "/insights/evaluation", label: "Evaluation", icon: FlaskConical },
      { href: "/insights/activity", label: "Activity", icon: Activity },
    ],
  },
];

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
  const pathname = usePathname();

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  const indexState = health?.index_ready
    ? `${health.index_document_count} 文档 · ${health.index_chunk_count} 块`
    : "索引未就绪";

  return (
    <motion.aside
      animate={{ width: collapsed ? 68 : 244 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 z-40 flex h-dvh shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-surface)]"
    >
      {/* brand */}
      <div className="flex h-14 items-center gap-2.5 border-b border-[var(--color-line)] px-3.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] text-white">
          <Database className="size-3.5" strokeWidth={2.4} />
        </span>
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight text-[var(--color-ink)]">
              Enterprise RAG Copilot
            </p>
            <p className="truncate text-2xs leading-tight text-[var(--color-ink-faint)]">
              Knowledge Intelligence
            </p>
          </div>
        ) : null}
      </div>

      {/* navigation */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            {!collapsed ? (
              <p className="mb-1.5 px-2 text-2xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
                {group.label}
              </p>
            ) : (
              <div className="mx-2 mb-2 border-t border-[var(--color-line-faint)]" />
            )}

            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-[var(--radius-md)] px-2 py-1.5 text-[13px] transition-colors duration-150",
                        active
                          ? "bg-[var(--color-accent-soft)] font-medium text-[var(--color-accent-ink)]"
                          : "text-[var(--color-ink-soft)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink)]",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      {active ? (
                        <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-[var(--color-accent)]" />
                      ) : null}
                      <Icon className="size-4 shrink-0" strokeWidth={2} />
                      {!collapsed ? <span className="truncate">{item.label}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* footer: live system status */}
      <div className="border-t border-[var(--color-line)] px-2.5 py-2.5">
        {!collapsed ? (
          <div className="mb-2 space-y-1.5 px-1.5">
            <div className="flex items-center gap-2 text-2xs">
              <StatusDot
                tone={health?.llm_configured ? "success" : "warning"}
                label={health?.llm_configured ? "模型已配置" : "模型未配置"}
              />
              <span className="truncate text-[var(--color-ink-muted)]">
                {settings?.providers.llm.model ?? "模型"}
              </span>
            </div>
            <div className="flex items-center gap-2 text-2xs">
              <StatusDot
                tone={health?.index_ready ? "success" : "warning"}
                label={health?.index_ready ? "索引就绪" : "索引未就绪"}
              />
              <span className="truncate text-[var(--color-ink-muted)]">{indexState}</span>
            </div>
            <div className="flex items-center gap-2 text-2xs">
              <StatusDot tone="accent" label="检索模式" />
              <span className="truncate text-[var(--color-ink-muted)]">
                {settings?.retrieval.effective_mode ?? "—"} ·{" "}
                {settings?.retrieval.rerank_provider ?? "—"}
              </span>
            </div>
            {settings?.guard_rails.read_only ? (
              <div className="flex items-center gap-2 text-2xs text-[var(--color-warning)]">
                <Lock className="size-3" />
                <span>只读演示模式</span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className={cn("flex items-center gap-1", collapsed ? "flex-col" : "justify-between")}>
          <Link
            href="/settings"
            title="Settings"
            className={cn(
              "flex items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 text-[13px] text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink)]",
              collapsed && "justify-center px-0",
            )}
          >
            <SettingsIcon className="size-4 shrink-0" />
            {!collapsed ? <span>Settings</span> : null}
          </Link>
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
      </div>
    </motion.aside>
  );
}
