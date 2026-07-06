"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Companion } from "./Companion";
import { GameButton } from "./GameButton";
import { sfx } from "@/lib/sound";
import {
  PETS,
  ELEMENTS,
  CompanionBond,
  Profile,
  COMPANION_UNLOCKS,
  speciesUnlocked,
  unlockHint,
  petElement,
} from "@/lib/game";
import { worldsCompleted } from "@/lib/worlds";

/* The Legend Ceremony — the biggest emotional moment in the app.
   glow → burst of magic → the Legend revealed → celebration → and only
   then may a new companion join the hero.

   Stages auto-advance; the child only taps to continue after the reveal. */

type Stage = "glow" | "burst" | "legend" | "choose";

export function LegendCeremony({
  profile,
  companion,
  bonds,
  onComplete,
}: {
  profile: Profile;
  companion: CompanionBond;
  bonds: CompanionBond[];
  onComplete: (newBond: CompanionBond | null) => void;
}) {
  const [stage, setStage] = useState<Stage>("glow");
  const [busy, setBusy] = useState(false);
  const petMeta = PETS.find((p) => p.id === companion.species) ?? PETS[0];
  const el = petElement(companion.species);

  useEffect(() => {
    const t1 = setTimeout(() => setStage("burst"), 2400);
    const t2 = setTimeout(() => {
      setStage("legend");
      sfx.levelUp();
    }, 3800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const bondedSpecies = new Set(bonds.map((b) => b.species));
  const done = worldsCompleted(profile.tasks_completed);
  const pickable = PETS.filter(
    (p) => !bondedSpecies.has(p.id) && speciesUnlocked(p.id, profile, done)
  );
  const stillLocked = PETS.filter(
    (p) => !bondedSpecies.has(p.id) && !speciesUnlocked(p.id, profile, done)
  );

  async function choose(species: string) {
    setBusy(true);
    const supabase = createClient();
    // seal the legend, then bond the new partner
    await supabase.rpc("complete_legend");
    const { error } = await supabase.rpc("bond_companion", { p_species: species });
    if (error) {
      setBusy(false);
      return;
    }
    sfx.complete();
    const { data: bond } = await supabase
      .from("companions")
      .select("*")
      .eq("child_id", profile.id)
      .eq("status", "active")
      .maybeSingle();
    onComplete((bond as CompanionBond) ?? null);
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center overflow-hidden bg-black/85 p-4 backdrop-blur-sm">
      {/* swelling aura behind everything */}
      <motion.div
        className="pointer-events-none absolute h-[70vmin] w-[70vmin] rounded-full"
        style={{ background: `radial-gradient(circle, ${el.color}66, transparent 65%)` }}
        animate={{
          scale: stage === "glow" ? [1, 1.25, 1.1, 1.4] : stage === "burst" ? 2.6 : 1.6,
          opacity: stage === "legend" ? 0.5 : 0.9,
        }}
        transition={{ duration: stage === "glow" ? 2.4 : 0.9, ease: "easeInOut" }}
      />

      {/* burst flash */}
      <AnimatePresence>
        {stage === "burst" && (
          <motion.div
            className="pointer-events-none absolute inset-0"
            style={{ background: `radial-gradient(circle, #fff, ${el.color}88 45%, transparent 75%)` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.4, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, times: [0, 0.25, 0.5, 0.7, 1] }}
          />
        )}
      </AnimatePresence>

      {/* confetti once the Legend is revealed */}
      {(stage === "legend" || stage === "choose") && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 28 }).map((_, i) => (
            <span
              key={i}
              className="absolute block h-2.5 w-1.5 rounded-sm"
              style={{
                left: `${(i * 37) % 100}%`,
                top: "-3%",
                background: [el.color, "#ffd76a", "#fff", "var(--accent)"][i % 4],
                animation: `confetti-fall ${2.6 + (i % 5) * 0.5}s linear ${(i % 7) * 0.3}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      <div className="relative z-10 w-full max-w-lg text-center">
        <AnimatePresence mode="wait">
          {(stage === "glow" || stage === "burst") && (
            <motion.div
              key="rising"
              exit={{ opacity: 0, scale: 1.15 }}
              className="flex flex-col items-center gap-5"
            >
              <motion.div
                animate={{ scale: stage === "burst" ? [1, 1.12, 0.9, 1.2] : [1, 1.05, 1] }}
                transition={
                  stage === "burst"
                    ? { duration: 1.2 }
                    : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
                }
              >
                <Companion species={companion.species} level={99} size={190} float={false} />
              </motion.div>
              <motion.p
                className="text-display text-xl font-black text-white"
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.6, repeat: Infinity }}
              >
                Something is happening to {petMeta.name}...
              </motion.p>
            </motion.div>
          )}

          {stage === "legend" && (
            <motion.div
              key="legend"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 160, damping: 14 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="animate-floaty">
                <Companion species={companion.species} level={100} size={230} float={false} />
              </div>
              <h2
                className="text-display text-3xl font-black text-white"
                style={{ textShadow: `0 0 30px ${el.color}` }}
              >
                Your companion has become Legendary.
              </h2>
              <p className="text-sm font-semibold text-white/70">
                {petMeta.name} the {petMeta.species} completed the whole journey with you —
                they will live in your Hero Hall forever.
              </p>
              <GameButton onClick={() => setStage("choose")} className="mt-2 text-lg">
                Continue
              </GameButton>
            </motion.div>
          )}

          {stage === "choose" && (
            <motion.div
              key="choose"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              className="panel panel-glow flex flex-col gap-4 p-6"
            >
              <h2 className="text-display text-xl font-black">Choose your next companion</h2>
              {pickable.length === 0 ? (
                <>
                  <p className="text-sm text-[var(--text-dim)]">
                    No new companions have awakened yet — keep adventuring to wake one, then
                    return to the Hero Hall.
                  </p>
                  <GameButton
                    onClick={async () => {
                      setBusy(true);
                      await createClient().rpc("complete_legend");
                      onComplete(null);
                    }}
                    disabled={busy}
                  >
                    To the Hero Hall
                  </GameButton>
                </>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {pickable.map((p) => (
                    <motion.button
                      key={p.id}
                      whileHover={{ y: -4 }}
                      whileTap={{ scale: 0.93 }}
                      disabled={busy}
                      onClick={() => choose(p.id)}
                      className="flex cursor-pointer flex-col items-center rounded-2xl bg-black/25 p-3 hover:ring-2 hover:ring-[var(--accent)]"
                    >
                      <Companion species={p.id} level={1} size={64} float={false} />
                      <span className="text-display mt-1 text-xs font-black">{p.name}</span>
                      <span
                        className="text-[9px] font-bold"
                        style={{ color: ELEMENTS[p.element].color }}
                      >
                        {ELEMENTS[p.element].label}
                      </span>
                    </motion.button>
                  ))}
                  {stillLocked.slice(0, 4).map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-col items-center rounded-2xl bg-black/40 p-3 opacity-50"
                      title={unlockHint(COMPANION_UNLOCKS[p.id])}
                    >
                      <div className="grayscale">
                        <Companion species={p.id} level={1} size={64} float={false} />
                      </div>
                      <span className="text-[9px] font-bold text-[var(--text-dim)]">
                        {unlockHint(COMPANION_UNLOCKS[p.id])}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
