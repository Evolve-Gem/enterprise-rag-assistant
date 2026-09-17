"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

import { KnowledgeMascot, type MascotState } from "@/components/mascot/knowledge-mascot";
import { Skeleton } from "@/components/ui/states";
import { cn } from "@/lib/utils";

/** The five visible stages of a grounded answer, in execution order. */
export const RAG_STAGES: { key: string; label: string; mascot: MascotState }[] = [
  { key: "understanding", label: "正在理解问题", mascot: "understanding" },
  { key: "searching", label: "正在检索知识库", mascot: "searching" },
  { key: "reading", label: "正在阅读知识片段", mascot: "reading" },
  { key: "reranking", label: "正在重排序证据", mascot: "reranking" },
  { key: "generating", label: "正在生成回答", mascot: "generating" },
];

/**
 * Generation state.
 *
 * A plain spinner tells the user nothing. This shows the *actual* pipeline
 * stages, advancing on a conservative timer while the request is in flight —
 * the stage list is the real pipeline the backend runs, not decoration.
 */
export function GenerationState({
  stage,
  question,
  className,
}: {
  stage: number;
  question?: string;
  className?: string;
}) {
  const current = RAG_STAGES[Math.min(stage, RAG_STAGES.length - 1)];

  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5",
        className,
      )}
    >
      <div className="flex items-start gap-5">
        <KnowledgeMascot state={current.mascot} size={80} />

        <div className="min-w-0 flex-1">
          {question ? (
            <p className="truncate text-xs text-[var(--color-ink-muted)]" title={question}>
              问题：{question}
            </p>
          ) : null}

          <ol className="mt-3 space-y-2">
            {RAG_STAGES.map((item, index) => {
              const done = index < stage;
              const active = index === stage;
              return (
                <li key={item.key} className="flex items-center gap-2.5 text-xs">
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                      done
                        ? "border-[var(--color-success)] bg-[var(--color-success-soft)] text-[var(--color-success)]"
                        : active
                          ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                          : "border-[var(--color-line)] bg-[var(--color-surface-sunken)]",
                    )}
                  >
                    {done ? (
                      <Check className="size-2.5" strokeWidth={3} />
                    ) : active ? (
                      <motion.span
                        className="size-1.5 rounded-full bg-[var(--color-accent)]"
                        animate={{ opacity: [1, 0.25, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      done
                        ? "text-[var(--color-ink-muted)]"
                        : active
                          ? "font-medium text-[var(--color-ink)]"
                          : "text-[var(--color-ink-faint)]",
                    )}
                  >
                    {item.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <div className="mt-5 space-y-2.5">
        <Skeleton className="h-3 w-11/12" />
        <Skeleton className="h-3 w-10/12" />
        <Skeleton className="h-3 w-9/12" />
        <Skeleton className="h-3 w-7/12" />
      </div>
    </div>
  );
}
