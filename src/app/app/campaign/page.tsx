"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useWorld } from "@/components/ThemeProvider";
import { Companion } from "@/components/Companion";
import { CompanionPortrait } from "@/components/CompanionPortrait";
import { Icon } from "@/components/Icon";
import { sfx } from "@/lib/sound";
import { PETS, ELEMENTS, companionLevel, petElement } from "@/lib/game";
import {
  WORLD_MAPS,
  FINALE_WORLDS,
  SHARED_WORLDS,
  CHAPTER_SPAN,
  campaignStep,
  campaignWorldIndex,
  campaignCompleted,
} from "@/lib/worlds";

/* The Companion Campaign screen — the story of this partnership at a glance.
   The active companion up top, then the four worlds of their campaign:
   three shared worlds and, at the end, the world that belongs to THEM.
   Calm and roomy: one card per world, nothing blinking for attention. */

type CardState = "locked" | "active" | "completed";

export default function CampaignPage() {
  const router = useRouter();
  const { profile, companion } = useWorld();

  if (!profile) return null;
  const petMeta = PETS.find((p) => p.id === profile.pet) ?? PETS[0];
  const el = petElement(profile.pet);
  const step = campaignStep(companion);
  const currentIdx = campaignWorldIndex(step);
  const cLevel = companion ? companionLevel(companion.xp) : 1;
  const finaleWorld = FINALE_WORLDS[profile.pet];

  // one entry per campaign world, shared first, the finale last
  const chapters = [
    ...SHARED_WORLDS.map((t, i) => {
      const w = WORLD_MAPS[t];
      const rewardPet = PETS.find((p) => p.id === w.reward.companion);
      return {
        key: w.id,
        index: i,
        name: w.name,
        accent: w.accent,
        map: w.map as string | null,
        trial: w.finale,
        reward: rewardPet ? `${rewardPet.name} awakens` : w.reward.blurb,
        rewardSpecies: rewardPet?.id ?? null,
        isFinale: false,
      };
    }),
    ...(finaleWorld
      ? [
          {
            key: finaleWorld.id,
            index: 3,
            name: finaleWorld.name,
            accent: finaleWorld.accent,
            map: null as string | null,
            trial: finaleWorld.finale,
            reward: `${petMeta.name} becomes Legendary`,
            rewardSpecies: null as string | null,
            isFinale: true,
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <button
        onClick={() => {
          sfx.click();
          router.back();
        }}
        className="text-display flex w-fit cursor-pointer items-center gap-1.5 text-sm font-bold text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
      >
        <Icon name="arrowLeft" size={16} /> Back
      </button>

      {/* the partnership, front and center */}
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="panel panel-glow relative overflow-hidden p-6 text-center"
      >
        <div
          className="fx-light absolute inset-x-0 top-0 h-44 animate-pulse-glow"
          style={{
            background: `radial-gradient(60% 100% at 50% 0%, ${el.color}22, transparent)`,
          }}
        />
        <div className="relative mx-auto w-fit">
          <Companion species={profile.pet} level={cLevel} size={150} />
        </div>
        <h1 className="text-display text-glow mt-2 text-3xl font-black">
          {petMeta.name}&apos;s Adventure
        </h1>
        <p className="mt-1 text-sm font-semibold text-[var(--text-dim)]">
          {campaignCompleted(step)
            ? "Campaign complete — a true Legend!"
            : `Four worlds together — ${step} of ${CHAPTER_SPAN * chapters.length} steps walked so far`}
        </p>
      </motion.div>

      {/* the four worlds of this campaign */}
      <div className="flex flex-col gap-4">
        {chapters.map((ch, i) => {
          const start = ch.index * CHAPTER_SPAN;
          const done = Math.max(0, Math.min(step - start, CHAPTER_SPAN));
          const pct = Math.round((done / CHAPTER_SPAN) * 100);
          const state: CardState =
            done >= CHAPTER_SPAN ? "completed" : ch.index === currentIdx ? "active" : "locked";
          return (
            <ChapterCard
              key={ch.key}
              chapter={ch}
              state={state}
              done={done}
              pct={pct}
              species={profile.pet}
              petName={petMeta.name}
              delay={0.08 * i}
            />
          );
        })}
      </div>
    </div>
  );
}

function ChapterCard({
  chapter,
  state,
  done,
  pct,
  species,
  petName,
  delay,
}: {
  chapter: {
    index: number;
    name: string;
    accent: string;
    map: string | null;
    trial: { name: string; icon: string };
    reward: string;
    rewardSpecies: string | null;
    isFinale: boolean;
  };
  state: CardState;
  done: number;
  pct: number;
  species: string;
  petName: string;
  delay: number;
}) {
  const gold = "#ffd76a";
  const locked = state === "locked";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="panel relative overflow-hidden"
      style={
        state === "active"
          ? { boxShadow: `0 0 0 1.5px ${chapter.accent}66, 0 0 26px -10px ${chapter.accent}` }
          : chapter.isFinale && !locked
            ? { boxShadow: `0 0 0 1.5px ${gold}66, 0 0 26px -10px ${gold}` }
            : {}
      }
    >
      <div className="flex items-stretch">
        {/* world thumbnail */}
        <div className="relative w-32 shrink-0 overflow-hidden sm:w-44">
          {chapter.map ? (
            <Image
              src={chapter.map}
              alt={chapter.name}
              fill
              sizes="176px"
              className="object-cover"
              style={locked ? { filter: "grayscale(0.85) brightness(0.5)" } : undefined}
            />
          ) : (
            // the finale world has no map yet — it wears its companion's colors
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(150deg, ${chapter.accent}55, ${chapter.accent}11 55%, rgba(0,0,0,0.5)), radial-gradient(80% 80% at 30% 20%, ${chapter.accent}33, transparent)`,
                filter: locked ? "grayscale(0.6) brightness(0.6)" : undefined,
              }}
            >
              <div className="grid h-full w-full place-items-center">
                <span style={{ color: locked ? "rgba(255,255,255,0.35)" : chapter.accent }}>
                  <Icon name={chapter.trial.icon} size={40} filled />
                </span>
              </div>
            </div>
          )}
          {/* world number badge */}
          <span
            className="text-display absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full text-[11px] font-black text-white"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
          >
            {chapter.index + 1}
          </span>
          {locked && (
            <span className="absolute bottom-2 left-2 grid h-6 w-6 place-items-center rounded-full bg-black/55">
              <Icon name="lock" size={12} className="text-white/80" />
            </span>
          )}
        </div>

        {/* world story */}
        <div className="min-w-0 flex-1 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className={`text-display text-base font-black ${locked ? "text-[var(--text-dim)]" : ""}`}
              style={!locked ? { color: chapter.isFinale ? chapter.accent : undefined } : undefined}
            >
              {chapter.name}
            </h2>
            <span
              className="text-display rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
              style={{
                color:
                  state === "completed"
                    ? "var(--success)"
                    : state === "active"
                      ? chapter.accent
                      : "var(--text-dim)",
                background: "rgba(0,0,0,0.35)",
              }}
            >
              {state === "completed" ? "Completed" : state === "active" ? "Exploring" : "Locked"}
            </span>
          </div>

          {chapter.isFinale && (
            <div
              className="mt-0.5 flex items-center gap-1.5 text-[11px] font-bold"
              style={{ color: locked ? "var(--text-dim)" : gold }}
            >
              <CompanionPortrait species={species} size={16} />
              <span>{petName}&apos;s own world — only they can take you here</span>
            </div>
          )}

          {/* progress */}
          <div className="mt-2.5 flex items-center gap-2.5">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/40">
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.8, delay: delay + 0.2 }}
                style={{
                  background: `linear-gradient(90deg, ${chapter.accent}88, ${chapter.accent})`,
                  boxShadow: pct > 0 ? `0 0 8px ${chapter.accent}88` : "none",
                }}
              />
            </div>
            <span className="text-display shrink-0 text-[11px] font-black text-[var(--text-dim)]">
              {pct}% — {done}/{CHAPTER_SPAN}
            </span>
          </div>

          {/* reward preview */}
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-dim)]">
            {chapter.isFinale ? (
              <>
                <Icon name="trophy" size={13} filled className="shrink-0 text-[var(--gold)]" />
                <span style={{ color: locked ? undefined : gold }}>{chapter.reward}</span>
              </>
            ) : (
              <>
                <Icon name="gift" size={13} className="shrink-0 text-[var(--accent-2)]" />
                <span>{chapter.reward}</span>
                {chapter.rewardSpecies && (
                  <span className={locked ? "opacity-40 grayscale" : ""}>
                    <Companion species={chapter.rewardSpecies} level={1} size={24} float={false} />
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
