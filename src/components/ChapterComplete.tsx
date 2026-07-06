"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useWorld } from "./ThemeProvider";
import { Companion } from "./Companion";
import { GameButton } from "./GameButton";
import { Icon } from "./Icon";
import { sfx } from "@/lib/sound";
import { PETS, THEMES, ThemeId } from "@/lib/game";
import { WORLD_MAPS, WORLD_ORDER, worldCompleted, nextChapter } from "@/lib/worlds";

/* Closing a chapter is a milestone, not a number ticking over. When a world's
   final challenge is cleared, this cinematic plays once (per chapter, per
   device): the trial conquered, a companion awakened, the next world opened.

   Shown from the quest board — the first place the child lands after the
   parent approves the finale quest. */

const seenKey = (theme: ThemeId) => `qf_chapter_${theme}`;

export function ChapterComplete() {
  const { profile, setProfile } = useWorld();
  const [celebrating, setCelebrating] = useState<ThemeId | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    // the newest completed chapter this device hasn't celebrated yet
    for (const t of WORLD_ORDER) {
      if (worldCompleted(t, profile.tasks_completed) && !localStorage.getItem(seenKey(t))) {
        setCelebrating(t);
        sfx.levelUp();
        break;
      }
    }
  }, [profile]);

  if (!profile || !celebrating) return null;

  const world = WORLD_MAPS[celebrating];
  const chapterNo = WORLD_ORDER.indexOf(celebrating) + 1;
  const next = nextChapter(celebrating);
  const rewardPet = PETS.find((p) => p.id === world.reward.companion);

  function dismiss() {
    localStorage.setItem(seenKey(celebrating!), "1");
    setCelebrating(null);
  }

  async function beginNext() {
    if (!next || !profile) return;
    setBusy(true);
    const supabase = createClient();
    await supabase.from("profiles").update({ theme: next }).eq("id", profile.id);
    localStorage.setItem(seenKey(celebrating!), "1");
    setProfile({ ...profile, theme: next });
    sfx.whoosh();
    setCelebrating(null);
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-[85] grid place-items-center overflow-hidden bg-black/85 p-4 backdrop-blur-sm">
      {/* golden confetti — a chapter deserves it */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 26 }).map((_, i) => (
          <span
            key={i}
            className="absolute block h-2.5 w-1.5 rounded-sm"
            style={{
              left: `${(i * 41) % 100}%`,
              top: "-3%",
              background: [world.accent, "#ffd76a", "#fff"][i % 3],
              animation: `confetti-fall ${2.8 + (i % 5) * 0.5}s linear ${(i % 6) * 0.35}s infinite`,
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 150, damping: 15 }}
        className="panel panel-glow relative w-full max-w-md p-7 text-center"
      >
        <p className="text-display text-xs font-black uppercase tracking-[0.3em] text-[var(--gold)]">
          Chapter {chapterNo} complete
        </p>
        <h2
          className="text-display text-glow mt-1 text-3xl font-black"
          style={{ color: world.accent }}
        >
          {world.name}
        </h2>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-sm font-bold text-[var(--text)]">
          <Icon name={world.finale.icon} size={15} filled className="text-[var(--gold)]" />
          {world.finale.name} — conquered!
        </p>

        {/* the awakened companion */}
        {rewardPet && (
          <div className="mt-5 rounded-2xl bg-black/25 p-4">
            <div className="mx-auto w-fit animate-floaty">
              <Companion species={rewardPet.id} level={1} size={96} float={false} />
            </div>
            <p className="text-display mt-1 text-sm font-black text-[var(--accent-2)]">
              {world.reward.blurb}!
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-dim)]">
              They&apos;re waiting in your Hero Hall for the day you need a new partner.
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {next ? (
            <>
              <GameButton onClick={beginNext} disabled={busy} className="w-full text-lg">
                Begin Chapter {chapterNo + 1}: {THEMES[next].name}
              </GameButton>
              <GameButton variant="ghost" onClick={dismiss} className="w-full text-sm">
                Stay in {world.name} a little longer
              </GameButton>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-[var(--gold)]">
                Every chapter complete — you are a true Legend of Questforge.
              </p>
              <GameButton onClick={dismiss} className="w-full text-lg">
                Continue the Adventure
              </GameButton>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
