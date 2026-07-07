"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { GameButton } from "./GameButton";
import { sfx } from "@/lib/sound";
import { EASE_OUT, overlayFade, popSpring } from "@/lib/motion";
import { useEscape } from "@/lib/a11y";

interface ChestReward {
  kind: string;
  bonus: number;
}

const KIND_LABEL: Record<string, string> = {
  coins: "Coins",
  coins_big: "Coin Hoard",
  xp: "XP Boost",
  jackpot: "Jackpot",
};

/* A mystery chest: shakes, bursts open with light and coins, reveals a
   random reward. Server rolls the reward (once per day) so it can't be gamed. */
export function MysteryChest({
  active,
  onClose,
  onReward,
}: {
  active: boolean;
  onClose: () => void;
  onReward: (r: ChestReward) => void;
}) {
  const [phase, setPhase] = useState<"closed" | "open" | "done">("closed");
  const [reward, setReward] = useState<ChestReward | null>(null);
  const [error, setError] = useState("");
  const rolledRef = useRef(false);
  useEscape(active && phase === "done", onClose);

  useEffect(() => {
    if (!active) return;
    if (rolledRef.current) return; // guard React strict-mode double invoke
    rolledRef.current = true;
    setPhase("closed");
    setReward(null);
    setError("");
    let cancelled = false;
    sfx.chest();
    (async () => {
      const supabase = createClient();
      const { data, error: err } = await supabase.rpc("open_daily_chest");
      // let the shake play for a beat regardless
      await new Promise((r) => setTimeout(r, 1000));
      if (cancelled) return;
      if (err || !data || data.already_opened) {
        setError(data?.already_opened ? "You already opened today's chest!" : "The chest is stuck — try again later.");
        setPhase("done");
        return;
      }
      const r: ChestReward = { kind: data.kind, bonus: data.bonus };
      setReward(r);
      setPhase("open");
      sfx.coin();
      onReward(r);
      setTimeout(() => !cancelled && setPhase("done"), 700);
    })();
    return () => {
      cancelled = true;
    };
  }, [active, onReward]);

  // allow the next day's chest to roll again once the modal closes
  useEffect(() => {
    if (!active) rolledRef.current = false;
  }, [active]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          {...overlayFade}
          role="dialog"
          aria-modal="true"
          aria-label="Mystery chest"
          className="fixed inset-0 z-50 grid place-items-center bg-black/75 backdrop-blur-sm"
          onClick={() => phase === "done" && onClose()}
        >
          {phase === "open" && (
            <>
              <motion.div
                initial={{ scale: 0, opacity: 0.9 }}
                animate={{ scale: 7, opacity: 0 }}
                transition={{ duration: 1.2, ease: EASE_OUT }}
                className="absolute h-32 w-32 rounded-full"
                style={{ border: "3px solid var(--gold)", boxShadow: "0 0 50px rgba(255,215,106,0.8)" }}
              />
              {Array.from({ length: 16 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ x: 0, y: 30, opacity: 0 }}
                  animate={{
                    x: (i - 8) * 34,
                    y: [30, -(90 + (i % 5) * 40), 420],
                    opacity: [0, 1, 0],
                    rotate: i * 47,
                  }}
                  transition={{ duration: 1.5, delay: i * 0.03, ease: EASE_OUT }}
                  className="absolute grid h-4 w-4 place-items-center rounded-full text-[10px] font-black text-[#4d3600]"
                  style={{
                    background: "radial-gradient(circle at 35% 30%, #fff3c4, var(--gold) 60%, #c99a1f)",
                    boxShadow: "0 0 12px rgba(255,215,106,0.7)",
                  }}
                >
                  C
                </motion.div>
              ))}
            </>
          )}

          <motion.div
            initial={{ scale: 0.7, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            transition={popSpring}
            className="panel panel-glow relative mx-4 flex max-w-sm flex-col items-center p-8 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <ChestArt open={phase !== "closed"} />
            {phase === "closed" && (
              <p className="text-display mt-4 text-lg font-bold text-[var(--text-dim)]">
                A mystery chest appears...
              </p>
            )}
            {phase !== "closed" && reward && (
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
                <h2 className="text-display text-glow text-2xl font-black text-[var(--gold)]">
                  {reward.kind === "jackpot" ? "JACKPOT!" : "Treasure!"}
                </h2>
                <p className="text-display mt-1 text-3xl font-black text-[var(--accent-2)]">
                  +{reward.bonus} {reward.kind === "xp" ? "XP" : "Coins"}
                </p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]">
                  {KIND_LABEL[reward.kind] ?? "Reward"}
                </p>
              </motion.div>
            )}
            {phase === "done" && error && (
              <p className="mt-4 text-sm font-bold text-[var(--text-dim)]">{error}</p>
            )}
            {phase === "done" && (
              <GameButton className="mt-5" onClick={onClose}>
                {error ? "Aw, okay" : "Claim it!"}
              </GameButton>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ChestArt({ open }: { open: boolean }) {
  return (
    <div className={open ? "" : "animate-[chest-shake_0.9s_ease-in-out_infinite]"}>
      <svg width="120" height="104" viewBox="0 0 120 104">
        <defs>
          <linearGradient id="mc-wood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a86b32" />
            <stop offset="100%" stopColor="#6e3f16" />
          </linearGradient>
          <linearGradient id="mc-lid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c58343" />
            <stop offset="100%" stopColor="#8a531f" />
          </linearGradient>
          <radialGradient id="mc-light" cx="50%" cy="100%" r="80%">
            <stop offset="0%" stopColor="rgba(255,230,140,0.95)" />
            <stop offset="100%" stopColor="rgba(255,230,140,0)" />
          </radialGradient>
        </defs>
        {open && <ellipse cx="60" cy="52" rx="48" ry="32" fill="url(#mc-light)" />}
        <rect x="18" y="52" width="84" height="42" rx="6" fill="url(#mc-wood)" />
        <rect x="18" y="52" width="84" height="8" fill="rgba(0,0,0,0.25)" />
        <g
          style={{
            transform: open ? "rotate(-40deg)" : "rotate(0deg)",
            transformOrigin: "18px 52px",
            transition: "transform 0.55s cubic-bezier(0.34, 1.4, 0.64, 1)",
          }}
        >
          <path d="M18 52 Q18 24 60 24 Q102 24 102 52 Z" fill="url(#mc-lid)" />
          <rect x="54" y="24" width="12" height="28" rx="3" fill="#ffd76a" opacity="0.9" />
        </g>
        <rect x="52" y="50" width="16" height="18" rx="4" fill="#ffd76a" />
        <circle cx="60" cy="59" r="3.4" fill="#8a531f" />
        <rect x="18" y="70" width="84" height="6" fill="#ffd76a" opacity="0.85" />
      </svg>
    </div>
  );
}
