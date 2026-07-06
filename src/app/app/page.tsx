"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useWorld } from "@/components/ThemeProvider";
import { QuestCard } from "@/components/QuestCard";
import { Icon } from "@/components/Icon";
import { GameButton } from "@/components/GameButton";
import { Companion } from "@/components/Companion";
import { CompanionGuide } from "@/components/CompanionGuide";
import { ChallengesPanel } from "@/components/ChallengesPanel";
import { MagicLoader } from "@/components/MagicLoader";
import { CelebrationOverlay, CelebrationData } from "@/components/CelebrationOverlay";
import { MysteryChest } from "@/components/MysteryChest";
import { companionMessages } from "@/lib/companion";
import { Task, Reward, Profile, levelFromXp, companionLevel, todaysEvent } from "@/lib/game";

function untilMidnight(): string {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const mins = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 60000));
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

const STREAK_MILESTONES = [3, 7, 14, 30, 100];

export default function DailyQuests() {
  const { theme, profile, setProfile, companion } = useWorld();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [nextReward, setNextReward] = useState<Reward | null>(null);
  const [loading, setLoading] = useState(true);
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);
  const [chestActive, setChestActive] = useState(false);
  const [resetIn, setResetIn] = useState(untilMidnight());

  const event = todaysEvent();
  const todayISO = new Date().toISOString().slice(0, 10);
  const chestAvailable = !!profile && profile.last_chest_date !== todayISO;

  useEffect(() => {
    const iv = setInterval(() => setResetIn(untilMidnight()), 30_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    (async () => {
      const [{ data: t }, { data: r }, { data: ach }] = await Promise.all([
        supabase.from("tasks").select("*").eq("child_id", profile.id).order("created_at", { ascending: false }),
        supabase.from("rewards").select("*").eq("available", true).order("coin_cost", { ascending: true }),
        supabase
          .from("achievements")
          .select("title, unlocked_at")
          .eq("child_id", profile.id)
          .order("unlocked_at", { ascending: false }),
      ]);
      const list = (t as Task[]) ?? [];
      setTasks(list);
      const affordableNext = ((r as Reward[]) ?? []).find((rw) => rw.coin_cost > (profile.coins ?? 0));
      setNextReward(affordableNext ?? ((r as Reward[]) ?? [])[0] ?? null);
      setLoading(false);

      // Victories the parent approved while the hero was away → celebrate now.
      const seenKey = `qf_celebrated_${profile.id}`;
      const xpKey = `qf_last_xp_${profile.id}`;
      const visitKey = `qf_lastvisit_${profile.id}`;
      const seen = new Set<string>(JSON.parse(localStorage.getItem(seenKey) ?? "[]"));
      const completed = list.filter((task) => task.status === "completed");
      const fresh = completed.filter((task) => !seen.has(task.id));
      const firstVisit = localStorage.getItem(seenKey) === null;
      const lastVisit = localStorage.getItem(visitKey);
      const newBadges =
        lastVisit && ach
          ? (ach as { title: string; unlocked_at: string }[])
              .filter((a) => a.unlocked_at > lastVisit)
              .map((a) => a.title)
          : [];

      if (fresh.length > 0 && !firstVisit) {
        const lastXp = Number(localStorage.getItem(xpKey) ?? profile.xp);
        const oldLevel = levelFromXp(lastXp).level;
        const newLevel = levelFromXp(profile.xp).level;
        setCelebration({
          coins: fresh.reduce((sum, task) => sum + task.coin_reward, 0),
          xp: fresh.reduce((sum, task) => sum + task.xp_reward, 0),
          feedback:
            fresh.length === 1
              ? `"${fresh[0].title}" was approved!`
              : `${fresh.length} ${theme.questWord.toLowerCase()}s were approved!`,
          leveledUp: newLevel > oldLevel,
          newLevel,
          streak: profile.streak_days,
          achievements: newBadges,
        });
      }
      localStorage.setItem(seenKey, JSON.stringify(completed.map((task) => task.id)));
      localStorage.setItem(xpKey, String(profile.xp));
      localStorage.setItem(visitKey, new Date().toISOString());
    })();
  }, [profile, theme.questWord]);

  const active = useMemo(
    () => tasks.filter((t) => t.status === "active" || t.status === "rejected"),
    [tasks]
  );
  const waiting = useMemo(
    () => tasks.filter((t) => t.status === "submitted" || t.status === "needs_review"),
    [tasks]
  );
  const done = useMemo(() => tasks.filter((t) => t.status === "completed"), [tasks]);

  const today = new Date().toDateString();
  const doneToday = done.filter((t) => new Date(t.created_at).toDateString() === today);
  const todayTotal = active.length + waiting.length + doneToday.length;
  const progressPct = todayTotal > 0 ? (doneToday.length / todayTotal) * 100 : 0;
  const nextQuest = active[0];

  const messages = useMemo(() => {
    if (!profile) return [];
    return companionMessages(
      {
        profile,
        tasks,
        nextRewardName: nextReward?.name,
        coinsToReward: nextReward ? Math.max(0, nextReward.coin_cost - profile.coins) : null,
      },
      theme.id
    );
  }, [profile, tasks, nextReward, theme.id]);

  const nextMilestone = profile
    ? STREAK_MILESTONES.find((m) => m > profile.streak_days)
    : undefined;

  function grantChest(r: { kind: string; bonus: number }) {
    if (!profile) return;
    if (r.kind === "xp") {
      setProfile({ ...profile, xp: profile.xp + r.bonus, last_chest_date: todayISO } as Profile);
    } else {
      setProfile({
        ...profile,
        coins: profile.coins + r.bonus,
        total_coins_earned: profile.total_coins_earned + r.bonus,
        last_chest_date: todayISO,
      } as Profile);
    }
  }

  if (loading) {
    return <MagicLoader label="Gathering today's quests..." />;
  }

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      {/* ============ main column ============ */}
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        {/* daily surprise event */}
        {/* Today's Adventure banner */}
        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel panel-glow relative overflow-hidden px-6 py-5 text-center"
        >
          <div
            className="fx-light absolute inset-x-0 top-0 h-full animate-pulse-glow"
            style={{ background: "radial-gradient(70% 120% at 50% 0%, var(--glow-soft), transparent)" }}
          />
          <h1 className="text-display text-glow shimmer-text relative text-3xl font-black sm:text-4xl">
            Today&apos;s Adventure
          </h1>
          <div className="relative mt-2 flex flex-wrap items-center justify-center gap-2">
            <span className="text-display inline-flex items-center gap-1.5 rounded-full bg-[var(--glow-soft)] px-3 py-1 text-xs font-bold text-[var(--gold)]">
              <Icon name={event.icon} size={13} /> {event.title}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1 text-xs font-bold text-[var(--text-dim)]">
              <Icon name="clock" size={13} className="text-[var(--accent-2)]" />
              resets in {resetIn}
            </span>
          </div>

          {todayTotal > 0 && (
            <div className="relative mx-auto mt-4 flex max-w-md items-center gap-3">
              <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-black/40 [box-shadow:inset_0_2px_5px_rgba(0,0,0,0.6)]">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: "linear-gradient(90deg, var(--accent-deep), var(--accent), var(--success))",
                    boxShadow: "0 0 14px var(--glow)",
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ type: "spring", stiffness: 50, damping: 15, delay: 0.4 }}
                />
              </div>
              <div className={`relative ${progressPct >= 100 ? "animate-[chest-shake_1.2s_ease-in-out_infinite]" : ""}`}>
                <Icon
                  name="chest"
                  size={26}
                  className={progressPct >= 100 ? "text-[var(--gold)]" : "text-[var(--text-dim)]"}
                />
              </div>
              <span className="text-display absolute -bottom-5 left-1/2 -translate-x-1/2 text-[11px] font-bold text-[var(--text-dim)]">
                {doneToday.length}/{todayTotal} today
              </span>
            </div>
          )}
        </motion.div>

        {/* pet companion */}
        <CompanionGuide messages={messages} />

        {nextQuest ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            className="panel panel-glow relative overflow-hidden p-6"
          >
            <div
              className="fx-light absolute -right-10 -top-10 h-48 w-48 animate-pulse-glow rounded-full"
              style={{ background: "radial-gradient(circle, var(--glow-soft), transparent 70%)" }}
            />
            <p className="text-display text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-2)]">
              Next {theme.questWord}
            </p>
            <h2 className="text-display text-glow mt-1 text-3xl font-black">{nextQuest.title}</h2>
            {nextQuest.description && (
              <p className="mt-1 max-w-lg text-sm text-[var(--text-dim)]">{nextQuest.description}</p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <Link href={`/app/quest/${nextQuest.id}`}>
                <GameButton className="text-base">
                  Start {theme.questWord} <Icon name="arrowRight" size={17} className="ml-1 inline" />
                </GameButton>
              </Link>
              <span className="text-display text-sm font-black text-[var(--gold)]">
                +{nextQuest.coin_reward} {theme.coinName}
              </span>
              <span className="text-display text-sm font-black text-[var(--accent-2)]">
                +{nextQuest.xp_reward} XP
              </span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="panel panel-glow relative overflow-hidden p-8 text-center"
          >
            <div
              className="fx-light absolute inset-0 animate-pulse-glow"
              style={{ background: "radial-gradient(70% 90% at 50% 0%, var(--glow-soft), transparent)" }}
            />
            {profile && (
              <div className="relative mx-auto w-fit">
                <Companion species={profile.pet} level={companion ? companionLevel(companion.xp) : 1} size={96} />
              </div>
            )}
            <h2 className="text-display text-glow relative mt-2 text-2xl font-black">
              All quests done!
            </h2>
            <p className="relative mt-1 text-sm font-semibold text-[var(--text-dim)]">
              Amazing work today, hero. Come back tomorrow for more.
            </p>
          </motion.div>
        )}

        {waiting.length > 0 && (
          <section>
            <SectionTitle icon="eye" title="Being Checked" />
            <div className="flex flex-col gap-3">
              {waiting.map((t, i) => (
                <QuestCard key={t.id} task={t} index={i} />
              ))}
            </div>
          </section>
        )}

        {active.length > 1 && (
          <section>
            <SectionTitle icon="sword" title={`More ${theme.questWord}s`} />
            <div className="flex flex-col gap-3">
              {active.slice(1).map((t, i) => (
                <QuestCard key={t.id} task={t} index={i} />
              ))}
            </div>
          </section>
        )}

        {done.length > 0 && (
          <section>
            <SectionTitle icon="trophy" title="Victories" />
            <div className="flex flex-col gap-3">
              {done.slice(0, 5).map((t, i) => (
                <QuestCard key={t.id} task={t} index={i} />
              ))}
            </div>
          </section>
        )}

        <ChallengesPanel />
      </div>

      {/* ============ side column ============ */}
      <div className="flex shrink-0 flex-col gap-4 lg:sticky lg:top-24 lg:w-60">
        {/* mystery chest */}
        {chestAvailable && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="panel panel-glow p-5 text-center"
          >
            <p className="text-display text-xs font-bold uppercase tracking-[0.18em] text-[var(--gold)]">
              Mystery Chest
            </p>
            <div className="animate-[chest-shake_1.4s_ease-in-out_infinite] mx-auto mt-2 w-fit">
              <Icon name="chest" size={44} className="text-[var(--gold)]" />
            </div>
            <p className="mt-1 text-xs text-[var(--text-dim)]">A surprise is waiting inside!</p>
            <GameButton variant="gold" className="mt-3 w-full text-sm" onClick={() => setChestActive(true)}>
              Open
            </GameButton>
          </motion.div>
        )}

        {/* streak */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
          className="panel panel-glow p-5 text-center"
        >
          <p className="text-display text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-dim)]">
            Your Streak
          </p>
          <div className="relative mx-auto mt-2 w-fit">
            <Icon
              name="flame"
              size={44}
              filled
              className={profile && profile.streak_days > 0 ? "text-[var(--danger)]" : "text-[var(--text-dim)]"}
            />
            {profile && profile.streak_days > 0 && (
              <div
                className="fx-light absolute inset-[-40%] animate-pulse-glow rounded-full"
                style={{ background: "radial-gradient(circle, rgba(255,107,138,0.35), transparent 70%)" }}
              />
            )}
          </div>
          <p className="text-display text-glow mt-1 text-3xl font-black">{profile?.streak_days ?? 0}</p>
          <p className="text-xs font-bold text-[var(--text-dim)]">
            day{(profile?.streak_days ?? 0) === 1 ? "" : "s"} in a row
          </p>
          {nextMilestone && (
            <p className="mt-1.5 text-[11px] font-semibold text-[var(--accent-2)]">
              {nextMilestone - (profile?.streak_days ?? 0)} to the {nextMilestone}-day reward
            </p>
          )}
        </motion.div>

        {/* next reward */}
        {nextReward && profile && (
          <Link href="/app/shop">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 }}
              whileHover={{ y: -3 }}
              className="panel p-5 text-center"
            >
              <p className="text-display text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                Next Treasure
              </p>
              <div className="animate-floaty mx-auto mt-2 w-fit">
                <Icon name="chest" size={40} className="text-[var(--gold)]" />
              </div>
              <p className="text-display mt-1 truncate text-sm font-bold">{nextReward.name}</p>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/40">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, (profile.coins / nextReward.coin_cost) * 100)}%`,
                    background: "linear-gradient(90deg, #d9a72e, var(--gold))",
                    boxShadow: "0 0 10px rgba(255,215,106,0.6)",
                  }}
                />
              </div>
              <p className="text-display mt-1.5 text-xs font-black text-[var(--gold)]">
                {profile.coins}/{nextReward.coin_cost}
              </p>
              {profile.coins >= nextReward.coin_cost ? (
                <p className="mt-0.5 text-[11px] font-bold text-[var(--success)]">Ready to claim!</p>
              ) : (
                <p className="mt-0.5 text-[11px] text-[var(--text-dim)]">
                  {nextReward.coin_cost - profile.coins} coins to go
                </p>
              )}
            </motion.div>
          </Link>
        )}
      </div>

      <MysteryChest active={chestActive} onClose={() => setChestActive(false)} onReward={grantChest} />
      <CelebrationOverlay data={celebration} onClose={() => setCelebration(null)} />
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon name={icon} size={18} className="text-[var(--accent-2)]" />
      <h2 className="text-display text-lg font-black">{title}</h2>
      <div className="h-px flex-1 bg-gradient-to-r from-[var(--surface-border)] to-transparent" />
    </div>
  );
}
