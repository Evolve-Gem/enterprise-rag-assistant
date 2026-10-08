"use client";

import { MotionConfig } from "framer-motion";

/**
 * Honour prefers-reduced-motion for JavaScript animations.
 *
 * globals.css already collapses CSS animations and transitions, but that media
 * query cannot reach framer-motion: the mascot's infinite loops, the drawer
 * transitions and the toast entrance all run in JS. `reducedMotion="user"` makes
 * every descendant motion component skip transform and layout animation while
 * still allowing opacity, which is the standard graceful degradation — the user
 * still sees that something changed, just without movement.
 *
 * Placed at the root so a future component cannot forget to opt in.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
