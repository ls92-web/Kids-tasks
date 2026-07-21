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
import { MilestoneCelebration, useMilestones } from "@/components/Milestone";
import { ChapterComplete } from "@/components/ChapterComplete";
import { MysteryChest } from "@/components/MysteryChest";
import { WorldMap } from "@/components/WorldMap";
import { companionMessages, sayFromCompanion } from "@/lib/companion";
import { enter, pop, barFill } from "@/lib/motion";
import { sfx } from "@/lib/sound";
import { CompanionCoach, useCoachBeat } from "@/components/CompanionCoach";
import { CoachStep, hasSeenTour } from "@/lib/tour";
import { Task, Reward, Profile, PETS, levelFromXp, companionLevel, petForm, todaysEvent } from "@/lib/game";
import { getCampaign } from "@/lib/campaign";

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
  // milestone celebrations (challenge victories etc.) wait their turn —
  // a quest celebration always plays first
  const { milestone, dismiss: dismissMilestone } = useMilestones(
    profile?.id,
    !loading && !celebration
  );

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
      // materialize any recurring-quest occurrences due today before we read
      // (idempotent + family-scoped; also expires yesterday's stale routines),
      // and settle any challenges whose end time has passed (bonus XP payout)
      await Promise.all([supabase.rpc("generate_due_quests"), supabase.rpc("settle_challenges")]);
      const [{ data: t }, { data: r }, { data: ach }, { data: wins }] = await Promise.all([
        supabase.from("tasks").select("*").eq("child_id", profile.id).order("created_at", { ascending: false }),
        supabase.from("rewards").select("*").eq("available", true).order("coin_cost", { ascending: true }),
        supabase
          .from("achievements")
          .select("title, unlocked_at")
          .eq("child_id", profile.id)
          .order("unlocked_at", { ascending: false }),
        supabase
          .from("events")
          .select("payload, created_at")
          .eq("child_id", profile.id)
          .eq("type", "challenge_won")
          .order("created_at", { ascending: false })
          .limit(10),
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

      // challenge victories settled while the hero was away
      const freshWins =
        lastVisit && wins
          ? (wins as { payload: { title?: string; xp?: number }; created_at: string }[]).filter(
              (w) => w.created_at > lastVisit
            )
          : [];
      const winXp = freshWins.reduce((sum, w) => sum + (w.payload?.xp ?? 0), 0);

      if ((fresh.length > 0 || freshWins.length > 0) && !firstVisit) {
        const lastXp = Number(localStorage.getItem(xpKey) ?? profile.xp);
        const oldLevel = levelFromXp(lastXp).level;
        const newLevel = levelFromXp(profile.xp).level;
        const questFeedback =
          fresh.length === 0
            ? ""
            : fresh.length === 1
              ? `"${fresh[0].title}" was approved!`
              : `${fresh.length} ${theme.questWord.toLowerCase()}s were approved!`;
        const winFeedback =
          freshWins.length === 0
            ? ""
            : `You won the "${freshWins[0].payload?.title ?? "family"}" challenge!`;
        setCelebration({
          coins: fresh.reduce((sum, task) => sum + task.coin_reward, 0),
          xp: fresh.reduce((sum, task) => sum + task.xp_reward, 0) + winXp,
          feedback: [winFeedback, questFeedback].filter(Boolean).join(" "),
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

  // "Next Quest" is whichever active quest is due soonest — not whichever
  // was created most recently. Quests without a deadline sort to the end
  // (newest-first among themselves, matching the old fallback order).
  const active = useMemo(() => {
    const list = tasks.filter((t) => t.status === "active" || t.status === "rejected");
    return [...list].sort((a, b) => {
      const ad = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const bd = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      if (ad !== bd) return ad - bd;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [tasks]);
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

  // The Companion Guided Adventure — the companion greets the child and drifts
  // to their first quest. No tutorial chrome; just a partner, discovering
  // together. The map is introduced later, once they've taken a first step.
  const welcomeSeen = useMemo(
    () => (profile ? hasSeenTour("coach_welcome", profile.id) : true),
    [profile]
  );
  const welcomeBeat = useCoachBeat("coach_welcome", profile?.id, !loading && !celebration);
  const welcomeSteps: CoachStep[] = [
    { text: "Hi! I'll be your adventure partner!" },
    { text: "Let's begin our very first quest together." },
    { anchor: "today-quest", text: "This is our first adventure — I think we can do it!" },
  ];

  const mapBeat = useCoachBeat(
    "coach_map",
    profile?.id,
    welcomeSeen && !loading && !celebration && (profile?.tasks_completed ?? 0) >= 1
  );
  const mapSteps: CoachStep[] = [
    { anchor: "hud", text: "Look — we earned coins, and we grew a little stronger!" },
    { anchor: "journey-map", text: "And this is our adventure map." },
    { anchor: "journey-map", text: "Every quest we finish takes us one step further." },
  ];

  // companion reactions to the big moments: evolution + a finished Legend
  useEffect(() => {
    if (!profile || !companion) return;
    // the campaign's final step: one proud line, once per bond
    const campKey = `qf_said_campaign_${companion.id}`;
    if (companion.quests_done >= 144 && !localStorage.getItem(campKey)) {
      localStorage.setItem(campKey, "1");
      const t = setTimeout(() => sayFromCompanion("campaignComplete"), 1200);
      return () => clearTimeout(t);
    }
    if (localStorage.getItem("qf_say_legendary")) {
      localStorage.removeItem("qf_say_legendary");
      const t = setTimeout(() => sayFromCompanion("legendary"), 1500);
      return () => clearTimeout(t);
    }
    const formIdx = petForm(companionLevel(companion.xp)).index;
    const formKey = `qf_form_seen_${profile.id}`;
    const prev = parseInt(localStorage.getItem(formKey) ?? "", 10);
    localStorage.setItem(formKey, String(formIdx));
    if (!Number.isNaN(prev) && formIdx > prev) {
      const t = setTimeout(() => sayFromCompanion("evolved"), 1500);
      return () => clearTimeout(t);
    }
  }, [profile, companion]);

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
      sayFromCompanion("coins");
    }
  }

  if (loading) {
    return <MagicLoader label="Gathering today's quests…" />;
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* ============ main column ============ */}
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        {/* Today's Adventure banner — calm and clear; the day at a glance */}
        <motion.div {...enter} className="panel relative overflow-hidden px-6 py-5 text-center">
          <h1 className="text-display relative text-3xl font-black sm:text-4xl">
            Today&apos;s Adventure
          </h1>
          <div className="relative mt-2 flex flex-wrap items-center justify-center gap-2">
            <span className="text-display inline-flex items-center gap-1.5 rounded-full bg-[var(--glow-soft)] px-3 py-1 text-xs font-bold text-[var(--gold)]">
              <Icon art name={event.icon} size={16} /> {event.title}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1 text-xs font-bold text-[var(--text-dim)]">
              <Icon art name="clock" size={16} className="text-[var(--accent-2)]" />
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
                  transition={{ ...barFill, delay: 0.3 }}
                />
              </div>
              <div className={`relative ${progressPct >= 100 ? "animate-[chest-shake_1.2s_ease-in-out_infinite]" : ""}`}>
                <Icon art
                  name="mystery-box"
                  size={26}
                  className={progressPct >= 100 ? "text-[var(--gold)]" : "text-[var(--text-dim)]"}
                />
              </div>
            </div>
          )}
          {todayTotal > 0 && (
            <p className="text-display relative mt-2 text-[11px] font-bold text-[var(--text-dim)]">
              {doneToday.length}/{todayTotal} today
            </p>
          )}
        </motion.div>

        {/* the active campaign — every approved quest moves it one step */}
        {profile && (() => {
          const cs = getCampaign(profile, companion);
          return (
          <section data-tour="journey-map">
            <div className="mb-3 flex items-center gap-2">
              <Icon name="map" size={22} art className="mr-0.5" />
              <h2 className="text-display text-lg font-black">Your Journey</h2>
              <span className="text-display text-xs font-bold text-[var(--text-dim)]">
                World {cs.currentWorldIndex + 1} of {cs.worlds.length}
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-[var(--surface-border)] to-transparent" />
              <Link
                href="/app/campaign"
                onClick={() => sfx.click()}
                className="text-display flex items-center gap-1 text-[11px] font-bold text-[var(--accent-2)] hover:underline"
              >
                Campaign <Icon name="arrowRight" size={11} />
              </Link>
            </div>
            <WorldMap
              world={cs.mapWorld}
              campaignStep={cs.step}
              species={cs.species}
              holdAnimation={!!celebration}
            />
          </section>
          );
        })()}

        {/* pet companion */}
        <div data-tour="companion">
          <CompanionGuide messages={messages} />
        </div>

        {nextQuest ? (
          <motion.div {...pop} data-tour="today-quest" className="panel panel-glow relative overflow-hidden p-6">
            <p className="text-display text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-2)]">
              Next {theme.questWord}
            </p>
            <h2 className="text-display mt-1 text-3xl font-black">{nextQuest.title}</h2>
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
          <motion.div {...pop} className="panel relative overflow-hidden p-8 text-center">
            {profile && (
              <div className="relative mx-auto w-fit">
                <Companion species={profile.pet} level={companion ? companionLevel(companion.xp) : 1} size={96} reactive />
              </div>
            )}
            <h2 className="text-display relative mt-2 text-2xl font-black">
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
          <motion.div {...enter} className="panel p-5 text-center">
            <p className="text-display text-xs font-bold uppercase tracking-[0.18em] text-[var(--gold)]">
              Mystery Chest
            </p>
            <div className="animate-[chest-shake_1.4s_ease-in-out_infinite] mx-auto mt-2 w-fit">
              <Icon name="mystery-box" size={44} art />
            </div>
            <p className="mt-1 text-xs text-[var(--text-dim)]">A surprise is waiting inside!</p>
            <GameButton variant="gold" className="mt-3 w-full text-sm" onClick={() => setChestActive(true)}>
              Open
            </GameButton>
          </motion.div>
        )}

        {/* streak */}
        <motion.div
          {...enter}
          transition={{ ...enter.transition, delay: 0.06 }}
          className="panel p-5 text-center"
        >
          <p className="text-display text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-dim)]">
            Your Streak
          </p>
          <div className="relative mx-auto mt-2 w-fit">
            <Icon art
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
          <p className="text-display mt-1 text-3xl font-black">{profile?.streak_days ?? 0}</p>
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
              {...enter}
              transition={{ ...enter.transition, delay: 0.12 }}
              whileHover={{ y: -2 }}
              className="panel p-5 text-center transition-shadow hover:panel-glow"
            >
              <p className="text-display text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                Next Treasure
              </p>
              <div className="animate-floaty mx-auto mt-2 w-fit">
                <Icon name="chest" size={44} art />
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
      <CelebrationOverlay
        data={celebration}
        onClose={() => {
          // the companion reacts the moment the confetti clears
          if (celebration) {
            sayFromCompanion(
              celebration.leveledUp ? "levelUp" : active.length === 0 ? "allDone" : "questDone"
            );
          }
          setCelebration(null);
        }}
      />
      <MilestoneCelebration milestone={milestone} onClose={dismissMilestone} />
      <ChapterComplete />
      {profile && (
        <>
          <CompanionCoach
            steps={welcomeSteps}
            active={welcomeBeat.active}
            onDone={welcomeBeat.onDone}
            species={profile.pet}
          />
          <CompanionCoach
            steps={mapSteps}
            active={mapBeat.active}
            onDone={mapBeat.onDone}
            species={profile.pet}
          />
        </>
      )}
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon name={icon} size={22} art className="text-[var(--accent-2)]" />
      <h2 className="text-display text-lg font-black">{title}</h2>
      <div className="h-px flex-1 bg-gradient-to-r from-[var(--surface-border)] to-transparent" />
    </div>
  );
}
