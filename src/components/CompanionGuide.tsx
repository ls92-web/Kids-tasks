"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useWorld } from "./ThemeProvider";
import { Companion } from "./Companion";
import { PETS, companionLevel } from "@/lib/game";
import { COMPANION_SAY_EVENT, CompanionEvent, companionLine } from "@/lib/companion";

/* The quest-board guide: the child's bonded companion (real art, its own
   level) floating beside a speech bubble with personalized encouragement.
   Instant event reactions (quest done, level up, evolution...) take over
   the bubble for a few seconds, then the daily rotation resumes. */
export function CompanionGuide({ messages }: { messages: string[] }) {
  const { profile, companion } = useWorld();
  const [shown, setShown] = useState(0);
  const [eventLine, setEventLine] = useState<string | null>(null);
  const eventTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setShown(0);
    if (messages.length < 2) return;
    const t = setTimeout(() => setShown(1), 4200);
    return () => clearTimeout(t);
  }, [messages]);

  // moment reactions: sayFromCompanion(event) anywhere → the bubble responds
  // in THIS companion's own voice
  useEffect(() => {
    if (!profile) return;
    function onSay(e: Event) {
      const ev = (e as CustomEvent<{ event: CompanionEvent }>).detail?.event;
      if (!ev || !profile) return;
      setEventLine(companionLine(ev, profile.pet, profile.nickname));
      if (eventTimer.current) clearTimeout(eventTimer.current);
      eventTimer.current = setTimeout(() => setEventLine(null), 6000);
    }
    window.addEventListener(COMPANION_SAY_EVENT, onSay);
    return () => {
      window.removeEventListener(COMPANION_SAY_EVENT, onSay);
      if (eventTimer.current) clearTimeout(eventTimer.current);
    };
  }, [profile]);

  if (!profile || messages.length === 0) return null;
  const petMeta = PETS.find((p) => p.id === profile.pet) ?? PETS[0];
  const level = companion ? companionLevel(companion.xp) : 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, type: "spring", stiffness: 120, damping: 16 }}
      className="flex items-end gap-3"
    >
      <div className="shrink-0 text-center">
        <Companion species={profile.pet} level={level} size={82} reactive />
        <p className="text-display -mt-1 text-[10px] font-bold text-[var(--accent-2)]">
          {petMeta.name}
        </p>
      </div>
      <motion.div
        key={eventLine ?? shown}
        initial={{ opacity: 0, scale: 0.92, x: -8 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="panel relative mb-6 max-w-md px-4 py-3"
        style={{ borderBottomLeftRadius: 4 }}
      >
        <p className="text-sm font-semibold leading-snug">{eventLine ?? messages[shown]}</p>
        {!eventLine && messages.length > 1 && (
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
