"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";

import { cn } from "@/lib/utils";

/**
 * Right-hand slide-over panel.
 *
 * Used for the citation detail and the chunk inspector. Closes on Escape and on
 * backdrop click; body scroll is locked while open.
 */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "md" | "lg";
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

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-[var(--color-overlay)] backdrop-blur-[1px]"
            aria-hidden
          />
          <motion.aside
            key="panel"
            role="dialog"
            aria-modal="true"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "fixed inset-y-0 right-0 z-[101] flex w-full flex-col border-l border-[var(--color-line)] bg-[var(--color-surface)] shadow-2xl",
              width === "lg" ? "sm:w-[46rem]" : "sm:w-[34rem]",
            )}
          >
            <header className="flex items-start justify-between gap-4 border-b border-[var(--color-line)] px-5 py-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--color-ink)]">{title}</div>
                {subtitle ? (
                  <div className="mt-0.5 text-xs text-[var(--color-ink-muted)]">{subtitle}</div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="关闭面板"
                className="-mr-1 -mt-1 rounded-[var(--radius-sm)] p-1.5 text-[var(--color-ink-faint)] transition-colors hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink)]"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

            {footer ? (
              <footer className="border-t border-[var(--color-line)] px-5 py-3">{footer}</footer>
            ) : null}
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
