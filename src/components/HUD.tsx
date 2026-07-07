"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useWorld } from "./ThemeProvider";
import { Portrait } from "./Portrait";
import { XPBar } from "./XPBar";
import { Icon } from "./Icon";
import { sfx } from "@/lib/sound";
import { levelFromXp, rankName } from "@/lib/game";

/* Persistent top bar: tap your hero to visit your page, glance at coins,
   and reach settings from the gear. Nothing else competes for attention. */
export function HUD() {
  const { profile, theme } = useWorld();
  if (!profile) return null;
  const { level } = levelFromXp(profile.xp);

  return (
    <div className="panel relative z-20 mx-auto mt-4 flex w-[min(96%,900px)] items-center gap-3 px-4 py-3">
      <Link
        href="/app/character"
        onClick={() => sfx.click()}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <Portrait species={profile.pet} size={52} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-display truncate text-base font-bold">{profile.nickname}</span>
            <span className="text-display shrink-0 text-xs font-semibold text-[var(--accent-2)]">
              {rankName(theme.id, level)}
            </span>
          </div>
          <XPBar xp={profile.xp} compact />
        </div>
      </Link>

      <div className="flex shrink-0 items-center gap-2">
        <CoinStat coins={profile.coins} />
        <Link
          href="/app/settings"
          onClick={() => sfx.click()}
          className="group grid h-10 w-10 place-items-center rounded-xl bg-black/25 text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
          aria-label="Settings"
        >
          <span className="transition-transform duration-300 group-hover:rotate-90">
            <Icon name="gear" size={18} />
          </span>
        </Link>
      </div>
    </div>
  );
}

export function CoinStat({ coins }: { coins: number }) {
  const prev = useRef(coins);
  const [gained, setGained] = useState(false);
  const [sparks, setSparks] = useState<number[]>([]);
  const sparkId = useRef(0);

  useEffect(() => {
    if (coins > prev.current) {
      setGained(true);
      const ids = Array.from({ length: 6 }, () => sparkId.current++);
      setSparks((s) => [...s, ...ids]);
      const t1 = setTimeout(() => setGained(false), 600);
      const t2 = setTimeout(() => setSparks((s) => s.filter((x) => !ids.includes(x))), 900);
      prev.current = coins;
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    prev.current = coins;
  }, [coins]);

  return (
    <div className="relative flex items-center gap-1.5 rounded-xl bg-black/25 px-3 py-1.5">
      <motion.span
        animate={gained ? { scale: [1, 1.4, 1], rotate: [0, -12, 12, 0] } : {}}
        transition={{ duration: 0.5 }}
        className="relative grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-black text-[#4d3600]"
        style={{
          background: "radial-gradient(circle at 35% 30%, #fff3c4, var(--gold) 60%, #c99a1f)",
          boxShadow: gained ? "0 0 16px rgba(255,215,106,0.9)" : "0 0 10px rgba(255,215,106,0.5)",
        }}
      >
        C
        {/* sparkle coins bursting from the balance when it grows */}
        {sparks.map((id) => (
          <motion.span
            key={id}
            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            animate={{
              opacity: 0,
              x: (Math.random() - 0.5) * 34,
              y: -18 - Math.random() * 16,
              scale: 0.3,
            }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="pointer-events-none absolute h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--gold)", boxShadow: "0 0 6px var(--gold)" }}
          />
        ))}
      </motion.span>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={coins}
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 12, opacity: 0 }}
          className="text-display text-sm font-bold text-[var(--gold)]"
        >
          {coins}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
