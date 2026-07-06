"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useWorld } from "@/components/ThemeProvider";
import { CompanionPortrait } from "@/components/CompanionPortrait";
import { Icon } from "@/components/Icon";
import { SectionCard, EmptyNote } from "@/components/admin/ui";
import { MagicLoader } from "@/components/MagicLoader";
import { Profile, Task, levelFromXp, TASK_TYPES } from "@/lib/game";

const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  TASK_TYPES.map((t) => [t.id, t.label])
);

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

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function InsightsPage() {
  const { profile } = useWorld();
  const [children, setChildren] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    (async () => {
      const [{ data: kids }, { data: t }, { data: ach }] = await Promise.all([
        supabase.from("profiles").select("*").eq("family_id", profile.family_id).eq("role", "child"),
        supabase.from("tasks").select("*").eq("family_id", profile.family_id),
        supabase.from("achievements").select("child_id").eq("family_id", profile.family_id),
      ]);
      setChildren((kids as Profile[]) ?? []);
      setTasks((t as Task[]) ?? []);
      const counts: Record<string, number> = {};
      ((ach as { child_id: string }[]) ?? []).forEach((a) => {
        counts[a.child_id] = (counts[a.child_id] ?? 0) + 1;
      });
      setBadgeCounts(counts);
      setLoading(false);
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

  if (loading) {
    return <MagicLoader label="Reading the stars..." />;
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-display text-glow text-2xl font-black">Insights</h1>

      {insights.length === 0 ? (
        <EmptyNote>Create a hero and assign some quests to see insights.</EmptyNote>
      ) : (
        insights.map((ins, idx) => {
          const { level } = levelFromXp(ins.profile.xp);
          const maxBar = Math.max(1, ...ins.weekBars);
          const maxType = Math.max(1, ...Object.values(ins.byType).map((v) => v.completed));
          return (
            <motion.div
              key={ins.profile.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
            >
              <SectionCard title="" subtitle="">
                {/* header */}
                <div className="-mt-2 mb-4 flex items-center gap-3">
                  <CompanionPortrait species={ins.profile.pet} size={48} />
                  <div className="flex-1">
                    <p className="text-display text-lg font-black">{ins.profile.nickname}</p>
                    <p className="text-xs text-[var(--text-dim)]">Level {level}</p>
                  </div>
                </div>

                {/* AI weekly summary */}
                <div className="mb-4 rounded-xl bg-black/20 p-3.5">
                  <p className="text-display mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--accent-2)]">
                    <Icon name="sparkle" size={13} /> This week&apos;s summary
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
                  <div className="rounded-xl bg-black/20 p-4">
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
                          <span className="text-[9px] font-bold text-[var(--text-dim)]">
                            {["S", "M", "T", "W", "T", "F", "S"][new Date(new Date().setDate(new Date().getDate() - (6 - i))).getDay()]}
                          </span>
                          <span className="text-[9px] font-black text-[var(--accent-2)]">{n || ""}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* by type */}
                  <div className="rounded-xl bg-black/20 p-4">
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
            </motion.div>
          );
        })
      )}
    </div>
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
      <Icon name={icon} size={13} /> {text}
    </span>
  );
}
