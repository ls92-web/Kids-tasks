"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Companion } from "./Companion";
import { sfx } from "@/lib/sound";
import { glide, popSpring, EASE_OUT } from "@/lib/motion";
import { CoachStep, hasSeenTour, markTourSeen } from "@/lib/tour";

/* ============================================================
   The Companion Guided Adventure.

   NOT a tutorial. The child's own companion drifts onto the screen,
   waves, and says one or two short, excited lines — sometimes gliding
   beside a UI element and giving it a soft glow (never a dark overlay,
   never a popup). The child can tap to hear the next line, tap the
   element itself, or skip. It always feels like exploring together.

   Beats are gated once-per-profile (localStorage) and replay from
   Settings › Adventure Guide.
   ============================================================ */

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/* gate a companion beat to the first time it's relevant */
export function useCoachBeat(
  id: string,
  profileId: string | undefined,
  when = true,
  delayMs = 900
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

const CLUSTER_W = 300;
const NAV_SAFE = 108; // keep clear of the bottom nav

export function CompanionCoach({
  steps,
  active,
  onDone,
  species,
}: {
  steps: CoachStep[];
  active: boolean;
  onDone: () => void;
  species: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const doneRef = useRef(false);

  useEffect(() => setMounted(true), []);
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
      sfx.chirp();
      finish();
    } else {
      sfx.chirp();
      setI((n) => n + 1);
    }
  }, [i, steps.length, finish]);

  // measure the current beat's anchor (if any), tracking it every frame
  useEffect(() => {
    if (!active || !step) return;
    if (!step.anchor) {
      setRect(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.anchor}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    let raf = 0;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      raf = requestAnimationFrame(measure);
    };
    measure();
    return () => cancelAnimationFrame(raf);
  }, [active, step]);

  // The companion WAITS for the child — no auto-advance. A guide that plays
  // itself to an empty room and marks itself "seen" forever is no guide at
  // all (this happened: brand-new heroes "never saw" their welcome). Only a
  // real tap (next) or Skip completes the beat and records it.

  // keyboard: → / Enter / Space advance, Esc skips
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        finish();
      } else if (e.key === "ArrowRight" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        next();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, next, finish]);

  if (!mounted || !active || !step) return null;

  const vw = typeof window !== "undefined" ? window.innerWidth : 400;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const clusterW = Math.min(CLUSTER_W, vw - 24);

  // where the companion + bubble sit: beside the anchor, or standing with the
  // child at the bottom of the screen when there's nothing to point at
  let pos: { top: number; left: number };
  if (rect) {
    const below = rect.top + rect.height / 2 < vh * 0.5;
    const top = below
      ? Math.min(rect.top + rect.height + 14, vh - NAV_SAFE - 96)
      : Math.max(16, rect.top - 118);
    const left = Math.max(12, Math.min(rect.left + rect.width / 2 - clusterW / 2, vw - clusterW - 12));
    pos = { top, left };
  } else {
    pos = { top: vh - NAV_SAFE - 96, left: Math.max(12, vw / 2 - clusterW / 2) };
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[120]" aria-live="polite">
      {/* a soft glow on the element we're pointing at — never a dark scrim */}
      {rect && (
        <motion.div
          className="absolute rounded-2xl"
          initial={false}
          animate={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            opacity: [0.55, 1, 0.55],
          }}
          transition={{
            top: glide,
            left: glide,
            width: glide,
            height: glide,
            opacity: { duration: 2.4, repeat: Infinity, ease: "easeInOut" },
          }}
          style={{ boxShadow: "0 0 0 2px var(--accent-2), 0 0 24px 2px var(--glow)" }}
        />
      )}

      <AnimatePresence>
        {active && (
          <motion.div
            className="pointer-events-none absolute flex items-end gap-2"
            style={{ width: clusterW }}
            initial={{ opacity: 0, x: -44 }}
            animate={{ opacity: 1, x: 0, top: pos.top, left: pos.left }}
            exit={{ opacity: 0, x: 36, transition: { duration: 0.32, ease: EASE_OUT } }}
            transition={{ top: glide, left: glide, opacity: { duration: 0.4 }, x: glide }}
          >
            {/* the companion — taps to hear the next line */}
            <button
              onClick={next}
              className="pointer-events-auto shrink-0"
              aria-label="Next"
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.35 }}
              >
                <Companion species={species} level={1} size={76} float={false} interactive />
              </motion.div>
            </button>

            {/* the speech bubble */}
            <div className="pointer-events-auto min-w-0 flex-1 pb-2">
              <AnimatePresence mode="wait">
                <motion.button
                  key={i}
                  onClick={next}
                  initial={{ opacity: 0, scale: 0.9, x: -6 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.94, x: 4 }}
                  transition={popSpring}
                  className="panel panel-glow relative block w-full px-4 py-3 text-left"
                  style={{ borderBottomLeftRadius: 4 }}
                >
                  {/* little tail toward the companion */}
                  <span
                    className="absolute -left-1.5 bottom-3 h-3 w-3 rotate-45 rounded-sm"
                    style={{ background: "var(--surface)", borderLeft: "1px solid var(--surface-border)", borderBottom: "1px solid var(--surface-border)" }}
                  />
                  <p className="text-sm font-bold leading-snug text-[var(--text)]">{step.text}</p>
                  <div className="mt-1.5 flex items-center gap-1">
                    {steps.map((_, n) => (
                      <span
                        key={n}
                        className="h-1 rounded-full transition-all"
                        style={{
                          width: n === i ? 12 : 4,
                          background: n === i ? "var(--accent-2)" : "rgba(255,255,255,0.25)",
                        }}
                      />
                    ))}
                  </div>
                </motion.button>
              </AnimatePresence>

              <button
                onClick={finish}
                className="pointer-events-auto mt-1 pl-1 text-[11px] font-bold text-white/50 transition-colors hover:text-white/80"
              >
                Skip
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body
  );
}
