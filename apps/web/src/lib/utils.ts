import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names, with Tailwind conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a byte count for humans. */
export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Compact number formatting: 12345 -> 12.3k */
export function formatCount(value: number): string {
  if (value === null || value === undefined) return "—";
  if (Math.abs(value) < 1000) return String(value);
  if (Math.abs(value) < 1_000_000) return `${(value / 1000).toFixed(1)}k`;
  return `${(value / 1_000_000).toFixed(1)}M`;
}

/** Format a latency in milliseconds. */
export function formatMs(ms: number): string {
  if (!ms) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/** Format a 0..1 ratio as a percentage. */
export function formatPercent(ratio: number | null | undefined, digits = 0): string {
  if (ratio === null || ratio === undefined) return "—";
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** Relative time in Chinese, falling back to an absolute date past a week. */
export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;

  if (diff < 0) return "刚刚";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds} 秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return formatDateTime(iso, true);
}

/** Absolute local date-time. */
export function formatDateTime(iso: string | null | undefined, short = false): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  const base = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  if (short) return base;
  return `${base} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Truncate a string for display. */
export function truncate(text: string, limit: number): string {
  const value = (text ?? "").trim();
  if (value.length <= limit) return value;
  return `${value.slice(0, limit).trimEnd()}…`;
}

/** Human label for an activity kind. */
export const ACTIVITY_KIND_LABELS: Record<string, string> = {
  rag_query: "知识库问答",
  chat: "多轮对话",
  agent_run: "Agent 运行",
  solution: "方案生成",
  evaluation: "评测运行",
  knowledge: "知识库操作",
  system: "系统事件",
};

/** Human label for a document status. */
export const STATUS_LABELS: Record<string, string> = {
  uploaded: "已上传",
  parsing: "解析中",
  indexed: "已索引",
  failed: "解析失败",
  unsupported: "不支持",
};

/** Human label for a trace node. */
export const TRACE_NODE_LABELS: Record<string, string> = {
  understand: "理解任务",
  route_intent: "识别意图",
  plan: "制定计划",
  execute_tools: "调用 Tool",
  retrieve: "检索知识库",
  fuse: "融合排序",
  rerank: "重排序证据",
  context: "构建上下文",
  generate: "生成输出",
  grounding: "引用校验",
  human_check: "人工确认",
  finalize: "整理结果",
  analyze_question: "理解问题",
  fallback: "通用建议降级",
  guard: "输入守卫",
};

/** Colour tokens for a trace status. */
export const TRACE_STATUS_TONE: Record<
  string,
  { dot: string; text: string; bg: string; label: string }
> = {
  success: {
    dot: "bg-[var(--color-success)]",
    text: "text-[var(--color-success)]",
    bg: "bg-[var(--color-success-soft)]",
    label: "成功",
  },
  running: {
    dot: "bg-[var(--color-accent)]",
    text: "text-[var(--color-accent)]",
    bg: "bg-[var(--color-accent-soft)]",
    label: "执行中",
  },
  warning: {
    dot: "bg-[var(--color-warning)]",
    text: "text-[var(--color-warning)]",
    bg: "bg-[var(--color-warning-soft)]",
    label: "需注意",
  },
  failed: {
    dot: "bg-[var(--color-danger)]",
    text: "text-[var(--color-danger)]",
    bg: "bg-[var(--color-danger-soft)]",
    label: "失败",
  },
  skipped: {
    dot: "bg-[var(--color-ink-faint)]",
    text: "text-[var(--color-ink-muted)]",
    bg: "bg-[var(--color-surface-sunken)]",
    label: "已跳过",
  },
  pending: {
    dot: "bg-[var(--color-ink-faint)]",
    text: "text-[var(--color-ink-muted)]",
    bg: "bg-[var(--color-surface-sunken)]",
    label: "等待",
  },
};

/** Stable colour per category index for charts. */
export function vizColor(index: number): string {
  const palette = [
    "var(--color-viz-1)",
    "var(--color-viz-2)",
    "var(--color-viz-3)",
    "var(--color-viz-4)",
    "var(--color-viz-5)",
    "var(--color-viz-6)",
  ];
  return palette[index % palette.length];
}
