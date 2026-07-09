"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useWorld } from "@/components/ThemeProvider";
import { Companion } from "@/components/Companion";
import { Portrait } from "@/components/Portrait";
import { WorldThumbnail } from "@/components/WorldThumbnail";
import { Icon } from "@/components/Icon";
import { sfx } from "@/lib/sound";
import { PETS } from "@/lib/game";
import { getCampaign, CampaignWorldState } from "@/lib/campaign";
import { enter } from "@/lib/motion";

/* The Companion Campaign screen — the story of this partnership at a glance.
   The active companion up top, then the four worlds of their campaign:
   three shared worlds and, at the end, the world that belongs to THEM.
   All state comes from the campaign engine (src/lib/campaign.ts). */

export default function CampaignPage() {
  const router = useRouter();
  const { profile, companion } = useWorld();

  if (!profile) return null;
  const cs = getCampaign(profile, companion);

  // card copy per world: shared worlds award a companion, the finale a Legend
  const cards = cs.worlds.map((w) => {
    const rewardPet = w.isFinale ? null : PETS.find((p) => p.id === w.world.reward.companion);
    return {
      ...w,
      reward: w.isFinale
        ? `${cs.companion.name} becomes Legendary`
        : rewardPet
          ? `${rewardPet.name} awakens`
          : w.world.reward.blurb,
      rewardSpecies: rewardPet?.id ?? null,
    };
  });

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
      <motion.div {...enter} className="panel panel-glow relative overflow-hidden p-6 text-center">
        <div className="relative mx-auto w-fit">
          <Companion species={cs.species} level={cs.level} size={150} />
        </div>
        <h1 className="text-display mt-2 text-3xl font-black">
          {cs.companion.name}&apos;s Adventure
        </h1>
        <p className="mt-1 text-sm font-semibold text-[var(--text-dim)]">
          {cs.campaignCompleted
            ? "Our adventure is complete — a true Legend!"
            : `Four worlds together — ${cs.step} of ${cs.totalSteps} steps walked so far`}
        </p>
      </motion.div>

      {/* the four worlds of this campaign */}
      <div className="flex flex-col gap-4">
        {cards.map((card, i) => (
          <ChapterCard
            key={card.world.id}
            card={card}
            species={cs.species}
            petName={cs.companion.name}
            delay={0.08 * i}
          />
        ))}
      </div>
    </div>
  );
}

function ChapterCard({
  card,
  species,
  petName,
  delay,
}: {
  card: CampaignWorldState & { reward: string; rewardSpecies: string | null };
  species: string;
  petName: string;
  delay: number;
}) {
  const gold = "#ffd76a";
  const { state, nodesDone: done, pct, isFinale } = card;
  const { name, accent, map, finale: trial } = card.world;
  const total = card.world.levels.length;
  const locked = state === "locked";

  return (
    <motion.div
      initial={enter.initial}
      animate={enter.animate}
      transition={{ ...enter.transition, delay }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      className="panel relative overflow-hidden"
      style={
        state === "active"
          ? { boxShadow: `0 0 0 1.5px ${accent}66, 0 0 26px -10px ${accent}` }
          : isFinale && !locked
            ? { boxShadow: `0 0 0 1.5px ${gold}66, 0 0 26px -10px ${gold}` }
            : {}
      }
    >
      {/* tap anywhere on the card to open the world */}
      <Link
        href={`/app/world/${card.world.id}`}
        onClick={() => sfx.click()}
        className="absolute inset-0 z-10"
        aria-label={`Open ${name}`}
      />
      <div className="flex items-stretch">
        <WorldThumbnail
          map={map}
          name={name}
          accent={accent}
          icon={trial.icon}
          locked={locked}
          index={card.index + 1}
          className="w-32 shrink-0 sm:w-44"
        />

        {/* world story */}
        <div className="min-w-0 flex-1 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className={`text-display text-base font-black ${locked ? "text-[var(--text-dim)]" : ""}`}
              style={!locked ? { color: isFinale ? accent : undefined } : undefined}
            >
              {name}
            </h2>
            <span
              className="text-display rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider"
              style={{
                color:
                  state === "completed"
                    ? "var(--success)"
                    : state === "active"
                      ? accent
                      : "var(--text-dim)",
                background: "rgba(0,0,0,0.35)",
              }}
            >
              {state === "completed" ? "Conquered!" : state === "active" ? "Exploring" : "Locked"}
            </span>
          </div>

          {isFinale && (
            <div
              className="mt-0.5 flex items-center gap-1.5 text-[11px] font-bold"
              style={{ color: locked ? "var(--text-dim)" : gold }}
            >
              <Portrait species={species} size={16} />
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
                  background: `linear-gradient(90deg, ${accent}88, ${accent})`,
                  boxShadow: pct > 0 ? `0 0 8px ${accent}88` : "none",
                }}
              />
            </div>
            <span className="text-display shrink-0 text-[11px] font-black text-[var(--text-dim)]">
              {pct}% — {done}/{total}
            </span>
          </div>

          {/* reward preview */}
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-dim)]">
            {isFinale ? (
              <>
                <Icon art name="trophy" size={13} filled className="shrink-0 text-[var(--gold)]" />
                <span style={{ color: locked ? undefined : gold }}>{card.reward}</span>
              </>
            ) : (
              <>
                <Icon art name="gift" size={13} className="shrink-0 text-[var(--accent-2)]" />
                <span>{card.reward}</span>
                {card.rewardSpecies && (
                  <span className={locked ? "opacity-40 grayscale" : ""}>
                    <Companion species={card.rewardSpecies} level={1} size={24} float={false} />
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
