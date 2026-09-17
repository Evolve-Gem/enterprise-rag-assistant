"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: string;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VARIANT_STYLE: Record<ToastVariant, { icon: typeof CheckCircle2; tone: string; bar: string }> = {
  success: {
    icon: CheckCircle2,
    tone: "text-[var(--color-success)]",
    bar: "bg-[var(--color-success)]",
  },
  error: {
    icon: XCircle,
    tone: "text-[var(--color-danger)]",
    bar: "bg-[var(--color-danger)]",
  },
  warning: {
    icon: AlertTriangle,
    tone: "text-[var(--color-warning)]",
    bar: "bg-[var(--color-warning)]",
  },
  info: {
    icon: Info,
    tone: "text-[var(--color-info)]",
    bar: "bg-[var(--color-info)]",
  },
};

/** Lightweight toast stack: no portal library, motion kept under 250ms. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = Math.random().toString(36).slice(2, 10);
      setItems((current) => [...current.slice(-3), { ...options, id }]);
      const duration = options.duration ?? (options.variant === "error" ? 7000 : 4200);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, description) => toast({ title, description, variant: "success" }),
      error: (title, description) => toast({ title, description, variant: "error" }),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-5 right-5 z-[120] flex w-[min(24rem,calc(100vw-2.5rem))] flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const variant = item.variant ?? "info";
            const style = VARIANT_STYLE[variant];
            const Icon = style.icon;
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.98 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="pointer-events-auto relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] shadow-lg shadow-black/5"
              >
                <div className="flex gap-3 p-3.5 pr-10">
                  <Icon className={cn("mt-0.5 size-4 shrink-0", style.tone)} strokeWidth={2} />
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium text-[var(--color-ink)]">{item.title}</p>
                    {item.description ? (
                      <p className="text-xs leading-relaxed text-[var(--color-ink-muted)]">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  aria-label="关闭提示"
                  className="absolute right-2.5 top-3 rounded-[var(--radius-sm)] p-1 text-[var(--color-ink-faint)] transition-colors hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-ink)]"
                >
                  <X className="size-3.5" />
                </button>
                <span className={cn("absolute inset-x-0 bottom-0 h-0.5", style.bar)} />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}
