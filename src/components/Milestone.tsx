"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useWorld } from "./ThemeProvider";
import { Icon } from "./Icon";
import { Companion } from "./Companion";
import { GameButton } from "./GameButton";
import { sfx } from "@/lib/sound";
import { companionLevel } from "@/lib/game";
import { hasSeenTour, markTourSeen } from "@/lib/tour";
import { EASE_OUT, overlayFade, popSpring } from "@/lib/motion";
import { useEscape } from "@/lib/a11y";

/* ============================================================
   The WonderNest Milestone celebration — ONE reusable moment for
   every "something special happened" beat that isn't a quest
   approval: challenge victories today; streak milestones, reward
   grants, seasonal events tomorrow. Add a mapper to
   EVENT_MILESTONES and the rest (queueing, once-per-account
   gating, the cinematic itself) is already done.

   Milestones are sourced from the `events` table (written
   server-side at award time — the same rows future notifications
   will subscribe to) and celebrated exactly once per ACCOUNT:
   seen-flags ride the profiles.tours_seen system, so a milestone
   never replays on a new device.
   ============================================================ */

export interface Milestone {
  /** stable identity — `ms_<event uuid>` — used for the seen-once flag */
  id: string;
  /** the big headline, e.g. "Champion!" */
  heading: string;
  /** gold banner card headline, e.g. "CHAMPION" (omit for no banner) */
  banner?: string;
  /** banner subtitle, e.g. the challenge title */
  title?: string;
  /** supporting sentence under the rewards */
  message?: string;
  xp?: number;
  coins?: number;
  /** Icon art name on the banner (default: trophy) */
  icon?: string;
  /** glow/heading color (default: gold — milestones feel like treasure) */
  accent?: string;
}

/* event type → milestone look. Return null to skip (marks the event seen). */
const EVENT_MILESTONES: Record<
  string,
  (payload: Record<string, unknown>) => Omit<Milestone, "id"> | null
> = {
  challenge_won: (p) => {
    const coop = p.mode === "cooperative";
    return {
      heading: coop ? "We did it together!" : "Champion!",
      banner: coop ? "TEAM VICTORY" : "CHAMPION",
      title: typeof p.title === "string" ? p.title : undefined,
      message: coop
        ? "Your whole family reached the goal — everyone wins!"
        : "You finished at the top of the board!",
      xp: typeof p.xp === "number" ? p.xp : undefined,
      icon: coop ? "users" : "trophy",
    };
  },
};

/** Finds the child's oldest uncelebrated milestone once `ready` turns true
    (pass `ready=false` while a quest celebration is up — quests come first). */
export function useMilestones(profileId: string | undefined, ready: boolean) {
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const checked = useRef(false);

  useEffect(() => {
    if (!profileId || !ready || checked.current) return;
    checked.current = true;
    const supabase = createClient();
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    supabase
      .from("events")
      .select("id, type, payload")
      .eq("child_id", profileId)
      .in("type", Object.keys(EVENT_MILESTONES))
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        for (const ev of (data ?? []) as { id: string; type: string; payload: Record<string, unknown> }[]) {
          const key = `ms_${ev.id}`;
          if (hasSeenTour(key, profileId)) continue;
          const spec = EVENT_MILESTONES[ev.type]?.(ev.payload ?? {});
          if (!spec) {
            markTourSeen(key, profileId);
            continue;
          }
          setMilestone({ ...spec, id: key });
          return;
        }
      });
  }, [profileId, ready]);

  const dismiss = useCallback(() => {
    if (milestone && profileId) markTourSeen(milestone.id, profileId);
    setMilestone(null);
  }, [milestone, profileId]);

  return { milestone, dismiss };
}

const CONFETTI_COLORS = ["#ffd76a", "#8fd0ff", "#ff8ba6", "#9fdd7a", "#c77dff", "#ffffff"];

/* The cinematic — the celebration language of CelebrationOverlay (bloom,
   confetti storm, shockwave, cheering companion, reward count-up, gold
   shimmer banner) in one milestone-shaped package. */
export function MilestoneCelebration({
  milestone,
  onClose,
}: {
  milestone: Milestone | null;
  onClose: () => void;
}) {
  const { theme, profile, companion } = useWorld();
  const [phase, setPhase] = useState(0);
  const accent = milestone?.accent ?? "var(--gold)";
  useEscape(!!milestone && phase >= 2, onClose);

  useEffect(() => {
    if (!milestone) return;
    setPhase(0);
    sfx.complete();
    const t1 = setTimeout(() => {
      setPhase(1);
      if (milestone.xp || milestone.coins) sfx.coin();
    }, 500);
    const t2 = setTimeout(() => {
      setPhase(2);
      sfx.levelUp();
    }, 1300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [milestone]);

  const confetti = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 1.6,
        dur: 2.6 + Math.random() * 2.4,
        size: 6 + Math.random() * 8,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: Math.random() > 0.5,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [milestone]
  );

  return (
    <AnimatePresence>
      {milestone && (
        <motion.div
          {...overlayFade}
          role="dialog"
          aria-modal="true"
          aria-label={milestone.heading}
          className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-black/75 backdrop-blur-sm"
        >
          {/* warm bloom of light */}
          <motion.div
            className="fx-light pointer-events-none absolute left-1/2 top-1/2 h-[140vmax] w-[140vmax] -translate-x-1/2 -translate-y-1/2"
            style={{ background: `radial-gradient(circle, ${accent}33, transparent 55%)` }}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 0.6, scale: 1 }}
            transition={{ duration: 0.8, ease: EASE_OUT }}
          />

          {/* confetti storm */}
          {confetti.map((c) => (
            <div
              key={c.id}
              className="fx-light pointer-events-none absolute top-0"
              style={{
                left: `${c.left}%`,
                width: c.size,
                height: c.round ? c.size : c.size * 0.5,
                borderRadius: c.round ? "50%" : 2,
                background: c.color,
                boxShadow: `0 0 8px ${c.color}66`,
                animation: `confetti-fall ${c.dur}s linear ${c.delay}s both`,
              }}
            />
          ))}

          {/* radial shockwave */}
          <motion.div
            initial={{ scale: 0, opacity: 0.9 }}
            animate={{ scale: 8, opacity: 0 }}
            transition={{ duration: 1.4, ease: "easeOut" }}
            className="absolute h-40 w-40 rounded-full"
            style={{ border: `3px solid ${accent}`, boxShadow: `0 0 60px ${accent}88` }}
          />

          <div className="relative z-10 mx-4 flex max-w-md flex-col items-center text-center">
            {profile && (
              <motion.div initial={{ scale: 0, y: 20 }} animate={{ scale: 1, y: 0 }} transition={popSpring}>
                <Companion
                  species={profile.pet}
                  level={companion ? companionLevel(companion.xp) : 1}
                  celebrate
                  size={110}
                  float={false}
                />
              </motion.div>
            )}
            <motion.h2
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={popSpring}
              className="text-display text-glow text-4xl font-black sm:text-5xl"
              style={{ color: accent, textShadow: `0 0 30px ${accent}` }}
            >
              {milestone.heading}
            </motion.h2>

            {phase >= 1 && (milestone.xp != null || milestone.coins != null) && (
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="mt-6 flex items-center gap-6"
              >
                {milestone.coins != null && (
                  <RewardPill color="var(--gold)" label={theme.coinName} value={`+${milestone.coins}`} />
                )}
                {milestone.xp != null && (
                  <RewardPill color="var(--accent-2)" label="XP" value={`+${milestone.xp}`} />
                )}
              </motion.div>
            )}

            {phase >= 1 && milestone.message && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-5 text-base font-semibold text-[var(--text)]"
              >
                {milestone.message}
              </motion.p>
            )}

            {phase >= 2 && milestone.banner && (
              <motion.div
                initial={{ scale: 0.6, rotate: -4 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={popSpring}
                className="panel panel-glow relative mt-6 overflow-hidden px-10 py-5"
              >
                <div
                  className="fx-light absolute inset-0 opacity-50"
                  style={{
                    background:
                      "linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.25) 50%, transparent 70%)",
                    backgroundSize: "200% 100%",
                    animation: "shimmer 2.2s linear infinite",
                  }}
                />
                <div className="flex items-center justify-center gap-3">
                  <Icon name={milestone.icon ?? "trophy"} size={38} art />
                  <div className="text-display text-glow text-3xl font-black" style={{ color: accent }}>
                    {milestone.banner}
                  </div>
                </div>
                {milestone.title && (
                  <div className="text-display mt-1.5 rounded-full bg-black/30 px-4 py-1 text-sm font-bold text-[var(--text)]">
                    {milestone.title}
                  </div>
                )}
              </motion.div>
            )}

            {phase >= 2 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-8"
              >
                <GameButton onClick={onClose} className="px-8 text-lg">
                  Onward!
                </GameButton>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RewardPill({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-display text-3xl font-black" style={{ color, textShadow: `0 0 20px ${color}` }}>
        {value}
      </span>
      <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]">{label}</span>
    </div>
  );
}
