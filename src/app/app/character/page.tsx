"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useWorld } from "@/components/ThemeProvider";
import { CompanionPortrait } from "@/components/CompanionPortrait";
import { Companion } from "@/components/Companion";
import { XPBar } from "@/components/XPBar";
import { WorldMap } from "@/components/WorldMap";
import { Icon } from "@/components/Icon";
import { petMood, petMoodLabel } from "@/lib/pet";
import { LegendCeremony } from "@/components/LegendCeremony";
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
  LEGEND_XP,
  COMPANION_UNLOCKS,
  speciesUnlocked,
  unlockHint,
  CompanionBond,
  Task,
  Profile,
} from "@/lib/game";
import { WORLD_MAPS, WORLD_ORDER, worldProgress, worldsCompleted } from "@/lib/worlds";

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

  if (!profile) return null;
  const { level } = levelFromXp(profile.xp);
  const cls = CHARACTER_CLASSES.find((c) => c.id === profile.character_class);
  const earned = new Map(achievements.map((a) => [a.key, a.unlocked_at]));
  const earnedCount = BADGES.filter((b) => earned.has(b.key)).length;

  const petMeta = PETS.find((p) => p.id === profile.pet) ?? PETS[0];
  const cLevel = companion ? companionLevel(companion.xp) : 1;
  const pForm = petForm(cLevel);
  const pProg = petFormProgress(cLevel);
  const pElement = petElement(profile.pet);
  const pMood = petMood(profile, tasks);
  const world = WORLD_MAPS[profile.theme];
  const wProg = worldProgress(world, profile.tasks_completed);
  const chapterNo = WORLD_ORDER.indexOf(profile.theme) + 1;
  const done = worldsCompleted(profile.tasks_completed);
  const legendReady = !!companion && companion.status === "active" && companion.xp >= LEGEND_XP;

  return (
    <div className="flex flex-col gap-6">
      {/* the biggest moment in the app */}
      {legendReady && companion && (
        <LegendCeremony
          profile={profile}
          companion={companion}
          bonds={bonds}
          onComplete={(newBond) => {
            setCompanion(newBond);
            window.location.reload();
          }}
        />
      )}

      {/* hero card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="panel panel-glow relative overflow-hidden p-6 text-center"
      >
        <div
          className="fx-light absolute inset-x-0 top-0 h-40 animate-pulse-glow"
          style={{ background: "radial-gradient(60% 100% at 50% 0%, var(--glow-soft), transparent)" }}
        />
        <div className="relative mx-auto w-fit animate-floaty">
          <CompanionPortrait species={profile.pet} size={120} />
        </div>
        <h1 className="text-display text-glow mt-3 text-3xl font-black">{profile.nickname}</h1>
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
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
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

      {/* hero hall — the lifelong companion collection */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Icon name="sparkle" size={18} className="text-[var(--accent-2)]" />
          <h2 className="text-display text-lg font-black">Hero Hall</h2>
          <span className="text-display text-xs font-bold text-[var(--text-dim)]">
            {bonds.filter((b) => b.status === "legend").length} legends —{" "}
            {bonds.length}/{PETS.length} met
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-[var(--surface-border)] to-transparent" />
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {PETS.map((p, i) => {
            const bond = bonds.find((b) => b.species === p.id);
            const isActive = bond?.status === "active";
            const isLegend = bond?.status === "legend";
            const awake = speciesUnlocked(p.id, profile, done);
            const el = ELEMENTS[p.element];
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03 }}
                className="panel relative flex flex-col items-center p-3 text-center"
                style={
                  isLegend
                    ? { boxShadow: "0 0 0 1.5px #ffb45e66, 0 0 22px -8px #ffb45e" }
                    : isActive
                      ? { boxShadow: `0 0 0 1.5px ${el.color}55, 0 0 20px -8px ${el.color}` }
                      : {}
                }
              >
                {isLegend && (
                  <span className="text-display absolute right-1.5 top-1.5 rounded bg-black/40 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-[var(--gold)]">
                    Legend
                  </span>
                )}
                {isActive && (
                  <span className="text-display absolute right-1.5 top-1.5 rounded bg-black/40 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider" style={{ color: el.color }}>
                    Partner
                  </span>
                )}
                <div className={bond ? "" : "opacity-35 grayscale"}>
                  <Companion
                    species={p.id}
                    level={bond ? companionLevel(bond.xp) : 1}
                    size={62}
                    float={isActive}
                  />
                </div>
                <p className={`text-display mt-1 text-xs font-black ${bond ? "" : "text-[var(--text-dim)]"}`}>
                  {bond ? p.name : awake ? p.name : "???"}
                </p>
                <p className="text-[9px] font-bold leading-tight text-[var(--text-dim)]">
                  {isLegend
                    ? "Completed"
                    : isActive
                      ? `Level ${companionLevel(bond.xp)}`
                      : awake
                        ? "Awake — waiting for you"
                        : unlockHint(COMPANION_UNLOCKS[p.id])}
                </p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* worlds journey */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Icon name="map" size={18} className="text-[var(--accent-2)]" />
          <h2 className="text-display text-lg font-black">Your Journey</h2>
          <span className="text-display text-xs font-bold text-[var(--text-dim)]">
            Chapter {chapterNo} of {WORLD_ORDER.length}
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-[var(--surface-border)] to-transparent" />
        </div>
        <p className="mb-3 text-sm text-[var(--text-dim)]">
          You are exploring{" "}
          <span className="font-bold" style={{ color: world.accent }}>
            {world.name}
          </span>
          {wProg.current
            ? ` — next up: ${wProg.current.name} (${wProg.completed}/${wProg.total} levels cleared).`
            : " — chapter complete! The next world awaits."}
        </p>
        <WorldMap
          theme={profile.theme}
          tasksCompleted={profile.tasks_completed}
          species={profile.pet}
        />
      </section>

      {/* trophy room */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Icon name="trophy" size={18} className="text-[var(--gold)]" />
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
                transition={{ delay: i * 0.04 }}
                className="panel relative flex flex-col items-center p-3.5 text-center"
                style={
                  unlockedAt
                    ? { boxShadow: `0 0 0 1.5px ${rarity.color}55, 0 0 22px -8px ${rarity.color}, 0 12px 30px -18px rgba(0,0,0,0.6)` }
                    : {}
                }
              >
                <span
                  className="text-display absolute right-1.5 top-1.5 rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider"
                  style={{ color: rarity.color, background: "rgba(0,0,0,0.4)" }}
                >
                  {rarity.label}
                </span>
                <div
                  className="relative grid h-14 w-14 place-items-center rounded-full"
                  style={{
                    background: unlockedAt
                      ? `radial-gradient(circle at 35% 30%, ${rarity.color}, ${rarity.color}55)`
                      : "rgba(0,0,0,0.35)",
                    boxShadow: unlockedAt ? `0 0 16px -2px ${rarity.color}` : "none",
                  }}
                >
                  {unlockedAt ? (
                    <Icon name={badge.icon} size={26} className="text-white" filled />
                  ) : (
                    <Icon name="lock" size={20} className="text-[var(--text-dim)]" />
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
                    <p className="mt-0.5 text-[9px] font-bold text-[var(--text-dim)]">
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
            <Icon name="users" size={18} className="text-[var(--accent-2)]" />
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
                    className={`panel flex shrink-0 flex-col items-center gap-1 px-4 py-3 ${isMe ? "panel-glow" : ""}`}
                  >
                    <CompanionPortrait species={h.pet} size={44} />
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
