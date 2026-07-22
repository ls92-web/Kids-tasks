"use client";

import { motion } from "framer-motion";
import { levelFromXp } from "@/lib/game";
import { barFill } from "@/lib/motion";

export function XPBar({ xp, compact = false }: { xp: number; compact?: boolean }) {
  const { level, into, needed, pct } = levelFromXp(xp);
  return (
    <div className="w-full">
      {!compact && (
        <div className="mb-1 flex items-baseline justify-between text-xs font-bold">
          <span className="text-display text-[var(--accent-2)]">HERO LV {level}</span>
          <span className="text-[var(--text-dim)]">
            {into} / {needed} XP
          </span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={needed}
        aria-valuenow={into}
        aria-label={`Level ${level} — ${into} of ${needed} XP`}
        className="relative h-3 overflow-hidden rounded-full bg-black/40 [box-shadow:inset_0_2px_4px_rgba(0,0,0,0.6)]"
      >
        <motion.div
          className="h-full rounded-full"
          style={{
            background: "linear-gradient(90deg, var(--accent-deep), var(--accent), var(--accent-2))",
            boxShadow: "0 0 12px var(--glow)",
          }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={barFill}
        />
      </div>
    </div>
  );
}
