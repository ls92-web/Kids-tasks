/* ============================================================
   Shared motion tokens — one timing language for the whole game.
   Every screen enters the same way, every tap springs the same way.
   Consistency is what makes it feel crafted rather than busy.
   ============================================================ */

import type { Transition } from "framer-motion";

/* the app's signature easing — a soft, confident settle (matches the CSS
   `rise` keyframe so JS and CSS animations feel like one hand made them) */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/* symmetric easing for moves that go out and come back, and for gentle
   ambient loops — replaces every ad-hoc "easeInOut" string */
export const EASE_IN_OUT = [0.65, 0, 0.35, 1] as const;

/* how a panel or card arrives on screen: a small, quick lift — never a
   big fly-in. Spread onto a motion element: <motion.div {...enter} /> */
export const enter = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: EASE_OUT },
} as const;

/* the same arrival, but for something that should scale up gently */
export const pop = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.35, ease: EASE_OUT },
} as const;

/* interactive feedback: buttons, nav pills, tappable cards */
export const tapSpring: Transition = { type: "spring", stiffness: 400, damping: 30 };

/* a modal or trophy popping into view — a small, controlled overshoot,
   never a bounce. The one spring every modal uses. */
export const popSpring: Transition = { type: "spring", stiffness: 260, damping: 24 };

/* something gliding from one place to another (the companion walking the map,
   a token moving between nodes) — smooth arrival, no wobble */
export const glide: Transition = { type: "spring", stiffness: 200, damping: 26 };

/* backdrop of a modal/overlay fading in and out — opacity only, quick */
export const overlayFade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.25, ease: EASE_OUT },
} as const;

/* page-to-page transition — the same subtle lift on every route, parent and
   child alike */
export const page = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, ease: EASE_OUT },
} as const;

/* progress + XP bars filling */
export const barFill: Transition = { duration: 0.7, ease: EASE_OUT };

/* Stagger for lists — quick per-item step with a hard ceiling so a long
   grid never takes more than a beat to finish assembling. */
export function stagger(i: number, step = 0.035, cap = 0.18): number {
  return Math.min(i * step, cap);
}
