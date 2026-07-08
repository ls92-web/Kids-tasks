"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useWorld } from "@/components/ThemeProvider";
import { Portrait } from "@/components/Portrait";
import { Companion } from "@/components/Companion";
import { XPBar } from "@/components/XPBar";
import { WorldMap } from "@/components/WorldMap";
import { Icon } from "@/components/Icon";
import { petMood, petMoodLabel } from "@/lib/pet";
import { LegendCeremony } from "@/components/LegendCeremony";
import { WorldThumbnail } from "@/components/WorldThumbnail";
import {
  CHARACTER_CLASSES,
  BADGES,
  RARITY,
  PETS,
  ELEMENTS,
  computeCounts,
  levelFromXp,
  petForm,
  petFormProgress,
  petElement,
  companionLevel,
  companionProgress,
  COMPANION_UNLOCKS,
  UnlockRule,
  speciesUnlocked,
  unlockHint,
  CompanionBond,
  Task,
  Profile,
} from "@/lib/game";
import {
  WORLD_MAPS,
  FINALE_WORLDS,
  worldProgress,
  lifetimeWorldsCleared,
  campaignStep,
  campaignCompleted,
} from "@/lib/worlds";
import { getCampaign } from "@/lib/campaign";
import { badgeArt } from "@/lib/assets";
import { enter, stagger, EASE_OUT, overlayFade, popSpring } from "@/lib/motion";
import { useEscape } from "@/lib/a11y";
import { CompanionCoach, useCoachBeat } from "@/components/CompanionCoach";
import { CoachStep } from "@/lib/tour";

interface Ach {
  key: string;
  unlocked_at: string;
}

export default function HeroHub() {
  const { profile, companion, setCompanion } = useWorld();
  const [achievements, setAchievements] = useState<Ach[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [family, setFamily] = useState<Profile[]>([]);
  const [bonds, setBonds] = useState<CompanionBond[]>([]);
  const [hallPick, setHallPick] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    (async () => {
      const [{ data: a }, { data: t }, { data: fam }, { data: b }] = await Promise.all([
        supabase.from("achievements").select("key, unlocked_at").eq("child_id", profile.id),
        supabase.from("tasks").select("*").eq("child_id", profile.id),
        supabase
          .from("profiles")
          .select("id, nickname, avatar, xp, pet")
          .eq("family_id", profile.family_id)
          .eq("role", "child"),
        supabase.from("companions").select("*").eq("child_id", profile.id).order("bonded_at"),
      ]);
      setAchievements((a as Ach[]) ?? []);
      setTasks((t as Task[]) ?? []);
      setFamily((fam as Profile[]) ?? []);
      setBonds((b as CompanionBond[]) ?? []);
    })();
  }, [profile]);

  const counts = useMemo(() => computeCounts(tasks), [tasks]);

  // the ceremony fades home INTO the Hall — land there after the reload
  useEffect(() => {
    if (!profile || !localStorage.getItem("qf_scroll_hall")) return;
    localStorage.removeItem("qf_scroll_hall");
    const t = setTimeout(() => {
      document.getElementById("hero-hall")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 700);
    return () => clearTimeout(t);
  }, [profile]);

  if (!profile) return null;
  const { level } = levelFromXp(profile.xp);
  const cls = CHARACTER_CLASSES.find((c) => c.id === profile.character_class);
  const earned = new Map(achievements.map((a) => [a.key, a.unlocked_at]));
  const earnedCount = BADGES.filter((b) => earned.has(b.key)).length;

  const petMeta = PETS.find((p) => p.id === profile.pet) ?? PETS[0];
  // no active bond + this species completed = a Legend resting in the Hall
  const restingLegend =
    !companion && bonds.some((b) => b.species === profile.pet && b.status === "legend");
  const cLevel = companion ? companionLevel(companion.xp) : restingLegend ? 100 : 1;
  const pForm = petForm(cLevel);
  const pProg = petFormProgress(cLevel);
  const pElement = petElement(profile.pet);
  const pMood = petMood(profile, tasks);
  // the campaign engine: one snapshot drives the journey section + ceremony
  const cs = getCampaign(profile, companion);
  const step = cs.step;
  const world = cs.mapWorld;
  const wProg = worldProgress(world, step);
  const worldNo = cs.currentWorldIndex + 1;
  const finaleWorld = cs.finaleWorld;
  // species unlocks stay keyed to LIFETIME progress (a world cleared in any
  // campaign stays cleared for unlock purposes — mirrors bond_companion SQL)
  const lifetimeCleared = lifetimeWorldsCleared(profile.tasks_completed);
  const legendReady = cs.legendReady;
  // refresh-safe resume: Legend sealed but no successor chosen yet
  const hasPickable = PETS.some(
    (p) => !bonds.some((b) => b.species === p.id) && speciesUnlocked(p.id, profile, lifetimeCleared)
  );
  const resumeChoose = !companion && bonds.length > 0 && hasPickable;

  // first visit to the Hall — the companion, in their own voice (never during
  // a ceremony). Before any campaign is finished they only hint at friends to
  // come; once one is complete they name what the Hall really is.
  const anyLegend = bonds.some((b) => b.status === "legend");
  const hallBeat = useCoachBeat("coach_hall", profile.id, !legendReady && !resumeChoose);
  const hallSteps: CoachStep[] = anyLegend
    ? [{ anchor: "hero-hall", text: "This is where great heroes are remembered." }]
    : [{ anchor: "hero-hall", text: "One day we'll meet new friends here." }];

  // reaching the companion's own final world — a hint, never a spoiler
  const atFinale = cs.currentWorld.isFinale && !cs.campaignCompleted;
  const finaleBeat = useCoachBeat("coach_finale", profile.id, atFinale && !legendReady && !resumeChoose);
  const finaleSteps: CoachStep[] = [
    { anchor: "campaign-journey", text: "I think something amazing is waiting for us here." },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* the biggest moment in the app — full cinematic at level 100, or
          resume straight at the choose step after a refresh */}
      {(legendReady || resumeChoose) && (
        <LegendCeremony
          profile={profile}
          companion={legendReady ? companion : null}
          bonds={bonds}
          initialStage={legendReady ? "glow" : "choose"}
          onComplete={(newBond) => {
            setCompanion(newBond);
            window.location.reload();
          }}
        />
      )}

      {/* hero card — the focal point of this page */}
      <motion.div {...enter} className="panel panel-glow relative overflow-hidden p-6 text-center">
        <div className="relative mx-auto w-fit animate-floaty">
          <Portrait species={profile.pet} size={120} />
        </div>
        <h1 className="text-display mt-3 text-3xl font-black">{profile.nickname}</h1>
        <p className="text-display mt-0.5 text-sm font-bold text-[var(--accent-2)]">
          {cls?.name ?? "Adventurer"} — {cls?.blurb ?? ""}
        </p>
        <div className="mx-auto mt-4 max-w-sm">
          <XPBar xp={profile.xp} />
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <MiniStat label="Quests Won" value={profile.tasks_completed} />
          <MiniStat label="Streak" value={`${profile.streak_days} days`} />
          <MiniStat label="Badges" value={`${earnedCount}/${BADGES.length}`} />
        </div>
      </motion.div>

      {/* pet card */}
      <motion.div
        {...enter}
        transition={{ ...enter.transition, delay: 0.05 }}
        className="panel flex items-center gap-4 p-5"
      >
        <div className="shrink-0">
          <Companion species={profile.pet} level={cLevel} size={104} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-display text-xl font-black">{petMeta.name}</h2>
            <span
              className="text-display rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ color: pElement.color, background: "rgba(0,0,0,0.3)" }}
            >
              {pElement.label}
            </span>
            <span className="text-display rounded-md bg-black/30 px-2 py-0.5 text-[10px] font-black text-[var(--accent-2)]">
              LV {cLevel}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-[var(--text-dim)]">
            {petMeta.species} — <span className="font-bold text-[var(--accent-2)]">{pForm.name} Form</span> — {petMoodLabel(pMood)}
          </p>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/40">
            <div
              className="h-full rounded-full"
              style={{
                width: `${pProg.pct}%`,
                background: `linear-gradient(90deg, var(--accent-deep), ${pElement.color})`,
                boxShadow: `0 0 8px ${pElement.color}`,
              }}
            />
          </div>
          <p className="mt-1 text-[11px] font-semibold text-[var(--text-dim)]">
            {pProg.next
              ? `Reach level ${pProg.next.level} to evolve into ${pProg.next.name} Form`
              : `Fully evolved — ${petMeta.name} is a true Legend!`}
          </p>
        </div>
      </motion.div>

      {/* hero hall — a museum of completed adventures */}
      <section id="hero-hall" data-tour="hero-hall" className="scroll-mt-4">
        <div className="mb-3 flex items-center gap-2">
          <Icon name="sparkle" size={22} art className="text-[var(--accent-2)]" />
          <h2 className="text-display text-lg font-black">Hero Hall</h2>
          <span className="text-display text-xs font-bold text-[var(--gold)]">
            {bonds.filter((b) => b.status === "legend").length} Legend
            {bonds.filter((b) => b.status === "legend").length === 1 ? "" : "s"}
          </span>
          <span className="text-display text-xs font-bold text-[var(--text-dim)]">
            • {bonds.length}/{PETS.length} unlocked
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-[var(--surface-border)] to-transparent" />
        </div>

        {/* the gallery — every completed campaign stands on its own pedestal */}
        {bonds.some((b) => b.status === "legend") && (
          <div className="mb-4 flex flex-wrap justify-center gap-4">
            {bonds
              .filter((b) => b.status === "legend")
              .map((b, i) => {
                const p = PETS.find((x) => x.id === b.species) ?? PETS[0];
                const fw = FINALE_WORLDS[b.species];
                return (
                  <motion.button
                    key={b.id}
                    type="button"
                    onClick={() => setHallPick(b.species)}
                    initial={enter.initial}
                    animate={enter.animate}
                    transition={{ ...enter.transition, delay: stagger(i) }}
                    whileHover={{ y: -3 }}
                    whileTap={{ scale: 0.97 }}
                    className="panel relative flex w-40 cursor-pointer flex-col items-center overflow-hidden px-4 pb-3 pt-5"
                    style={{ boxShadow: "0 0 0 1.5px #ffb45e66, 0 0 26px -8px #ffb45e" }}
                  >
                    {/* museum spotlight */}
                    <div
                      className="fx-light pointer-events-none absolute inset-x-4 top-0 h-32"
                      style={{
                        background:
                          "radial-gradient(60% 100% at 50% 0%, rgba(255,215,120,0.22), transparent 75%)",
                      }}
                    />
                    <div className="relative z-10 -mb-1">
                      <Companion species={b.species} level={100} size={84} float={false} />
                    </div>
                    {/* the pedestal */}
                    <div className="relative z-0 flex w-full flex-col items-center">
                      <div
                        className="h-3 w-24 rounded-[50%]"
                        style={{
                          background: "linear-gradient(180deg, #e8c983, #8a6a34)",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
                        }}
                      />
                      <div
                        className="-mt-0.5 h-7 w-20"
                        style={{
                          clipPath: "polygon(8% 0, 92% 0, 100% 100%, 0 100%)",
                          background: "linear-gradient(180deg, #3c3628, #23201a)",
                          borderBottom: "2px solid #b98d43",
                        }}
                      />
                    </div>
                    <p className="text-display mt-1.5 text-xs font-black text-[var(--gold)]">
                      {p.name}
                    </p>
                    <p className="text-[10px] font-bold text-[var(--text-dim)]">
                      {fw?.name ?? "Campaign"} —{" "}
                      {b.legend_at ? new Date(b.legend_at).toLocaleDateString() : "complete"}
                    </p>
                  </motion.button>
                );
              })}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {PETS.filter((p) => bonds.find((b) => b.species === p.id)?.status !== "legend").map((p, i) => {
            const bond = bonds.find((b) => b.species === p.id);
            const isActive = bond?.status === "active";
            const isLegend = bond?.status === "legend";
            const awake = speciesUnlocked(p.id, profile, lifetimeCleared);
            const el = ELEMENTS[p.element];
            return (
              <motion.button
                key={p.id}
                type="button"
                onClick={() => setHallPick(p.id)}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, ease: EASE_OUT, delay: stagger(i) }}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.96 }}
                className="panel relative flex cursor-pointer flex-col items-center p-3 text-center"
                style={
                  isLegend
                    ? { boxShadow: "0 0 0 2px #ffb45e88, 0 0 22px -6px #ffb45e" }
                    : isActive
                      ? { boxShadow: `0 0 0 1.5px ${el.color}55, 0 0 20px -8px ${el.color}` }
                      : {}
                }
              >
                {isLegend && (
                  <span className="text-display absolute right-1.5 top-1.5 rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[var(--gold)]">
                    Legend
                  </span>
                )}
                {isActive && (
                  <span className="text-display absolute right-1.5 top-1.5 rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider" style={{ color: el.color }}>
                    Partner
                  </span>
                )}
                <div className={bond ? "" : awake ? "opacity-80" : "opacity-35 grayscale"}>
                  <Companion
                    species={p.id}
                    level={bond ? companionLevel(bond.xp) : 1}
                    size={62}
                    float={isActive}
                    interactive
                  />
                </div>
                <p className={`text-display mt-1 text-xs font-black ${bond ? "" : "text-[var(--text-dim)]"}`}>
                  {bond || awake ? p.name : "???"}
                </p>
                <p className="text-[10px] font-bold leading-tight text-[var(--text-dim)]">
                  {isLegend
                    ? "Conquered!"
                    : isActive
                      ? `Level ${companionLevel(bond.xp)}`
                      : awake
                        ? "Awake — waiting for you"
                        : unlockHint(COMPANION_UNLOCKS[p.id])}
                </p>
              </motion.button>
            );
          })}
        </div>

        {/* tap a companion → their story so far */}
        <AnimatePresence>
          {hallPick && (
            <HallDetail
              species={hallPick}
              profile={profile}
              bonds={bonds}
              tasks={tasks}
              worldsDone={lifetimeCleared}
              onClose={() => setHallPick(null)}
            />
          )}
        </AnimatePresence>
      </section>

      {/* the active campaign's journey */}
      <section data-tour="campaign-journey">
        <div className="mb-3 flex items-center gap-2">
          <Icon name="map" size={22} art className="text-[var(--accent-2)]" />
          <h2 className="text-display text-lg font-black">
            {petMeta.name}&apos;s Campaign
          </h2>
          <span className="text-display text-xs font-bold text-[var(--text-dim)]">
            World {worldNo} of {cs.worlds.length}
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-[var(--surface-border)] to-transparent" />
          <Link
            href="/app/campaign"
            className="text-display flex items-center gap-1 text-xs font-bold text-[var(--accent-2)] hover:underline"
          >
            View campaign <Icon name="arrowRight" size={12} />
          </Link>
        </div>
        <p className="mb-3 text-sm text-[var(--text-dim)]">
          {cs.currentWorld.isFinale && !cs.campaignCompleted && finaleWorld && world.id !== finaleWorld.id ? (
            <>
              You have reached{" "}
              <span className="font-bold" style={{ color: finaleWorld.accent }}>
                {finaleWorld.name}
              </span>{" "}
              — {petMeta.name}&apos;s own world! The {finaleWorld.finale.name} awaits at its end.
            </>
          ) : (
            <>
              You are exploring{" "}
              <span className="font-bold" style={{ color: world.accent }}>
                {world.name}
              </span>
              {wProg.current
                ? (() => {
                    const milestone = world.levels.find(
                      (l) => l.kind !== "quest" && l.requires >= wProg.current!.requires
                    );
                    return milestone?.kind === "final"
                      ? ` — the ${milestone.name} awaits at the end of this world (${wProg.completed}/${wProg.total} steps).`
                      : ` — next stop: ${milestone?.name ?? world.finale.name} (${wProg.completed}/${wProg.total} steps).`;
                  })()
                : finaleWorld
                  ? ` — complete! Next: ${finaleWorld.name}.`
                  : " — world complete! The next one awaits."}
            </>
          )}
        </p>
        <WorldMap world={world} campaignStep={step} species={profile.pet} />
      </section>

      {/* trophy room */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Icon name="trophy" size={22} art className="text-[var(--gold)]" />
          <h2 className="text-display text-lg font-black">Trophy Room</h2>
          <span className="text-display text-xs font-bold text-[var(--text-dim)]">
            {earnedCount}/{BADGES.length}
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-[var(--surface-border)] to-transparent" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {BADGES.map((badge, i) => {
            const unlockedAt = earned.get(badge.key);
            const rarity = RARITY[badge.rarity];
            const progress = Math.min(badge.target, badge.progress({ profile, counts }));
            const pct = Math.min(100, (progress / badge.target) * 100);
            return (
              <motion.div
                key={badge.key}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, ease: EASE_OUT, delay: stagger(i) }}
                whileHover={unlockedAt ? { y: -3 } : undefined}
                className="panel relative flex flex-col items-center p-3.5 text-center"
                style={
                  unlockedAt
                    ? { boxShadow: `0 0 0 1.5px ${rarity.color}55, 0 0 22px -8px ${rarity.color}, 0 12px 30px -18px rgba(0,0,0,0.6)` }
                    : {}
                }
              >
                <span
                  className="text-display absolute right-1.5 top-1.5 rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider"
                  style={{ color: rarity.color, background: "rgba(0,0,0,0.4)" }}
                >
                  {rarity.label}
                </span>
                <div className="relative grid h-16 w-16 place-items-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={badgeArt(badge.key)}
                    alt=""
                    className={`h-full w-full object-contain transition ${
                      unlockedAt ? "" : "opacity-45 grayscale"
                    }`}
                    style={unlockedAt ? { filter: `drop-shadow(0 0 10px ${rarity.color}88)` } : undefined}
                  />
                  {!unlockedAt && (
                    <span className="absolute inset-0 grid place-items-center">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-black/55">
                        <Icon name="lock" size={14} art />
                      </span>
                    </span>
                  )}
                </div>
                <p className={`text-display mt-2 text-sm font-bold ${unlockedAt ? "" : "text-[var(--text-dim)]"}`}>
                  {badge.title}
                </p>
                <p className="mt-0.5 text-[10px] leading-tight text-[var(--text-dim)]">{badge.description}</p>
                {unlockedAt ? (
                  <p className="mt-1.5 text-[10px] font-bold text-[var(--success)]">
                    Earned {new Date(unlockedAt).toLocaleDateString()}
                  </p>
                ) : (
                  <div className="mt-1.5 w-full">
                    <div className="h-1.5 overflow-hidden rounded-full bg-black/40">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: rarity.color, opacity: 0.8 }}
                      />
                    </div>
                    <p className="mt-0.5 text-[10px] font-bold text-[var(--text-dim)]">
                      {progress}/{badge.target}
                    </p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* family — compact "who else is adventuring" strip */}
      {family.length > 1 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Icon name="users" size={22} art className="text-[var(--accent-2)]" />
            <h2 className="text-display text-lg font-black">Your Family</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-[var(--surface-border)] to-transparent" />
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {[...family]
              .sort((a, b) => b.xp - a.xp)
              .map((h) => {
                const hLevel = levelFromXp(h.xp).level;
                const isMe = h.id === profile.id;
                return (
                  <div
                    key={h.id}
                    className={`panel flex shrink-0 flex-col items-center gap-1 px-4 py-3 ${isMe ? "ring-1 ring-[var(--accent)]/50" : ""}`}
                  >
                    <Portrait species={h.pet} size={44} />
                    <span className="text-display max-w-[80px] truncate text-xs font-bold">
                      {isMe ? "You" : h.nickname}
                    </span>
                    <span className="text-[10px] font-bold text-[var(--accent-2)]">LV {hLevel}</span>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      <CompanionCoach
        steps={hallSteps}
        active={hallBeat.active && !finaleBeat.active}
        onDone={hallBeat.onDone}
        species={profile.pet}
      />
      <CompanionCoach
        steps={finaleSteps}
        active={finaleBeat.active}
        onDone={finaleBeat.onDone}
        species={profile.pet}
      />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-black/25 px-3 py-2.5">
      <div className="text-display text-xl font-black text-[var(--accent-2)]">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{label}</div>
    </div>
  );
}

/* Where this companion comes from — shown in the Hall detail card. */
function originText(rule: UnlockRule): string {
  switch (rule.kind) {
    case "starter":
      return "A starter companion — with you from the very first day";
    case "world":
      return `Unlocked by completing ${WORLD_MAPS[rule.world].name}`;
    case "heroLevel":
      return `Awakens when you reach hero level ${rule.level}`;
    case "quests":
      return `Awakens after ${rule.count} completed quests`;
    case "coins":
      return `Awakens after earning ${rule.total} coins in total`;
  }
}

/* Tap a Hall card → the companion's story: who they are, how far you've
   travelled together, and how the next one joins. Never a swap button —
   partners only change through the Legend Ceremony. */
function HallDetail({
  species,
  profile,
  bonds,
  tasks,
  worldsDone,
  onClose,
}: {
  species: string;
  profile: Profile;
  bonds: CompanionBond[];
  tasks: Task[];
  worldsDone: number;
  onClose: () => void;
}) {
  const meta = PETS.find((p) => p.id === species) ?? PETS[0];
  useEscape(true, onClose);
  const el = ELEMENTS[meta.element];
  const bond = bonds.find((b) => b.species === species);
  const activeBond = bonds.find((b) => b.status === "active");
  const awake = speciesUnlocked(species, profile, worldsDone);

  const status = bond
    ? bond.status === "active"
      ? "Active"
      : "Legendary"
    : awake
      ? "Available"
      : "Locked";
  const statusColor =
    status === "Active"
      ? el.color
      : status === "Legendary"
        ? "var(--gold)"
        : status === "Available"
          ? "var(--success)"
          : "var(--text-dim)";

  const prog = bond ? companionProgress(bond.xp) : null;
  const form = bond ? petForm(prog!.level) : null;

  // the campaign counter IS "quests conquered together"
  const questsTogether = bond?.quests_done ?? 0;
  const finaleW = FINALE_WORLDS[species] ?? null;
  // coins collected during this bond — derived from the quests approved
  // while the campaign was running (nothing extra is stored)
  const coinsTogether = bond
    ? tasks
        .filter(
          (t) =>
            t.status === "completed" &&
            t.completed_at &&
            t.completed_at >= bond.bonded_at &&
            (bond.legend_at ? t.completed_at <= bond.legend_at : true)
        )
        .reduce((sum, t) => sum + (t.coin_reward ?? 0), 0)
    : 0;

  const activeMeta = activeBond ? PETS.find((p) => p.id === activeBond.species) : null;
  // a new campaign can only begin once the active one is complete
  const activeIsLegendReady = !!activeBond && campaignCompleted(campaignStep(activeBond));

  return (
    <motion.div
      {...overlayFade}
      role="dialog"
      aria-modal="true"
      aria-label={`${meta.name} — companion details`}
      className="fixed inset-0 z-[80] grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94 }}
        transition={popSpring}
        className="panel panel-glow relative w-full max-w-sm p-6 text-center"
        onClick={(e) => e.stopPropagation()}
        style={
          status === "Legendary"
            ? { boxShadow: "0 0 0 2px #ffb45e88, 0 0 34px -8px #ffb45e" }
            : undefined
        }
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-black/30 text-[var(--text-dim)] hover:text-white"
          aria-label="Close"
        >
          <Icon name="x" size={15} />
        </button>

        <div className={`mx-auto w-fit ${bond || awake ? "" : "opacity-40 grayscale"}`}>
          <Companion
            species={species}
            level={prog?.level ?? 1}
            size={120}
            float={status === "Active"}
          />
        </div>

        <h3 className="text-display mt-2 text-2xl font-black">
          {bond || awake ? meta.name : "???"}
        </h3>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
          <span
            className="text-display rounded-md bg-black/35 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
            style={{ color: statusColor }}
          >
            {status}
          </span>
          {(bond || awake) && (
            <>
              <span
                className="text-display rounded-md bg-black/35 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ color: el.color }}
              >
                {el.label}
              </span>
              <span className="text-display rounded-md bg-black/35 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent-2)]">
                {meta.personality}
              </span>
            </>
          )}
        </div>

        {(bond || awake) && (
          <p className="mt-2 text-xs leading-relaxed text-[var(--text-dim)]">{meta.blurb}</p>
        )}

        {/* Legendary: the museum plaque — a completed campaign's record */}
        {bond && status === "Legendary" ? (
          <div className="mt-4 overflow-hidden rounded-2xl bg-black/25 text-left">
            {/* their world, on exhibit */}
            {finaleW && (
              <WorldThumbnail
                map={finaleW.map ?? null}
                name={finaleW.name}
                accent={finaleW.accent}
                icon={finaleW.finale.icon}
                className="h-20 w-full"
                sizes="384px"
              />
            )}
            <div className="flex flex-col gap-2 p-4">
              <div className="flex items-center gap-2">
                {/* the legend badge */}
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
                  style={{
                    background: "radial-gradient(circle at 35% 30%, #ffd76a, #b8860b)",
                    boxShadow: "0 0 14px -2px #ffd76a",
                  }}
                >
                  <Icon name="trophy" size={17} filled className="text-white" />
                </span>
                <div>
                  <p className="text-display text-sm font-black text-[var(--gold)]">
                    Campaign Complete
                  </p>
                  <p className="text-[10px] font-bold text-[var(--text-dim)]">
                    A whole adventure, finished together
                  </p>
                </div>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1.5">
                <PlaqueStat label="Quests conquered" value={`${bond.quests_done}`} />
                <PlaqueStat
                  label="Became a Legend"
                  value={bond.legend_at ? new Date(bond.legend_at).toLocaleDateString() : "—"}
                />
                <PlaqueStat label="Favorite world" value={finaleW?.name ?? "Their own"} />
                <PlaqueStat label="Coins gathered" value={`${coinsTogether}`} />
              </div>
            </div>
          </div>
        ) : (
          /* the journey so far — an active or future partner */
          bond &&
          prog &&
          form && (
            <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-black/25 p-4 text-left">
              <div className="flex items-center justify-between">
                <span className="text-display text-sm font-black">
                  Level {prog.level}{" "}
                  <span className="text-xs font-bold text-[var(--accent-2)]">— {form.name} Form</span>
                </span>
                <span className="text-display text-[10px] font-bold text-[var(--text-dim)]">
                  {prog.level >= 100 ? "Fully evolved" : `${prog.into}/${prog.needed} XP`}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-black/40">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${prog.pct}%`,
                    background: `linear-gradient(90deg, var(--accent-deep), ${el.color})`,
                    boxShadow: `0 0 8px ${el.color}`,
                  }}
                />
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-dim)]">
                <Icon name="trophy" size={13} className="text-[var(--gold)]" />
                {questsTogether} quest{questsTogether === 1 ? "" : "s"} conquered together
              </div>
            </div>
          )
        )}

        {/* origin + campaign finale + what happens next */}
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-bold text-[var(--text-dim)]">
          <Icon name="map" size={12} className="shrink-0 text-[var(--accent-2)]" />
          {originText(COMPANION_UNLOCKS[species])}
        </p>
        {(bond || awake) && FINALE_WORLDS[species] && (
          <p className="mt-1 flex items-center justify-center gap-1.5 text-[11px] font-bold text-[var(--text-dim)]">
            <span className="shrink-0" style={{ color: FINALE_WORLDS[species].accent }}>
              <Icon name={FINALE_WORLDS[species].finale.icon} size={12} />
            </span>
            Campaign finale: {FINALE_WORLDS[species].name}
          </p>
        )}

        {status === "Available" && activeBond && activeMeta && (
          <p className="mt-2 rounded-xl bg-black/25 px-3 py-2 text-[11px] font-bold text-[var(--text-dim)]">
            {activeIsLegendReady ? (
              <>Ready to begin their campaign — choose them at the Legend Ceremony!</>
            ) : (
              <>
                {meta.name} will wait for you. A new campaign begins when{" "}
                <span style={{ color: "var(--gold)" }}>{activeMeta.name}</span> completes{" "}
                {FINALE_WORLDS[activeBond.species]?.name ?? "their finale world"} and becomes
                Legendary.
              </>
            )}
          </p>
        )}
        {status === "Locked" && (
          <p className="mt-2 rounded-xl bg-black/25 px-3 py-2 text-[11px] font-bold text-[var(--text-dim)]">
            A mysterious companion still sleeps… {unlockHint(COMPANION_UNLOCKS[species])}.
          </p>
        )}
        {status === "Legendary" && (
          <p className="mt-2 text-[11px] font-bold text-[var(--gold)]">
            Forever in your Hall — a true Legend of Questforge.
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}

/* One engraved line on a Legend's museum plaque. */
function PlaqueStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/25 px-2.5 py-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{label}</p>
      <p className="text-display text-sm font-black text-[var(--gold)]">{value}</p>
    </div>
  );
}
