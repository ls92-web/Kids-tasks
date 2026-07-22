"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useWorld } from "@/components/ThemeProvider";
import { Portrait } from "@/components/Portrait";
import { XPBar } from "@/components/XPBar";
import { Icon } from "@/components/Icon";
import { AdminButton, SectionCard } from "@/components/admin/ui";
import { Tour, useOnboardingTour } from "@/components/Tour";
import { TourStep } from "@/lib/tour";
import { Profile, Task, levelFromXp, rankName, TASK_TYPES } from "@/lib/game";

const TYPE_LABEL: Record<string, string> = Object.fromEntries(TASK_TYPES.map((t) => [t.id, t.label]));

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

interface ChildInsights {
  profile: Profile;
  assigned: number;
  completed: number;
  rate: number;
  byType: Record<string, { assigned: number; completed: number }>;
  favorite: string | null;
  hardest: string | null;
  weekCompleted: number;
  weekBars: number[];
  badges: number;
  summary: string;
}

/* One stop per tab, in nav order — first tab to last. */
const PARENT_STEPS: TourStep[] = [
  {
    text: "Welcome to WonderNest. This is where your child's real-life adventures begin — you create quests, they complete them.",
  },
  {
    anchor: "nav-overview",
    title: "Overview",
    text: "Your family at a glance — proofs waiting for review, reward wishes, and each hero's progress.",
  },
  {
    anchor: "nav-review",
    title: "Review",
    text: "When a hero submits a photo or voice proof, you approve it here. Nothing is awarded until you do.",
  },
  {
    anchor: "nav-quests",
    title: "Quests",
    text: "Assign real-life quests — difficulty fills in fair coins, XP and time, and routines repeat automatically.",
  },
  {
    anchor: "nav-challenges",
    title: "Challenges",
    text: "Start friendly family challenges — heroes race for the top or team up toward one shared goal.",
  },
  {
    anchor: "nav-rewards",
    title: "Rewards",
    text: "Stock real-life rewards that coins can buy. When a hero claims one, you make it real.",
  },
  {
    anchor: "nav-heroes",
    title: "Heroes",
    text: "Share your Family Code so your children can create their own hero — you approve join requests here.",
  },
  { text: "Your family adventure is ready to begin." },
];

export default function AdminOverview() {
  const { profile } = useWorld();
  const router = useRouter();
  const parentTour = useOnboardingTour("parent", profile?.id);
  const [children, setChildren] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({});
  const [pendingReviews, setPendingReviews] = useState(0);
  const [pendingWishes, setPendingWishes] = useState(0);
  const [pendingRedemptions, setPendingRedemptions] = useState(0);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    (async () => {
      const [kids, allTasks, ach, reviews, wishes, redemptions] = await Promise.all([
        supabase.from("profiles").select("*").eq("family_id", profile.family_id).eq("role", "child"),
        supabase.from("tasks").select("*").eq("family_id", profile.family_id),
        supabase.from("achievements").select("child_id").eq("family_id", profile.family_id),
        supabase.from("submissions").select("id", { count: "exact", head: true }).eq("status", "needs_review"),
        supabase.from("reward_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("redemptions").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      setChildren((kids.data as Profile[]) ?? []);
      setTasks((allTasks.data as Task[]) ?? []);
      const counts: Record<string, number> = {};
      ((ach.data as { child_id: string }[]) ?? []).forEach((a) => {
        counts[a.child_id] = (counts[a.child_id] ?? 0) + 1;
      });
      setBadgeCounts(counts);
      setPendingReviews(reviews.count ?? 0);
      setPendingWishes(wishes.count ?? 0);
      setPendingRedemptions(redemptions.count ?? 0);
    })();
  }, [profile]);

  const insights: ChildInsights[] = useMemo(() => {
    const last7: string[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return dayKey(d);
    });
    return children.map((child) => {
      const mine = tasks.filter((t) => t.child_id === child.id);
      const completed = mine.filter((t) => t.status === "completed");
      const byType: Record<string, { assigned: number; completed: number }> = {};
      for (const t of mine) {
        byType[t.task_type] ??= { assigned: 0, completed: 0 };
        byType[t.task_type].assigned++;
        if (t.status === "completed") byType[t.task_type].completed++;
      }
      const typesByCompleted = Object.entries(byType).sort((a, b) => b[1].completed - a[1].completed);
      const favorite = typesByCompleted[0]?.[1].completed ? typesByCompleted[0][0] : null;
      const hardest =
        Object.entries(byType)
          .filter(([, v]) => v.assigned >= 2)
          .sort((a, b) => a[1].completed / a[1].assigned - b[1].completed / b[1].assigned)[0]?.[0] ?? null;
      const weekBars = last7.map(
        (d) => completed.filter((t) => t.completed_at && dayKey(new Date(t.completed_at)) === d).length
      );
      const weekCompleted = weekBars.reduce((a, b) => a + b, 0);
      const rate = mine.length ? completed.length / mine.length : 0;

      const summary =
        mine.length === 0
          ? `No quests assigned to ${child.nickname} yet. Add a few to start the adventure!`
          : `${child.nickname} completed ${weekCompleted} quest${weekCompleted === 1 ? "" : "s"} this week` +
            (child.streak_days > 0 ? ` and is on a ${child.streak_days}-day streak` : "") +
            `. ` +
            (favorite ? `They shine at ${TYPE_LABEL[favorite]?.toLowerCase() ?? favorite} quests` : "They're just getting started") +
            (hardest && hardest !== favorite
              ? `, and could use a little encouragement with ${TYPE_LABEL[hardest]?.toLowerCase() ?? hardest}.`
              : ".");

      return {
        profile: child,
        assigned: mine.length,
        completed: completed.length,
        rate,
        byType,
        favorite,
        hardest,
        weekCompleted,
        weekBars,
        badges: badgeCounts[child.id] ?? 0,
        summary,
      };
    });
  }, [children, tasks, badgeCounts]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-display text-2xl font-black">Family Overview</h1>

      {/* attention needed */}
      <div data-tour="attention" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AttentionCard href="/admin/review" icon="camera" count={pendingReviews} label="Proofs to review" />
        <AttentionCard href="/admin/rewards" icon="star" count={pendingWishes} label="Reward wishes" />
        <AttentionCard href="/admin/review" icon="gift" count={pendingRedemptions} label="Rewards to grant" />
      </div>

      {/* children */}
      {children.length === 0 ? (
        <div className="panel flex flex-col items-center gap-4 p-10 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-black/25">
            <Icon name="heroes" size={40} art muted />
          </div>
          <div className="max-w-sm">
            <h2 className="text-display text-lg font-black">No heroes yet</h2>
            <p className="mt-1.5 text-sm leading-snug text-[var(--text-dim)]">
              Create your child&apos;s hero to start assigning real-life quests — or share your
              Family Code so they can join the adventure.
            </p>
          </div>
          <AdminButton onClick={() => router.push("/admin/children")}>
            Create your first hero
          </AdminButton>
        </div>
      ) : (
        <div data-tour="children" className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {children.map((c) => {
            const { level } = levelFromXp(c.xp);
            return (
              <div key={c.id} className="panel p-4">
                <div className="flex items-center gap-3">
                  <Portrait species={c.pet} size={52} />
                  <div className="min-w-0 flex-1">
                    <p className="text-display truncate font-bold">{c.nickname}</p>
                    <p className="text-xs font-semibold text-[var(--accent-2)]">
                      Hero LV {level} — {rankName(c.theme, level)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-display text-lg font-black text-[var(--gold)]">{c.coins}</p>
                    <p className="text-[10px] font-bold uppercase text-[var(--text-dim)]">coins</p>
                  </div>
                </div>
                <div className="mt-3">
                  <XPBar xp={c.xp} compact />
                </div>
                <div className="mt-3 flex gap-4 text-xs font-semibold text-[var(--text-dim)]">
                  <span className="flex items-center gap-1">
                    <Icon name="check" size={13} /> {c.tasks_completed} done
                  </span>
                  <span className="flex items-center gap-1">
                    <Icon art muted name="flame" size={13} /> {c.streak_days}-day streak
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* insights — one card per hero */}
      {insights.length > 0 && (
        <>
          <div className="mt-1 flex items-center gap-2">
            <Icon name="insights" size={22} art muted />
            <h2 className="text-display text-lg font-black">Insights</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-[var(--surface-border)] to-transparent" />
          </div>
          {insights.map((ins) => {
            const { level } = levelFromXp(ins.profile.xp);
            const maxBar = Math.max(1, ...ins.weekBars);
            const maxType = Math.max(1, ...Object.values(ins.byType).map((v) => v.completed));
            return (
              <SectionCard key={ins.profile.id} title="" subtitle="">
                {/* header */}
                <div className="-mt-2 mb-4 flex items-center gap-3">
                  <Portrait species={ins.profile.pet} size={48} />
                  <div className="flex-1">
                    <p className="text-display text-lg font-black">{ins.profile.nickname}</p>
                    <p className="text-xs text-[var(--text-dim)]">Level {level}</p>
                  </div>
                </div>

                {/* AI weekly summary */}
                <div className="mb-4 rounded-xl bg-black/25 p-3.5">
                  <p className="text-display mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--accent-2)]">
                    <Icon art muted name="sparkle" size={13} /> This week&apos;s summary
                  </p>
                  <p className="text-sm leading-relaxed text-[var(--text)]">{ins.summary}</p>
                </div>

                {/* stat tiles */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatTile label="Completion" value={`${Math.round(ins.rate * 100)}%`} />
                  <StatTile label="Current streak" value={`${ins.profile.streak_days}d`} />
                  <StatTile label="This week" value={ins.weekCompleted} />
                  <StatTile label="Badges" value={ins.badges} />
                </div>

                {/* charts */}
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* 7-day activity */}
                  <div className="rounded-xl bg-black/25 p-4">
                    <p className="text-display mb-3 text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]">
                      Last 7 days
                    </p>
                    <div className="flex justify-between gap-1.5">
                      {ins.weekBars.map((n, i) => (
                        <div key={i} className="flex flex-1 flex-col items-center gap-1">
                          <div className="flex h-20 w-full items-end justify-center">
                            <motion.div
                              className="w-full max-w-[26px] rounded-t"
                              style={{
                                minHeight: n > 0 ? 4 : 0,
                                background: "linear-gradient(180deg, var(--accent-2), var(--accent-deep))",
                                boxShadow: n > 0 ? "0 0 10px var(--glow)" : "none",
                              }}
                              initial={{ height: 0 }}
                              animate={{ height: `${Math.round((n / maxBar) * 80)}px` }}
                              transition={{ delay: 0.2 + i * 0.05, type: "spring", stiffness: 80, damping: 14 }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-[var(--text-dim)]">
                            {["S", "M", "T", "W", "T", "F", "S"][new Date(new Date().setDate(new Date().getDate() - (6 - i))).getDay()]}
                          </span>
                          <span className="text-[10px] font-black text-[var(--accent-2)]">{n || ""}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* by type */}
                  <div className="rounded-xl bg-black/25 p-4">
                    <p className="text-display mb-3 text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]">
                      Quests by kind
                    </p>
                    {Object.keys(ins.byType).length === 0 ? (
                      <p className="text-xs text-[var(--text-dim)]">No quests yet.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {Object.entries(ins.byType)
                          .sort((a, b) => b[1].completed - a[1].completed)
                          .map(([type, v]) => (
                            <div key={type} className="flex items-center gap-2">
                              <span className="text-display w-16 shrink-0 text-[11px] font-bold text-[var(--text-dim)]">
                                {TYPE_LABEL[type] ?? type}
                              </span>
                              <div className="h-3 flex-1 overflow-hidden rounded-full bg-black/40">
                                <motion.div
                                  className="h-full rounded-full"
                                  style={{
                                    background: "linear-gradient(90deg, var(--accent), var(--success))",
                                    boxShadow: "0 0 8px var(--glow)",
                                  }}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(v.completed / maxType) * 100}%` }}
                                  transition={{ delay: 0.3, duration: 0.6 }}
                                />
                              </div>
                              <span className="text-display w-6 shrink-0 text-right text-xs font-black text-[var(--accent-2)]">
                                {v.completed}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* highlights */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {ins.favorite && (
                    <Chip icon="star" color="var(--success)" text={`Favorite: ${TYPE_LABEL[ins.favorite] ?? ins.favorite}`} />
                  )}
                  {ins.hardest && ins.hardest !== ins.favorite && (
                    <Chip icon="flame" color="var(--gold)" text={`Encourage: ${TYPE_LABEL[ins.hardest] ?? ins.hardest}`} />
                  )}
                  {ins.profile.streak_days >= 3 && (
                    <Chip icon="flame" color="var(--danger)" text={`${ins.profile.streak_days}-day streak`} />
                  )}
                </div>
              </SectionCard>
            );
          })}
        </>
      )}

      <Tour steps={PARENT_STEPS} active={parentTour.active} onDone={parentTour.onDone} tone="parent" />
    </div>
  );
}

function AttentionCard({
  href,
  icon,
  count,
  label,
}: {
  href: string;
  icon: string;
  count: number;
  label: string;
}) {
  return (
    <Link href={href}>
      <div
        className={`panel flex items-center gap-3 p-4 transition-colors hover:bg-black/25 ${
          count > 0 ? "ring-1 ring-[var(--accent-2)]/40" : ""
        }`}
      >
        <div
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
          style={{ background: count > 0 ? "var(--glow-soft)" : "rgba(0,0,0,0.25)" }}
        >
          <Icon name={icon} size={32} art muted className={count > 0 ? "" : "opacity-45"} />
        </div>
        <div>
          <p className="text-display text-2xl font-black">{count}</p>
          <p className="text-xs font-bold text-[var(--text-dim)]">{label}</p>
        </div>
      </div>
    </Link>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-black/25 px-3 py-2.5 text-center">
      <div className="text-display text-2xl font-black text-[var(--accent-2)]">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{label}</div>
    </div>
  );
}

function Chip({ icon, color, text }: { icon: string; color: string; text: string }) {
  return (
    <span
      className="text-display flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold"
      style={{ background: "rgba(0,0,0,0.3)", color }}
    >
      <Icon art muted name={icon} size={13} /> {text}
    </span>
  );
}
