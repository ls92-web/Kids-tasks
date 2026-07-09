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
                  className="absolute h-4 w-4"
                  style={{
                    backgroundImage: "url(/ui/icons/coin.png)",
                    backgroundSize: "contain",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center",
                    filter: "drop-shadow(0 0 8px rgba(255,215,106,0.7))",
                  }}
                />
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
                A mystery chest appears…
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
                  {KIND_LABEL[reward.kind] ?? "Treasure"}
                </p>
              </motion.div>
            )}
            {phase === "done" && error && (
              <p className="mt-4 text-sm font-bold text-[var(--text-dim)]">{error}</p>
            )}
            {phase === "done" && (
              <GameButton className="mt-5" onClick={onClose}>
                {error ? "Aw, okay" : "It\u2019s ours!"}
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
      <div className="relative grid h-28 w-28 place-items-center">
        {/* burst of light when the official chest opens */}
        {open && (
          <div
            className="absolute inset-[-18%] animate-pulse-glow rounded-full"
            style={{ background: "radial-gradient(circle, rgba(255,230,140,0.6), transparent 68%)" }}
          />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ui/icons/chest.png"
          alt=""
          className="relative h-full w-full object-contain transition-transform duration-500"
          style={{
            transform: open ? "scale(1.08)" : "scale(1)",
            filter: open
              ? "drop-shadow(0 0 16px rgba(255,215,106,0.85))"
              : "drop-shadow(0 4px 8px rgba(0,0,0,0.4))",
          }}
        />
      </div>
    </div>
  );
}
