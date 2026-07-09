"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "./Icon";
import { Portrait } from "./Portrait";
import { sfx } from "@/lib/sound";
import { EASE_OUT } from "@/lib/motion";
import { TourStep, hasSeenTour, markTourSeen } from "@/lib/tour";

/* Gate a tour to the first time a profile meets it. `when` lets a discovery
   tip wait for its moment (e.g. companion is about to evolve). Returns the
   props to spread onto <Tour />. Replays happen by clearing the localStorage
   flag (Help) and revisiting the screen. */
export function useOnboardingTour(
  id: string,
  profileId: string | undefined,
  when = true,
  delayMs = 700
) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!profileId || !when) return;
    if (hasSeenTour(id, profileId)) return;
    const t = setTimeout(() => setActive(true), delayMs);
    return () => clearTimeout(t);
  }, [id, profileId, when, delayMs]);
  const onDone = useCallback(() => {
    if (profileId) markTourSeen(id, profileId);
    setActive(false);
  }, [id, profileId]);
  return { active, onDone };
}

/* The spotlight tour engine — one calm, premium coach-mark used by every
   onboarding moment and every progressive-discovery tip in the app.

   It darkens the screen, cuts a soft glowing hole around ONE element
   ([data-tour="…"]), and floats a small card beside it. Steps without an
   anchor show a centered welcome card over a plain dim backdrop.

   Two voices: `tone="hero"` warms the card and shows the child's companion
   (an adventure, not a tutorial); `tone="parent"` stays quiet and plain.

   Keyboard: →/Enter/Space next · ← back · Esc skip. Touch: the buttons.
   Fully responsive — the card measures the anchor each frame and never
   leaves the viewport. */

const CARD_W = 320;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function Tour({
  steps,
  active,
  onDone,
  tone = "parent",
  companionSpecies,
}: {
  steps: TourStep[];
  active: boolean;
  /** fired once, when the tour finishes or is skipped */
  onDone: () => void;
  tone?: "parent" | "hero";
  companionSpecies?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const doneRef = useRef(false);

  useEffect(() => setMounted(true), []);

  // reset to the first step whenever the tour (re)opens
  useEffect(() => {
    if (active) {
      setI(0);
      doneRef.current = false;
    }
  }, [active]);

  const step = steps[i];

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  }, [onDone]);

  const next = useCallback(() => {
    if (i >= steps.length - 1) {
      if (tone === "hero") sfx.chirp();
      finish();
    } else {
      sfx.click();
      setI((n) => n + 1);
    }
  }, [i, steps.length, tone, finish]);

  const back = useCallback(() => {
    if (i > 0) {
      sfx.click();
      setI((n) => n - 1);
    }
  }, [i]);

  // measure the current anchor, keeping the spotlight glued to it as the
  // page scrolls or resizes (rAF-light: only while a tour is active)
  useEffect(() => {
    if (!active || !step) return;
    const anchorSel = step.anchor;
    if (!anchorSel) {
      setRect(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(`[data-tour="${anchorSel}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    // only scroll if the anchor is actually off-screen — force-centering every
    // step makes the page lurch between steps and reads as "jumpy / out of order"
    el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    let raf = 0;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      raf = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(raf);
  }, [active, step]);

  // keyboard navigation
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        finish();
      } else if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        back();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, next, back, finish]);

  // lock body scroll while the tour is up
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);

  if (!mounted || !active || !step) return null;

  const pad = 8;
  const isHero = tone === "hero";
  const accent = isHero ? "var(--accent-2)" : "var(--accent)";

  // where the card sits: beside the anchor (flipping above if low on screen),
  // or centered when there's no anchor
  const vw = typeof window !== "undefined" ? window.innerWidth : 400;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const cardW = Math.min(CARD_W, vw - 24);

  // a non-animated wrapper owns placement (framer overrides `transform` on the
  // animated card, so centering can't live there); the card owns only its size
  let wrapPos: React.CSSProperties | undefined;
  if (rect) {
    const below = rect.top + rect.height + 240 < vh || rect.top < vh * 0.4;
    const left = Math.max(12, Math.min(rect.left + rect.width / 2 - cardW / 2, vw - cardW - 12));
    wrapPos = below
      ? { top: rect.top + rect.height + pad + 12, left }
      : { bottom: vh - rect.top + pad + 12, left };
  }

  const isLast = i === steps.length - 1;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="tour"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: EASE_OUT }}
        className="fixed inset-0 z-[120]"
        role="dialog"
        aria-modal="true"
        aria-label="Guided tour"
      >
        {/* the dimming: a spotlight ring for anchored steps, a flat scrim
            for centered ones */}
        {rect ? (
          <motion.div
            className="pointer-events-none absolute rounded-2xl"
            initial={false}
            animate={{
              top: rect.top - pad,
              left: rect.left - pad,
              width: rect.width + pad * 2,
              height: rect.height + pad * 2,
            }}
            transition={{ duration: 0.42, ease: EASE_OUT }}
            style={{
              boxShadow: `0 0 0 9999px rgba(3,6,20,0.74), 0 0 0 2px ${accent}, 0 0 26px 2px var(--glow)`,
            }}
          />
        ) : (
          <div className="absolute inset-0" style={{ background: "rgba(3,6,20,0.74)" }} />
        )}

        {/* click-blocker so the app beneath can't be touched mid-tour */}
        <div className="absolute inset-0" onClick={() => {}} />

        {/* the tip card — wrapper places it, card animates in place */}
        <div
          className={rect ? "absolute" : "absolute inset-0 flex items-center justify-center p-4"}
          style={wrapPos}
        >
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.26, ease: EASE_OUT }}
            className="panel panel-glow relative p-5"
            style={{ width: cardW }}
          >
            <div className="flex items-start gap-3">
              {isHero && companionSpecies && (
                <div className="shrink-0">
                  <Portrait species={companionSpecies} size={40} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                {step.title && (
                  <p
                    className="text-display text-sm font-black"
                    style={{ color: isHero ? "var(--accent-2)" : "var(--text)" }}
                  >
                    {step.title}
                  </p>
                )}
                <p className="mt-1 text-sm font-semibold leading-snug text-[var(--text)]">
                  {step.text}
                </p>
              </div>
            </div>

            {/* progress dots + controls */}
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5" aria-hidden>
                {steps.map((_, n) => (
                  <span
                    key={n}
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: n === i ? 16 : 6,
                      background: n === i ? accent : "rgba(255,255,255,0.25)",
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                {i > 0 && (
                  <button
                    onClick={back}
                    className="text-display cursor-pointer rounded-lg px-2.5 py-2 text-xs font-bold text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={next}
                  className="text-display min-h-[36px] cursor-pointer rounded-lg px-4 py-2 text-sm font-black text-white transition-[filter] hover:brightness-110"
                  style={{
                    background: `linear-gradient(160deg, ${accent}, var(--accent-deep))`,
                  }}
                >
                  {isLast ? (isHero ? "Let's go!" : "Done") : "Next"}
                </button>
              </div>
            </div>

            {/* skip — quiet, always available */}
            {!isLast && (
              <button
                onClick={finish}
                className="text-display absolute -top-9 right-0 flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-white/70 transition-colors hover:text-white"
              >
                Skip <Icon name="x" size={12} />
              </button>
            )}
          </motion.div>
        </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
