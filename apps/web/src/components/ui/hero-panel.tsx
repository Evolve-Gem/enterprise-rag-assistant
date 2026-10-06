import { cn } from "@/lib/utils";

/**
 * Hero shell with a light glass treatment.
 *
 * The trick is layering, not effects: a soft radial wash sits *behind* the
 * glass card, so `backdrop-blur` has something to pick up and the panel reads
 * as glass even though the page canvas is flat. Deliberately restrained —
 * no saturated neon, no particle animation, no large gradients.
 */
export function HeroPanel({
  children,
  aside,
  className,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      {/* Ambient wash behind the glass — the blur reads from this, not from the
          flat page background. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-2 -top-5 h-32 opacity-80 blur-2xl sm:-top-6 sm:h-44"
        style={{
          background:
            "radial-gradient(55% 100% at 16% 48%, var(--color-accent-soft) 0%, transparent 72%)," +
            "radial-gradient(45% 100% at 88% 10%, rgb(8 145 178 / 0.13) 0%, transparent 72%)",
        }}
      />

      <section
        className={cn(
          "relative overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-glass-line)]",
          "bg-[var(--color-glass)] backdrop-blur-xl",
          "shadow-[0_1px_2px_rgb(24_24_27/0.04),0_18px_44px_-22px_rgb(79_70_229/0.30)]",
          "px-4 py-4 sm:px-7 sm:py-8",
        )}
      >
        {/* Inner sheen: a single soft radial, nothing more. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full opacity-[0.09]"
          style={{ background: "radial-gradient(circle, var(--color-accent) 0%, transparent 68%)" }}
        />

        <div className="relative flex flex-col gap-3.5 sm:gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          <div className="min-w-0 flex-1">{children}</div>
          {aside ? <div className="shrink-0">{aside}</div> : null}
        </div>
      </section>
    </div>
  );
}
