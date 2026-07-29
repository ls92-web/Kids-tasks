"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Companion } from "./Companion";
import { Icon } from "./Icon";
import { useWorld } from "./ThemeProvider";
import { sfx } from "@/lib/sound";
import { EASE_OUT } from "@/lib/motion";

/* ============================================================
   MICRO-CELEBRATIONS — the small joys layer.

   One reusable system for every 1-2 second "you did it!" moment:
   the companion cheers, stars burst, an encouraging banner floats
   up, and any coins/XP ride along as chips. No dark scrim, no
   flow interruption — it plays over the screen and melts away on
   its own (or on tap). The big moments (quest approval cinematic,
   challenge wins, Legend Ceremony, chapter completion) keep their
   full celebrations; this system is for everything smaller.

   Fire from anywhere:  microCelebrate("questSent", { subtitle })
   Configure per event via CELEBRATIONS presets: title pool, icon,
   accent, particle flavor — same framework, different sparkle.
   ============================================================ */

export type MicroKind =
  | "questSent"
  | "questComplete"
  | "challengeComplete"
  | "achievement"
  | "streak"
  | "evolution"
  | "levelUp"
  | "rewardGranted"
  | "worldComplete"
  | "dreamReached"
  | "wishApproved";

export interface MicroConfig {
  /** Random encouragement pool — one is picked per celebration. */
  titles: string[];
  icon: string;
  accent: string;
  particles: "stars" | "coins" | "hearts";
  /** Show the child's companion cheering beside the banner. */
  companion?: boolean;
}

export const CELEBRATIONS: Record<MicroKind, MicroConfig> = {
  questSent: {
    titles: ["Quest sent!", "Off it goes!", "Great work!"],
    icon: "mission-complete",
    accent: "var(--accent-2)",
    particles: "stars",
    companion: true,
  },
  questComplete: {
    titles: ["Quest Complete!", "Amazing!", "Well Done!"],
    icon: "check",
    accent: "var(--success)",
    particles: "stars",
    companion: true,
  },
  challengeComplete: {
    titles: ["Challenge Done!", "Fantastic!"],
    icon: "trophy",
    accent: "var(--gold)",
    particles: "stars",
    companion: true,
  },
  achievement: {
    titles: ["Badge Earned!", "Achievement!"],
    icon: "medal",
    accent: "var(--gold)",
    particles: "stars",
  },
  streak: {
    titles: ["Streak Power!", "On Fire!"],
    icon: "flame",
    accent: "#ff8a5c",
    particles: "stars",
  },
  evolution: {
    titles: ["Evolution!", "Growing Up!"],
    icon: "sparkle",
    accent: "var(--accent-2)",
    particles: "stars",
    companion: true,
  },
  levelUp: {
    titles: ["Level Up!", "Stronger!"],
    icon: "xp",
    accent: "var(--accent-2)",
    particles: "stars",
    companion: true,
  },
  rewardGranted: {
    titles: ["Your treasure arrived!", "It's yours!"],
    icon: "wrapped-gift",
    accent: "var(--gold)",
    particles: "coins",
    companion: true,
  },
  worldComplete: {
    titles: ["World Conquered!", "Adventure Complete!"],
    icon: "map",
    accent: "var(--gold)",
    particles: "stars",
    companion: true,
  },
  dreamReached: {
    titles: ["Dream reached!", "You saved up!"],
    icon: "star",
    accent: "var(--gold)",
    particles: "coins",
    companion: true,
  },
  wishApproved: {
    titles: ["Wish granted! 🌟", "They said yes!"],
    icon: "wish",
    accent: "var(--gold)",
    particles: "stars",
    companion: true,
  },
};

interface MicroDetail {
  kind: MicroKind;
  subtitle?: string;
  title?: string;
  coins?: number;
  xp?: number;
}

const MICRO_EVENT = "qf-micro-celebrate";

/** Fire-and-forget: play a micro-celebration over the current screen. */
export function microCelebrate(kind: MicroKind, extras: Omit<MicroDetail, "kind"> = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(MICRO_EVENT, { detail: { kind, ...extras } }));
}

const PARTICLES = 10;
const LIFETIME_MS = 1900;

/* Mounted once in the child layout — listens for microCelebrate() anywhere. */
export function MicroCelebrationHost() {
  const { profile } = useWorld();
  const [current, setCurrent] = useState<(MicroDetail & { id: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);

  useEffect(() => {
    function onCelebrate(e: Event) {
      const detail = (e as CustomEvent<MicroDetail>).detail;
      if (!detail?.kind || !CELEBRATIONS[detail.kind]) return;
      counter.current += 1;
      setCurrent({ ...detail, id: counter.current });
      try {
        sfx.chirp();
      } catch {}
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCurrent(null), LIFETIME_MS);
    }
    window.addEventListener(MICRO_EVENT, onCelebrate);
    return () => {
      window.removeEventListener(MICRO_EVENT, onCelebrate);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (typeof document === "undefined") return null;
  const cfg = current ? CELEBRATIONS[current.kind] : null;
  const title =
    current?.title ??
    (cfg ? cfg.titles[current!.id % cfg.titles.length] : "");

  return createPortal(
    <AnimatePresence>
      {current && cfg && (
        <motion.div
          key={current.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
          className="pointer-events-none fixed inset-x-0 top-[18%] z-[110] flex justify-center px-4"
          aria-live="polite"
        >
          {/* tap to skip — the card itself is the only interactive surface */}
          <motion.button
            type="button"
            onClick={() => setCurrent(null)}
            initial={{ y: 18, scale: 0.85 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: -14, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
            className="panel panel-glow pointer-events-auto relative flex cursor-pointer items-center gap-3 px-5 py-3.5"
            style={{ boxShadow: `0 0 0 1.5px ${cfg.accent}66, 0 0 34px -6px ${cfg.accent}` }}
          >
            {/* star/coin burst around the card */}
            {Array.from({ length: PARTICLES }).map((_, i) => {
              const angle = (i / PARTICLES) * Math.PI * 2;
              const dist = 70 + (i % 3) * 26;
              return (
                <motion.span
                  key={i}
                  className="pointer-events-none absolute left-1/2 top-1/2"
                  initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                  animate={{
                    x: Math.cos(angle) * dist,
                    y: Math.sin(angle) * dist * 0.7,
                    scale: [0, 1, 0.4],
                    opacity: [1, 1, 0],
                    rotate: i % 2 ? 160 : -160,
                  }}
                  transition={{ duration: 1.1, ease: EASE_OUT, delay: 0.05 }}
                >
                  <Icon
                    art
                    name={cfg.particles === "coins" ? (i % 3 ? "star" : "coin") : i % 4 === 3 ? "sparkle" : "star"}
                    size={i % 3 === 0 ? 18 : 12}
                  />
                </motion.span>
              );
            })}

            {cfg.companion && profile ? (
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 0.45, ease: EASE_OUT, repeat: 1, delay: 0.15 }}
                className="shrink-0"
              >
                <Companion species={profile.pet} level={1} size={52} float={false} />
              </motion.div>
            ) : (
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
                style={{ background: "rgba(0,0,0,0.3)" }}
              >
                <Icon art name={cfg.icon} size={30} />
              </span>
            )}

            <span className="min-w-0 text-left">
              <span className="text-display block text-lg font-black leading-tight" style={{ color: cfg.accent }}>
                {title}
              </span>
              {current.subtitle && (
                <span className="block max-w-[240px] truncate text-xs font-bold text-[var(--text-dim)]">
                  {current.subtitle}
                </span>
              )}
              {(current.coins || current.xp) && (
                <span className="mt-1 flex items-center gap-2">
                  {current.coins ? (
                    <motion.span
                      initial={{ y: 8, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.25 }}
                      className="text-display flex items-center gap-1 text-xs font-black text-[var(--gold)]"
                    >
                      <Icon art name="coin" size={14} /> +{current.coins}
                    </motion.span>
                  ) : null}
                  {current.xp ? (
                    <motion.span
                      initial={{ y: 8, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.35 }}
                      className="text-display flex items-center gap-1 text-xs font-black text-[var(--accent-2)]"
                    >
                      <Icon art name="xp" size={14} /> +{current.xp}
                    </motion.span>
                  ) : null}
                </span>
              )}
            </span>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
