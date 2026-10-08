"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

/**
 * Hero shell — the flagship surface.
 *
 * Built as layers rather than as one styled box, because a single white card
 * with a purple border is precisely the "student project" look this release is
 * removing:
 *
 *   layer 0  page canvas
 *   layer 1  ambient light *behind* the glass (this is what backdrop-blur reads)
 *   layer 2  the glass panel
 *   layer 3  inner highlights — a lit top rim and a soft bottom bevel
 *   layer 4  a very faint grain so the large flat area is not perfectly flat
 *   layer 5  a pointer-reactive glow, capped at a few percent alpha
 *
 * V4.2 precision pass. An independent review measured the previous version and
 * found the panel sat on a canvas only ~4% apart in value, so the glass and the
 * glow were effectively invisible — "clean" rather than "lit". Three changes,
 * all material rather than decorative:
 *
 *   - the ambient light is now two overlapping lobes (brand violet plus a cool
 *     cyan counter-lobe) at a longer falloff, so it paints a gradient rather
 *     than a soft circle;
 *   - the glass carries a vertical gradient of its own (brighter at the top)
 *     instead of one flat translucent white, which is what makes a surface read
 *     as a material rather than as an overlay;
 *   - a bottom bevel joins the top rim, so the panel has a lit edge on two
 *     sides instead of floating on one.
 *
 * No dimension changed: the mobile first screen must still show all three entry
 * rows, so this release buys quality with light, not with height.
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
    // `overflow-x-clip` because the ambient light is deliberately wider than the
    // panel so it spills onto the canvas — but at <=768 the spill (24px) exceeds
    // the main column's horizontal padding (16px), which produced a real 8px
    // horizontal scrollbar on the home page at 375/390/430 (4px at 768/1080).
    // `clip` rather than `hidden`: it stops the horizontal overflow without
    // creating a scroll container, so the vertical spill and any sticky
    // descendant keep working.
    <div ref={ref} className={cn("relative overflow-x-clip", className)}>
      {/* Layer 1 — ambient light behind the glass, deliberately larger than the
          panel so the light spills onto the canvas and the edge reads as an
          edge rather than as a border. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-6 -top-10 h-40 sm:-top-14 sm:h-64"
        style={{
          background:
            "radial-gradient(58% 100% at 12% 60%, var(--color-brand-glow) 0%, transparent 68%)," +
            "radial-gradient(48% 100% at 34% 30%, var(--color-brand-glow-soft) 0%, transparent 74%)," +
            "radial-gradient(44% 100% at 92% 6%, rgb(14 116 144 / 0.14) 0%, transparent 70%)",
          filter: "blur(26px)",
        }}
      />

      <section
        className={cn(
          "grain relative overflow-hidden rounded-[var(--radius-hero)]",
          "border border-[var(--color-glass-line)]",
          "px-4 py-4 shadow-[var(--elevation-hero)] sm:px-7 sm:py-8",
        )}
        style={{
          // A gradient rather than a flat translucent fill: the top is denser,
          // the bottom lets more of the ambient through, which is what gives the
          // panel a sense of thickness. The stops come from tokens because they
          // MUST flip with the theme — hardcoding white here put near-white text
          // (--color-ink in dark) on a light panel and measured 1.74:1 contrast.
          background:
            "linear-gradient(180deg, var(--color-glass-from) 0%, var(--color-glass-via) 46%, var(--color-glass-to) 100%)",
          backdropFilter: "blur(20px) saturate(1.35)",
          WebkitBackdropFilter: "blur(20px) saturate(1.35)",
        }}
      >
        {/* Layer 3a — top rim: a 1px lit edge sells "glass" more than any border
            colour. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            // The lit top edge. Kept brighter than the fill in both themes on
            // purpose: a rim highlight reads as light, not as a background.
            background:
              "linear-gradient(90deg, transparent 0%, rgb(255 255 255 / 0.55) 20%, rgb(255 255 255 / 0.32) 62%, transparent 100%)",
          }}
        />
        {/* Layer 3b — bottom bevel: a soft inner shadow along the lower edge, so
            the surface has depth instead of floating on a single highlight. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
          style={{
            background:
              "linear-gradient(0deg, rgb(99 91 255 / 0.055) 0%, transparent 100%)",
          }}
        />
        {/* A single soft radial in the upper-right, kept very low. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full opacity-[0.13]"
          style={{ background: "radial-gradient(circle, var(--color-accent) 0%, transparent 66%)" }}
        />

        {/* Layer 5 — pointer glow. 8% at the centre, gone by 72%. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden opacity-[0.08] transition-opacity duration-[var(--motion-slow)] lg:block"
          style={{
            background:
              "radial-gradient(440px circle at var(--pointer-x, 50%) var(--pointer-y, 0%), var(--color-accent) 0%, transparent 72%)",
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
