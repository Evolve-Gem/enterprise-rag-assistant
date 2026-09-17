"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

export type MascotState =
  | "idle"
  | "understanding"
  | "searching"
  | "reading"
  | "reranking"
  | "generating"
  | "success"
  | "error";

/**
 * "小知" — the knowledge sprite.
 *
 * Hand-drawn SVG (no third-party asset, no licence question) that gives the
 * retrieval pipeline a face. Each pipeline stage maps to a distinct pose so the
 * user can see *which* stage is running instead of staring at a spinner:
 *
 *   understanding → antenna lit, eyes look up
 *   searching     → orbit dots revolve around the head
 *   reading       → an open page appears and its lines fill in
 *   reranking     → three bars reorder themselves
 *   generating    → waveform bars pulse in the chest core
 *   success       → a check mark pops in, eyes become crescents
 *   error         → eyes turn into a flat line, halo dims
 */
const STATE_LABEL: Record<MascotState, string> = {
  idle: "待命",
  understanding: "理解问题",
  searching: "检索知识库",
  reading: "阅读知识片段",
  reranking: "重排序证据",
  generating: "生成回答",
  success: "完成",
  error: "出错",
};

export function KnowledgeMascot({
  state = "idle",
  size = 84,
  className,
  withLabel = false,
}: {
  state?: MascotState;
  size?: number;
  className?: string;
  withLabel?: boolean;
}) {
  const busy = ["understanding", "searching", "reading", "reranking", "generating"].includes(state);
  const eyeOffset = state === "understanding" ? -1.2 : 0;
  const isSuccess = state === "success";
  const isError = state === "error";

  return (
    <div className={cn("inline-flex flex-col items-center gap-2", className)}>
      <motion.svg
        width={size}
        height={size}
        viewBox="0 0 96 96"
        role="img"
        aria-label={`知识精灵状态：${STATE_LABEL[state]}`}
        className={busy ? "animate-float" : undefined}
      >
        <defs>
          <linearGradient id="mascot-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="mascot-core" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" />
            <stop offset="100%" stopColor="var(--color-viz-3)" />
          </linearGradient>
        </defs>

        {/* halo */}
        <motion.circle
          cx="48"
          cy="52"
          r="34"
          fill="none"
          stroke="var(--color-accent-line)"
          strokeWidth="1"
          strokeDasharray="3 5"
          animate={{ opacity: isError ? 0.15 : busy ? [0.35, 0.7, 0.35] : 0.35 }}
          transition={{ duration: 2.4, repeat: busy ? Infinity : 0, ease: "easeInOut" }}
        />

        {/* antenna */}
        <motion.g
          animate={{
            rotate: state === "understanding" ? [-6, 6, -6] : 0,
          }}
          transition={{ duration: 2.2, repeat: state === "understanding" ? Infinity : 0 }}
          style={{ originX: "48px", originY: "30px" }}
        >
          <line x1="48" y1="30" x2="48" y2="17" stroke="var(--color-line-strong)" strokeWidth="2" />
          <motion.circle
            cx="48"
            cy="14"
            r="3.2"
            fill={isError ? "var(--color-danger)" : "var(--color-accent)"}
            animate={{
              opacity: isError ? 0.5 : busy ? [0.45, 1, 0.45] : 0.75,
            }}
            transition={{ duration: 1.1, repeat: busy ? Infinity : 0, ease: "easeInOut" }}
          />
        </motion.g>

        {/* head */}
        <rect
          x="20"
          y="30"
          width="56"
          height="46"
          rx="15"
          fill="url(#mascot-body)"
          stroke="var(--color-accent-line)"
          strokeWidth="1.6"
        />

        {/* eyes */}
        {isSuccess ? (
          <>
            <path d="M32 52 q4 -5 8 0" fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" />
            <path d="M56 52 q4 -5 8 0" fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" />
          </>
        ) : isError ? (
          <>
            <line x1="32" y1="53" x2="40" y2="53" stroke="var(--color-ink-muted)" strokeWidth="2" strokeLinecap="round" />
            <line x1="56" y1="53" x2="64" y2="53" stroke="var(--color-ink-muted)" strokeWidth="2" strokeLinecap="round" />
          </>
        ) : (
          <motion.g
            animate={{ y: eyeOffset }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className={state === "idle" ? "animate-blink" : undefined}
          >
            <circle cx="36" cy="52" r="3.4" fill="var(--color-ink)" />
            <circle cx="60" cy="52" r="3.4" fill="var(--color-ink)" />
          </motion.g>
        )}

        {/* chest core — the "generating" signature */}
        <rect x="34" y="62" width="28" height="9" rx="4.5" fill="var(--color-surface)" stroke="var(--color-line)" strokeWidth="1" />
        {state === "generating" ? (
          <g>
            {[0, 1, 2, 3, 4].map((index) => (
              <motion.rect
                key={index}
                x={37 + index * 5}
                width="2.4"
                rx="1.2"
                fill="url(#mascot-core)"
                animate={{ height: [3, 7, 3], y: [65, 62, 65] }}
                transition={{
                  duration: 0.7,
                  repeat: Infinity,
                  delay: index * 0.09,
                  ease: "easeInOut",
                }}
              />
            ))}
          </g>
        ) : (
          <motion.rect
            x="36"
            y="65"
            width="24"
            height="3"
            rx="1.5"
            fill="url(#mascot-core)"
            animate={{ opacity: busy ? [0.4, 1, 0.4] : 0.85 }}
            transition={{ duration: 1.4, repeat: busy ? Infinity : 0, ease: "easeInOut" }}
          />
        )}

        {/* searching: orbiting dots */}
        {state === "searching" ? (
          <motion.g
            animate={{ rotate: 360 }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }}
            style={{ originX: "48px", originY: "52px" }}
          >
            <circle cx="48" cy="18" r="2.6" fill="var(--color-viz-2)" />
            <circle cx="82" cy="52" r="2" fill="var(--color-viz-1)" />
            <circle cx="14" cy="52" r="1.7" fill="var(--color-viz-3)" />
          </motion.g>
        ) : null}

        {/* reading: page with filling lines */}
        {state === "reading" ? (
          <motion.g
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.28 }}
          >
            <rect x="66" y="34" width="24" height="30" rx="3" fill="var(--color-surface)" stroke="var(--color-line-strong)" strokeWidth="1" />
            {[0, 1, 2, 3].map((index) => (
              <motion.line
                key={index}
                x1="70"
                y1={41 + index * 6}
                x2="86"
                y2={41 + index * 6}
                stroke="var(--color-ink-faint)"
                strokeWidth="1.4"
                strokeLinecap="round"
                animate={{ opacity: [0.2, 0.95, 0.2] }}
                transition={{ duration: 1.6, repeat: Infinity, delay: index * 0.18 }}
              />
            ))}
          </motion.g>
        ) : null}

        {/* reranking: three bars reordering */}
        {state === "reranking" ? (
          <g>
            {[0, 1, 2].map((index) => (
              <motion.rect
                key={index}
                width="7"
                height="3"
                rx="1.5"
                fill="var(--color-viz-3)"
                animate={{
                  y: index === 0 ? [34, 52, 34] : index === 2 ? [52, 34, 52] : 43,
                  x: 70,
                }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
            ))}
          </g>
        ) : null}

        {/* success check */}
        {isSuccess ? (
          <motion.path
            d="M70 22 l6 6 l11 -13"
            fill="none"
            stroke="var(--color-success)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        ) : null}
      </motion.svg>

      {withLabel ? (
        <span
          className={cn(
            "text-2xs font-medium",
            isError ? "text-[var(--color-danger)]" : "text-[var(--color-ink-muted)]",
          )}
        >
          {STATE_LABEL[state]}
        </span>
      ) : null}
    </div>
  );
}

export function mascotStateLabel(state: MascotState): string {
  return STATE_LABEL[state];
}
