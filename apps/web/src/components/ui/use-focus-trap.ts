"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The last control the user actually activated, outside any open dialog.
 *
 * Restoring focus to `document.activeElement` captured when a dialog *opens* is
 * not reliable here: opening the citation drawer re-renders the answer body, and
 * React replaces every citation chip with a new DOM node. The element captured a
 * moment earlier is then detached, `focus()` silently does nothing, and the user
 * lands on `<body>` — losing their place in a long answer, which is exactly what
 * this hook exists to prevent.
 *
 * A capture-phase `click` listener sees the real activation before React
 * re-renders, so it survives that unmount. Clicks inside a dialog are ignored so
 * that interacting with the panel cannot overwrite the trigger.
 */
let lastInteracted: HTMLElement | null = null;

function rememberTarget(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const control = target.closest('button, a[href], [role="button"], [role="tab"]');
  if (!(control instanceof HTMLElement)) return;
  if (control.closest('[role="dialog"]')) return;
  lastInteracted = control;
}

if (typeof document !== "undefined") {
  document.addEventListener("click", rememberTarget, true);
}

/**
 * Modal focus management.
 *
 * A dialog that only handles Escape and a scroll lock is still unusable with a
 * keyboard: focus stays on the page behind it, Tab walks out into that page, and
 * closing leaves the user at the top of the document with no idea where they
 * were. This owns the three pieces WCAG expects:
 *
 *   1. move focus into the panel when it opens (first focusable, else the panel)
 *   2. keep Tab / Shift+Tab cycling inside the panel
 *   3. return focus to whatever was focused before, on close
 *
 * Returning focus matters as much as trapping it: the trigger is usually a
 * citation chip deep in an answer, and losing that position is the difference
 * between "closed the panel" and "lost my place".
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    const previous = document.activeElement as HTMLElement | null;

    const focusable = () =>
      Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement,
      );

    const first = focusable()[0];
    (first ?? node).focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const list = focusable();
      if (list.length === 0) {
        event.preventDefault();
        return;
      }
      const firstEl = list[0];
      const lastEl = list[list.length - 1];
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    node.addEventListener("keydown", onKeyDown);
    return () => {
      node.removeEventListener("keydown", onKeyDown);
      // Prefer the element captured at open time, but fall back to the last
      // real interaction target when that node has since been unmounted (see
      // rememberTarget above). Only focus something still in the document —
      // calling focus() on a detached node fails silently and leaves the user
      // on <body>.
      const preferred = previous && document.contains(previous) ? previous : lastInteracted;
      if (preferred && document.contains(preferred)) {
        preferred.focus({ preventScroll: true });
      }
    };
  }, [active]);

  return ref;
}
