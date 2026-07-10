"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "./Icon";
import { EASE_OUT } from "@/lib/motion";
import { sfx } from "@/lib/sound";
import { HelpTopic } from "@/lib/tour";

/* Help mode — replay the welcome, or read any topic on its own. Calm
   accordion, one topic open at a time, never a wall of text. Used in the
   child's Settings and the parent console. */
export function HelpPanel({
  topics,
  onReplay,
  replayLabel = "Replay the welcome tour",
  accent = "var(--accent)",
}: {
  topics: HelpTopic[];
  onReplay: () => void;
  replayLabel?: string;
  accent?: string;
}) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={() => {
          sfx.click();
          onReplay();
        }}
        className="text-display flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black text-white transition-[filter] hover:brightness-110"
        style={{ background: `linear-gradient(160deg, ${accent}, var(--accent-deep))` }}
      >
        <Icon art name="sparkle" size={16} /> {replayLabel}
      </button>

      <div className="flex flex-col gap-2">
        {topics.map((t, i) => {
          const isOpen = open === i;
          return (
            <div key={t.title} className="overflow-hidden rounded-xl bg-black/25">
              <button
                onClick={() => {
                  sfx.click();
                  setOpen(isOpen ? null : i);
                }}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3.5 px-4 py-4 text-left"
              >
                <span
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
                  style={{ background: "rgba(0,0,0,0.3)", color: accent }}
                >
                  <Icon art name={t.icon} size={26} />
                </span>
                <span className="text-display flex-1 text-base font-bold">{t.title}</span>
                <motion.span animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.2, ease: EASE_OUT }}>
                  <Icon name="arrowRight" size={18} className="text-[var(--text-dim)]" />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.26, ease: EASE_OUT }}
                  >
                    <p className="px-4 pb-4 text-sm leading-relaxed text-[var(--text-dim)]">
                      {t.body}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
