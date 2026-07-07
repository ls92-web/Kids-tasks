"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Companion } from "./Companion";
import { GameButton } from "./GameButton";
import { Icon } from "./Icon";
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
import { popSpring } from "@/lib/motion";

/* The Legend Ceremony — the emotional climax of a whole adventure.

   darkness falls → the music begins → the companion rises, large, wrapped in
   gathering magic → a burst of light → the LEGEND revealed under confetti →
   the reward → a pedestal unlocked in the Hero Hall → a new companion chosen
   → and a slow fade home into the Hall, where they now stand forever.

   The child should feel one thing: "I finished an adventure."

   REFRESH-SAFE: the Legend (and its coin reward) is sealed server-side the
   moment the child taps Continue after the reveal. Refreshing mid-cinematic
   replays it; refreshing after the seal resumes at the choose step. */

type Stage = "dark" | "glow" | "burst" | "legend" | "reward" | "choose" | "fade";

export function LegendCeremony({
  profile,
  companion,
  bonds,
  initialStage = "glow",
  onComplete,
}: {
  profile: Profile;
  /** The active companion at campaign's end — null when resuming at "choose". */
  companion: CompanionBond | null;
  bonds: CompanionBond[];
  initialStage?: "glow" | "choose";
  onComplete: (newBond: CompanionBond | null) => void;
}) {
  const [stage, setStage] = useState<Stage>(initialStage === "glow" ? "dark" : "choose");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rewardCoins, setRewardCoins] = useState<number | null>(null);
  const petMeta = PETS.find((p) => p.id === companion?.species) ?? PETS[0];
  const el = petElement(companion?.species ?? profile.pet);

  // Freeze the world: nothing scrolls, nothing behind is reachable
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // the cinematic beats: darkness → music → magic → burst → the Legend
  useEffect(() => {
    if (initialStage !== "glow") return;
    const t0 = setTimeout(() => {
      setStage("glow");
      sfx.ceremony(); // the music begins as the magic gathers
    }, 1100);
    const t1 = setTimeout(() => {
      setStage("burst");
      sfx.whoosh();
    }, 4300);
    const t2 = setTimeout(() => {
      setStage("legend");
      sfx.levelUp();
    }, 5700);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [initialStage]);

  const bondedSpecies = new Set(bonds.map((b) => b.species));
  const done = worldsCompleted(profile.tasks_completed);
  const pickable = PETS.filter(
    (p) => !bondedSpecies.has(p.id) && speciesUnlocked(p.id, profile, done)
  );
  const stillLocked = PETS.filter(
    (p) => !bondedSpecies.has(p.id) && !speciesUnlocked(p.id, profile, done)
  );

  // Seal the Legend NOW — server-side, idempotent, and it grants the reward.
  async function sealLegend() {
    if (busy) return;
    setBusy(true);
    const { data } = await createClient().rpc("complete_legend");
    setBusy(false);
    const reward = (data as { reward?: number } | null)?.reward;
    if (reward) {
      setRewardCoins(reward);
      sfx.chest();
      setStage("reward");
    } else {
      // already sealed (refresh race) — no double reward, straight to choosing
      setStage("choose");
    }
  }

  // The slow fade home: the Hall opens where the new Legend now stands.
  function fadeHome(newBond: CompanionBond | null) {
    localStorage.setItem("qf_scroll_hall", "1");
    setStage("fade");
    setTimeout(() => onComplete(newBond), 900);
  }

  // Choose the successor — a new companion, a new campaign.
  async function choose(species: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.rpc("bond_companion", { p_species: species });
    if (err) {
      setError("That companion isn't ready yet — try another.");
      setBusy(false);
      return;
    }
    sfx.complete();
    // the new partner introduces itself on the next quest-board visit
    localStorage.setItem("qf_say_legendary", "1");
    const { data: bond } = await supabase
      .from("companions")
      .select("*")
      .eq("child_id", profile.id)
      .eq("status", "active")
      .maybeSingle();
    fadeHome((bond as CompanionBond) ?? null);
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center overflow-hidden bg-black/95 p-4">
      {/* the darkness itself — deepens on entry, returns for the fade home */}
      <motion.div
        className="pointer-events-none absolute inset-0 bg-black"
        initial={{ opacity: initialStage === "glow" ? 0 : 0.4 }}
        animate={{ opacity: stage === "dark" ? 1 : stage === "fade" ? 1 : 0.35 }}
        transition={{ duration: stage === "fade" ? 0.8 : 1.0, ease: "easeInOut" }}
        style={{ zIndex: stage === "fade" ? 50 : 0 }}
      />

      {/* swelling aura behind everything */}
      {stage !== "dark" && stage !== "fade" && (
        <motion.div
          className="pointer-events-none absolute h-[75vmin] w-[75vmin] rounded-full"
          style={{ background: `radial-gradient(circle, ${el.color}66, transparent 65%)` }}
          animate={{
            scale: stage === "glow" ? [1, 1.25, 1.12, 1.45] : stage === "burst" ? 2.8 : 1.6,
            opacity: stage === "choose" || stage === "reward" ? 0.25 : stage === "legend" ? 0.5 : 0.9,
          }}
          transition={{ duration: stage === "glow" ? 2.9 : 0.9, ease: "easeInOut" }}
        />
      )}

      {/* gentle rising magic while it gathers */}
      {(stage === "glow" || stage === "burst") && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 16 }).map((_, i) => (
            <motion.span
              key={i}
              className="absolute block h-1.5 w-1.5 rounded-full"
              style={{
                left: `${16 + ((i * 53) % 68)}%`,
                bottom: "-2%",
                background: i % 3 === 0 ? "#fff" : el.color,
                boxShadow: `0 0 8px ${el.color}`,
              }}
              animate={{ y: [0, -560], opacity: [0, 1, 0] }}
              transition={{
                duration: 2.6 + (i % 4) * 0.5,
                delay: (i % 7) * 0.3,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
          ))}
        </div>
      )}

      {/* burst of light */}
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

      {/* confetti from the reveal onward */}
      {(stage === "legend" || stage === "reward" || stage === "choose") && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 28 }).map((_, i) => (
            <span
              key={i}
              className="absolute block h-2.5 w-1.5 rounded-sm"
              style={{
                left: `${(i * 37) % 100}%`,
                top: "-3%",
                background: [el.color, "#ffd76a", "#fff", "var(--accent)"][i % 4],
                animation: `confetti-fall ${2.6 + (i % 5) * 0.5}s linear ${(i % 7) * 0.3}s both`,
              }}
            />
          ))}
        </div>
      )}

      <div className="relative z-10 w-full max-w-lg text-center">
        <AnimatePresence mode="wait">
          {(stage === "glow" || stage === "burst") && companion && (
            <motion.div
              key="rising"
              initial={{ opacity: 0, scale: 0.7, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.15 }}
              transition={{ duration: 1.1, ease: "easeOut" }}
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
                <Companion species={companion.species} level={99} size={230} float={false} />
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

          {stage === "legend" && companion && (
            <motion.div
              key="legend"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={popSpring}
              className="flex flex-col items-center gap-4"
            >
              <div className="animate-floaty">
                <Companion species={companion.species} level={100} size={260} float={false} />
              </div>
              <h2
                className="text-display text-3xl font-black text-white"
                style={{ textShadow: `0 0 30px ${el.color}` }}
              >
                Your companion has become Legendary.
              </h2>
              <p className="text-sm font-semibold text-white/70">
                {petMeta.name} the {petMeta.species} completed the whole journey with you —
                every world, every quest, together.
              </p>
              <GameButton onClick={sealLegend} disabled={busy} className="mt-2 text-lg">
                {busy ? "Sealing the legend..." : "Continue"}
              </GameButton>
            </motion.div>
          )}

          {stage === "reward" && (
            <motion.div
              key="reward"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="panel panel-glow flex flex-col items-center gap-4 p-7"
              style={{ boxShadow: "0 0 0 2px #ffb45e88, 0 0 40px -8px #ffb45e" }}
            >
              <p className="text-display text-xs font-black uppercase tracking-[0.3em] text-[var(--gold)]">
                Adventure complete
              </p>
              {/* the reward */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ ...popSpring, delay: 0.2 }}
                className="text-display flex items-center gap-2 rounded-2xl bg-black/35 px-6 py-3 text-2xl font-black text-[var(--gold)]"
              >
                <Icon name="coin" size={26} filled /> +{rewardCoins ?? 250}
              </motion.div>
              <p className="text-sm font-bold text-[var(--text)]">
                A hero&apos;s treasure — for finishing a whole adventure.
              </p>
              {/* the Hero Hall unlock */}
              <div className="flex items-center gap-2.5 rounded-xl bg-black/25 px-4 py-2.5">
                <Icon name="trophy" size={18} filled className="shrink-0 text-[var(--gold)]" />
                <p className="text-left text-xs font-bold text-[var(--text-dim)]">
                  A new pedestal stands in your{" "}
                  <span className="text-[var(--gold)]">Hero Hall</span> — {petMeta.name} will be
                  there forever.
                </p>
              </div>
              <GameButton onClick={() => setStage("choose")} className="w-full text-lg">
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
                    No new companions have awakened yet — keep adventuring to wake one. They&apos;ll
                    be waiting in your Hero Hall.
                  </p>
                  <GameButton onClick={() => fadeHome(null)}>To the Hero Hall</GameButton>
                </>
              ) : (
                <>
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
                        <Companion species={p.id} level={1} size={64} float={false} interactive />
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
                  {error && (
                    <p className="text-center text-sm font-bold text-[var(--danger)]">{error}</p>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
