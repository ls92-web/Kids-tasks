"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useWorld } from "./ThemeProvider";
import { Icon } from "./Icon";
import { Companion } from "./Companion";
import { sfx } from "@/lib/sound";
import { rankName, levelFromXp, companionLevel } from "@/lib/game";
import { EASE_OUT, overlayFade, popSpring } from "@/lib/motion";
import { useEscape } from "@/lib/a11y";

export interface CelebrationData {
  coins: number;
  xp: number;
  feedback?: string;
  leveledUp?: boolean;
  newLevel?: number;
  achievements?: string[];
  streak?: number;
}

const ACHIEVEMENT_TITLES: Record<string, string> = {
  streak_7: "7-Day Streak",
  streak_30: "30-Day Streak",
  tasks_100: "100 Missions Complete",
  coins_1000: "1000 Coins Earned",
  homework_hero: "Homework Hero",
  reading_legend: "Reading Legend",
};

const CONFETTI_COLORS = ["#ffd76a", "#8fd0ff", "#ff8ba6", "#9fdd7a", "#c77dff", "#ffffff"];

/* Full-screen cinematic celebration: spinning god-rays, confetti storm,
   coin bursts, XP counters, level-up shockwave with the new rank title,
   achievement banners — and a proper fanfare. */
export function CelebrationOverlay({
  data,
  onClose,
}: {
  data: CelebrationData | null;
  onClose: () => void;
}) {
  const { theme, profile, companion } = useWorld();
  const [phase, setPhase] = useState(0);
  // once the rewards have landed, Escape works like the Onward button
  useEscape(!!data && phase >= 2, onClose);

  useEffect(() => {
    if (!data) return;
    setPhase(0);
    sfx.complete();
    const t1 = setTimeout(() => {
      setPhase(1);
      sfx.coin();
    }, 500);
    const t2 = setTimeout(() => {
      setPhase(2);
      if (data.leveledUp) sfx.levelUp();
    }, 1400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [data]);

  const coins = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 480,
        y: -(120 + Math.random() * 380),
        delay: Math.random() * 0.5,
        dur: 0.9 + Math.random() * 0.7,
        size: 16 + Math.random() * 16,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data]
  );

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
    [data]
  );

  return (
    <AnimatePresence>
      {data && (
        <motion.div
          {...overlayFade}
          role="dialog"
          aria-modal="true"
          aria-label={`${theme.questWord} complete`}
          className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-black/75 backdrop-blur-sm"
        >
          {/* a soft bloom of light — the warmth of the moment, not a light show */}
          <motion.div
            className="fx-light pointer-events-none absolute left-1/2 top-1/2 h-[140vmax] w-[140vmax] -translate-x-1/2 -translate-y-1/2"
            style={{ background: "radial-gradient(circle, var(--glow-soft), transparent 55%)" }}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 0.55, scale: 1 }}
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
            style={{ border: "3px solid var(--accent-2)", boxShadow: "0 0 60px var(--glow)" }}
          />

          {/* coin burst */}
          {coins.map((c) => (
            <motion.div
              key={c.id}
              initial={{ x: 0, y: 60, opacity: 0, rotate: 0 }}
              animate={{
                x: c.x,
                y: [60, c.y, c.y + 500],
                opacity: [0, 1, 1, 0],
                rotate: 360 + Math.random() * 360,
              }}
              transition={{ duration: c.dur + 0.8, delay: c.delay, ease: "easeOut" }}
              className="absolute"
            >
              <div
                className="grid place-items-center rounded-full font-black text-[#4d3600]"
                style={{
                  width: c.size,
                  height: c.size,
                  fontSize: c.size * 0.5,
                  background: "radial-gradient(circle at 35% 30%, #fff3c4, var(--gold) 60%, #c99a1f)",
                  boxShadow: "0 0 14px rgba(255,215,106,0.7)",
                }}
              >
                C
              </div>
            </motion.div>
          ))}

          <div className="relative z-10 mx-4 flex max-w-md flex-col items-center text-center">
            {profile && (
              <motion.div
                initial={{ scale: 0, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                transition={popSpring}
              >
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
              className="text-display text-glow text-4xl font-black text-[var(--accent-2)] sm:text-5xl"
            >
              {theme.questWord} Complete
            </motion.h2>

            {phase >= 1 && (
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="mt-6 flex items-center gap-6"
              >
                <RewardPill color="var(--gold)" label={theme.coinName} value={`+${data.coins}`} />
                <RewardPill color="var(--accent-2)" label="XP" value={`+${data.xp}`} />
                {data.streak != null && data.streak > 1 && (
                  <RewardPill color="var(--danger)" label="Streak" value={`${data.streak}`} />
                )}
              </motion.div>
            )}

            {phase >= 1 && data.feedback && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-5 text-base font-semibold text-[var(--text)]"
              >
                {data.feedback}
              </motion.p>
            )}

            {phase >= 2 && data.leveledUp && data.newLevel != null && (
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
                <div className="text-display text-glow text-4xl font-black text-[var(--gold)]">
                  LEVEL UP
                </div>
                <div className="text-display mt-1 text-2xl font-bold text-[var(--accent-2)]">
                  Level {data.newLevel}
                </div>
                <div className="text-display mt-1.5 rounded-full bg-black/30 px-4 py-1 text-sm font-bold text-[var(--text)]">
                  You are now a{" "}
                  <span className="text-[var(--gold)]">{rankName(theme.id, data.newLevel)}</span>
                </div>
              </motion.div>
            )}

            {phase >= 2 &&
              data.achievements?.map((a, i) => (
                <motion.div
                  key={a}
                  initial={{ x: -60, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 + i * 0.15 }}
                  className="panel mt-3 flex items-center gap-3 px-5 py-2.5"
                >
                  <Icon name="trophy" size={22} className="text-[var(--gold)]" />
                  <span className="text-display font-bold">{ACHIEVEMENT_TITLES[a] ?? a}</span>
                </motion.div>
              ))}

            {phase >= 2 && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                onClick={() => {
                  sfx.click();
                  onClose();
                }}
                className="text-display mt-8 cursor-pointer rounded-2xl px-8 py-3 text-lg font-black text-white"
                style={{
                  background: "linear-gradient(160deg, var(--accent), var(--accent-deep))",
                  boxShadow: "0 0 30px -4px var(--glow)",
                }}
              >
                Onward
              </motion.button>
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
      <span
        className="text-display text-3xl font-black"
        style={{ color, textShadow: `0 0 20px ${color}` }}
      >
        {value}
      </span>
      <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]">
        {label}
      </span>
    </div>
  );
}
