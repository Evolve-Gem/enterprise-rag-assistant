"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Stage hero — the flagship ink surface.
 *
 * V5: the hero stopped pretending to be a white card. It is the first "stage"
 * in the product: a deep-ink panel with an aurora field, a lit top rim, grain
 * and a pointer glow. In light mode it is deliberately the one dark object on
 * a bright canvas — that contrast is the brand's first impression, and it is
 * why a screenshot of this page no longer looks like the previous version.
 *
 * Layers:
 *   0  canvas
 *   1  ambient aurora spill *behind* the panel (paints onto the canvas)
 *   2  the stage fill (ink gradient) + border + stage elevation
 *   3  aurora field inside the stage, slowly drifting
 *   4  grain so the large flat area is not perfectly flat
 *   5  pointer glow, capped at low alpha
 *
 * No dimension changed versus V4.2: the mobile first screen must still show
 * all three entry rows, so this release buys quality with light, not height.
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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const noHover = window.matchMedia("(hover: none)").matches;
    if (reduce || noHover) return;

    let frame = 0;
    const onMove = (event: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        el.style.setProperty("--pointer-x", `${((event.clientX - rect.left) / rect.width) * 100}%`);
        el.style.setProperty("--pointer-y", `${((event.clientY - rect.top) / rect.height) * 100}%`);
      });
    };

    el.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      el.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    // `overflow-x-clip` because the ambient light is deliberately wider than
    // the panel so it spills onto the canvas — but at <=768 the spill exceeds
    // the main column's horizontal padding, which once produced a real
    // horizontal scrollbar. `clip` (not `hidden`) avoids creating a scroll
    // container while stopping the horizontal overflow.
    <div ref={ref} className={cn("relative overflow-x-clip", className)}>
      {/* Layer 1 — ambient aurora behind the glass, larger than the panel so
          the light spills onto the canvas and the edge reads as an edge. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-6 -top-10 h-40 sm:-top-14 sm:h-64"
        style={{
          background:
            "radial-gradient(58% 100% at 12% 60%, var(--aurora-violet) 0%, transparent 68%)," +
            "radial-gradient(48% 100% at 34% 30%, var(--aurora-indigo) 0%, transparent 74%)," +
            "radial-gradient(44% 100% at 92% 6%, var(--aurora-cyan) 0%, transparent 70%)",
          filter: "blur(30px)",
        }}
      />

      <section
        className={cn(
          "stage-panel grain relative px-4 py-4 sm:px-7 sm:py-8",
        )}
      >
        {/* Layer 3 — the aurora field inside the stage. Subtle on purpose: it
            is ambience, not decoration. */}
        <div aria-hidden className="aurora-field animate-aurora opacity-70" />

        {/* A single soft radial in the upper-right, kept very low. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full opacity-[0.20]"
          style={{ background: "radial-gradient(circle, #7c5dfa 0%, transparent 66%)" }}
        />

        {/* Layer 4b — bottom bevel: a soft inner shadow along the lower edge,
            so the surface has depth instead of floating on one highlight. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
          style={{
            background: "linear-gradient(0deg, rgb(99 91 255 / 0.10) 0%, transparent 100%)",
          }}
        />

        {/* Layer 5 — pointer glow. Subtle at rest, brighter under the cursor. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden opacity-[0.16] transition-opacity duration-[var(--motion-slow)] lg:block"
          style={{
            background:
              "radial-gradient(460px circle at var(--pointer-x, 50%) var(--pointer-y, 0%), rgb(150 160 255 / 0.22) 0%, transparent 70%)",
          }}
        />

        <div className="relative flex flex-col gap-3.5 sm:gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          <div className="min-w-0 flex-1">{children}</div>
          {aside ? <div className="shrink-0">{aside}</div> : null}
        </div>
      </section>
    </div>
  );
}
