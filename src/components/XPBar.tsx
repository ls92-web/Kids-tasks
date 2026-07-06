"use client";

import { motion } from "framer-motion";
import { levelFromXp } from "@/lib/game";

export function XPBar({ xp, compact = false }: { xp: number; compact?: boolean }) {
  const { level, into, needed, pct } = levelFromXp(xp);
  return (
    <div className="w-full">
      {!compact && (
        <div className="mb-1 flex items-baseline justify-between text-xs font-bold">
          <span className="text-display text-[var(--accent-2)]">LV {level}</span>
          <span className="text-[var(--text-dim)]">
            {into} / {needed} XP
          </span>
        </div>
      )}
      <div className="relative h-3 overflow-hidden rounded-full bg-black/40 [box-shadow:inset_0_2px_4px_rgba(0,0,0,0.6)]">
        <motion.div
          className="relative h-full rounded-full"
          style={{
            background: "linear-gradient(90deg, var(--accent-deep), var(--accent), var(--accent-2))",
            boxShadow: "0 0 12px var(--glow)",
          }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 60, damping: 16 }}
        >
          <div
            className="fx-light absolute inset-0 opacity-60"
            style={{
              background:
                "linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.5) 50%, transparent 70%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 2.4s linear infinite",
            }}
          />
        </motion.div>
      </div>
    </div>
  );
}
