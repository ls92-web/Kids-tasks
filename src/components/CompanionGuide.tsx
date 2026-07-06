"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useWorld } from "./ThemeProvider";
import { Companion } from "./Companion";
import { PETS, levelFromXp } from "@/lib/game";

/* The quest-board guide: the child's chosen companion (real art, level-driven)
   floating beside a speech bubble with personalized encouragement. */
export function CompanionGuide({ messages }: { messages: string[] }) {
  const { profile } = useWorld();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    setShown(0);
    if (messages.length < 2) return;
    const t = setTimeout(() => setShown(1), 4200);
    return () => clearTimeout(t);
  }, [messages]);

  if (!profile || messages.length === 0) return null;
  const petMeta = PETS.find((p) => p.id === profile.pet) ?? PETS[0];
  const level = levelFromXp(profile.xp).level;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, type: "spring", stiffness: 120, damping: 16 }}
      className="flex items-end gap-3"
    >
      <div className="shrink-0 text-center">
        <Companion species={profile.pet} level={level} size={82} />
        <p className="text-display -mt-1 text-[10px] font-bold text-[var(--accent-2)]">
          {petMeta.name}
        </p>
      </div>
      <motion.div
        key={shown}
        initial={{ opacity: 0, scale: 0.92, x: -8 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="panel relative mb-6 max-w-md px-4 py-3"
        style={{ borderBottomLeftRadius: 4 }}
      >
        <p className="text-sm font-semibold leading-snug">{messages[shown]}</p>
        {messages.length > 1 && (
          <div className="mt-2 flex gap-1">
            {messages.map((_, i) => (
              <button
                key={i}
                onClick={() => setShown(i)}
                className={`h-1.5 cursor-pointer rounded-full transition-all ${
                  i === shown ? "w-4 bg-[var(--accent)]" : "w-1.5 bg-white/20"
                }`}
                aria-label={`message ${i + 1}`}
              />
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
