"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useWorld } from "./ThemeProvider";
import { Companion } from "./Companion";
import { GameButton } from "./GameButton";
import { Icon } from "./Icon";
import { sfx } from "@/lib/sound";
import { sayFromCompanion } from "@/lib/companion";
import { PETS, THEMES, ThemeId } from "@/lib/game";
import { WORLD_MAPS, SHARED_WORLDS, nextChapter } from "@/lib/worlds";
import { getCampaign } from "@/lib/campaign";
import { popSpring } from "@/lib/motion";

/* Closing a campaign world is a milestone, not a number ticking over. When a
   shared world's final trial is cleared, this cinematic plays once per world
   PER CAMPAIGN (localStorage keyed by the bond): the trial conquered, a
   companion awakened, the next world opened. After the third shared world it
   teases the companion's exclusive finale world — completing THAT is the
   Legend Ceremony's job.

   Shown from the quest board — the first place the child lands after the
   parent approves the trial quest. */

const seenKey = (bondId: string, theme: ThemeId) => `qf_chapter_${bondId}_${theme}`;

export function ChapterComplete() {
  const { profile, setProfile, companion } = useWorld();
  const [celebrating, setCelebrating] = useState<ThemeId | null>(null);
  const [busy, setBusy] = useState(false);

  const cs = profile ? getCampaign(profile, companion) : null;

  useEffect(() => {
    if (!profile || !companion || !cs) return;
    // the newest completed shared world this campaign hasn't celebrated yet
    for (let i = 0; i < SHARED_WORLDS.length; i++) {
      const t = SHARED_WORLDS[i];
      if (cs.worlds[i]?.state === "completed" && !localStorage.getItem(seenKey(companion.id, t))) {
        setCelebrating(t);
        sfx.levelUp();
        break;
      }
    }
  }, [profile, companion, cs]);

  if (!profile || !companion || !celebrating) return null;

  const world = WORLD_MAPS[celebrating];
  const worldNo = SHARED_WORLDS.indexOf(celebrating) + 1;
  const next = nextChapter(celebrating);
  const finaleWorld = cs?.finaleWorld ?? null;
  const activeMeta = PETS.find((p) => p.id === companion.species);
  const rewardPet = PETS.find((p) => p.id === world.reward.companion);

  function dismiss() {
    localStorage.setItem(seenKey(companion!.id, celebrating!), "1");
    setCelebrating(null);
  }

  async function beginNext() {
    if (!next || !profile) return;
    setBusy(true);
    const supabase = createClient();
    await supabase.from("profiles").update({ theme: next }).eq("id", profile.id);
    localStorage.setItem(seenKey(companion!.id, celebrating!), "1");
    setProfile({ ...profile, theme: next });
    sfx.whoosh();
    setCelebrating(null);
    setBusy(false);
    // the companion greets the new world once the overlay clears
    setTimeout(() => sayFromCompanion("worldUnlocked"), 900);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`World ${worldNo} conquered`}
      className="fixed inset-0 z-[85] grid place-items-center overflow-hidden bg-black/85 p-4 backdrop-blur-sm"
    >
      {/* golden confetti — a completed world deserves it */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 26 }).map((_, i) => (
          <span
            key={i}
            className="absolute block h-2.5 w-1.5 rounded-sm"
            style={{
              left: `${(i * 41) % 100}%`,
              top: "-3%",
              background: [world.accent, "#ffd76a", "#fff"][i % 3],
              animation: `confetti-fall ${2.8 + (i % 5) * 0.5}s linear ${(i % 6) * 0.35}s both`,
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={popSpring}
        className="panel panel-glow relative w-full max-w-md p-7 text-center"
      >
        <p className="text-display text-xs font-black uppercase tracking-[0.3em] text-[var(--gold)]">
          World {worldNo} conquered!
        </p>
        <h2
          className="text-display text-glow mt-1 text-3xl font-black"
          style={{ color: world.accent }}
        >
          {world.name}
        </h2>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-sm font-bold text-[var(--text)]">
          <Icon art name={world.finale.icon} size={15} filled className="text-[var(--gold)]" />
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
              They&apos;re waiting in your Hero Hall for a future campaign.
            </p>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {next ? (
            <>
              <GameButton onClick={beginNext} disabled={busy} className="w-full text-lg">
                Begin World {worldNo + 1}: {THEMES[next].name}
              </GameButton>
              <GameButton variant="ghost" onClick={dismiss} className="w-full text-sm">
                Stay in {world.name} a little longer
              </GameButton>
            </>
          ) : (
            <>
              {/* all shared worlds done — the companion's own finale world begins */}
              <p className="text-sm font-bold" style={{ color: finaleWorld?.accent ?? "var(--gold)" }}>
                {finaleWorld && activeMeta
                  ? `The shared worlds are behind you. Ahead lies ${finaleWorld.name} — ${activeMeta.name}'s own world, and the end of your campaign together.`
                  : "The shared worlds are behind you — the campaign finale awaits."}
              </p>
              <GameButton onClick={dismiss} className="w-full text-lg">
                {finaleWorld ? `Onward to ${finaleWorld.name}` : "Our journey continues!"}
              </GameButton>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
