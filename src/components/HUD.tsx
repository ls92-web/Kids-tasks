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
    <div data-tour="hud" className="panel relative z-20 mx-auto mt-4 flex w-[min(96%,900px)] items-center gap-3 px-4 py-3">
      <Link
        href="/app/character"
        onClick={() => sfx.click()}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <Portrait species={profile.pet} size={52} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-display truncate text-base font-bold">{profile.nickname}</span>
            <span className="text-display hidden shrink-0 text-xs font-semibold text-[var(--accent-2)] min-[440px]:inline">
              {rankName(theme.id, level)}
            </span>
          </div>
          <XPBar xp={profile.xp} compact />
        </div>
      </Link>

      <div className="flex shrink-0 items-center gap-2">
        <XpStat xp={profile.xp} />
        <CoinStat coins={profile.coins} />
        <Link
          href="/app/settings"
          onClick={() => sfx.click()}
          className="group grid h-10 w-10 place-items-center rounded-xl bg-black/25 text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
          aria-label="Your Realm"
        >
          <span className="transition-transform duration-300 group-hover:rotate-90">
            <Icon name="gear" size={22} art />
          </span>
        </Link>
      </div>
    </div>
  );
}

/* Total XP beside the coins — same treatment: crystal icon that pops and
   glows when the number grows, value slides in. */
export function XpStat({ xp }: { xp: number }) {
  const prev = useRef(xp);
  const [gained, setGained] = useState(false);

  useEffect(() => {
    if (xp > prev.current) {
      setGained(true);
      const t = setTimeout(() => setGained(false), 600);
      prev.current = xp;
      return () => clearTimeout(t);
    }
    prev.current = xp;
  }, [xp]);

  return (
    <div className="flex items-center gap-1.5 rounded-xl bg-black/25 px-3 py-1.5">
      <motion.span
        animate={gained ? { scale: [1, 1.4, 1], rotate: [0, -12, 12, 0] } : {}}
        transition={{ duration: 0.5 }}
        className="grid h-6 w-6 shrink-0 place-items-center"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ui/icons/xp.png"
          alt="XP"
          className="h-full w-full object-contain"
          style={{ filter: gained ? "drop-shadow(0 0 8px rgba(143,208,255,0.95))" : undefined }}
        />
      </motion.span>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={xp}
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 12, opacity: 0 }}
          className="text-display text-sm font-bold tabular-nums text-[var(--accent-2)]"
        >
          {xp}
        </motion.span>
      </AnimatePresence>
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
        className="relative grid h-6 w-6 shrink-0 place-items-center"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ui/icons/coin.png"
          alt=""
          className="h-full w-full object-contain"
          style={{ filter: gained ? "drop-shadow(0 0 8px rgba(255,215,106,0.95))" : undefined }}
        />
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
          className="text-display text-sm font-bold tabular-nums text-[var(--gold)]"
        >
          {coins}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
