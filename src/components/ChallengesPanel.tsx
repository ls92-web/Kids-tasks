"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useWorld } from "./ThemeProvider";
import { Icon } from "./Icon";
import { GameButton } from "./GameButton";
import { Profile } from "@/lib/game";

interface Challenge {
  id: string;
  title: string;
  description: string;
  bonus_xp: number;
  ends_at: string;
  participants?: { child_id: string; score: number }[];
}

/* Active family challenges, shown on the Adventure page where "do quests to
   win" belongs. Renders nothing when there are none, so it never adds noise. */
export function ChallengesPanel() {
  const { profile } = useWorld();
  const [heroes, setHeroes] = useState<Profile[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [joined, setJoined] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    (async () => {
      const [{ data: fam }, { data: ch }, { data: parts }] = await Promise.all([
        supabase.from("profiles").select("id, nickname").eq("family_id", profile.family_id).eq("role", "child"),
        supabase.from("challenges").select("*").eq("status", "active").gte("ends_at", new Date().toISOString()),
        supabase.from("challenge_participants").select("*"),
      ]);
      setHeroes((fam as Profile[]) ?? []);
      const partList = (parts as { challenge_id: string; child_id: string; score: number }[]) ?? [];
      setChallenges(
        ((ch as Challenge[]) ?? []).map((c) => ({
          ...c,
          participants: partList.filter((p) => p.challenge_id === c.id),
        }))
      );
      setJoined(new Set(partList.filter((p) => p.child_id === profile.id).map((p) => p.challenge_id)));
    })();
  }, [profile]);

  async function join(c: Challenge) {
    if (!profile) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("challenge_participants")
      .insert({ challenge_id: c.id, child_id: profile.id });
    if (!error) setJoined((j) => new Set([...j, c.id]));
  }

  if (challenges.length === 0) return null;

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Icon name="challenges" size={22} art />
        <h2 className="text-display text-lg font-black">Family Challenges</h2>
        <div className="h-px flex-1 bg-gradient-to-r from-[var(--surface-border)] to-transparent" />
      </div>
      <div className="flex flex-col gap-3">
        {challenges.map((c, i) => {
          const sorted = [...(c.participants ?? [])].sort((a, b) => b.score - a.score);
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="panel p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-display text-lg font-bold">{c.title}</h3>
                  {c.description && <p className="mt-0.5 text-sm text-[var(--text-dim)]">{c.description}</p>}
                  <p className="mt-1 text-xs font-bold text-[var(--accent-2)]">
                    +{c.bonus_xp} bonus XP — ends{" "}
                    {new Date(c.ends_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </p>
                </div>
                {joined.has(c.id) ? (
                  <span className="text-display flex shrink-0 items-center gap-1 rounded-xl bg-black/30 px-3 py-1.5 text-xs font-bold text-[var(--success)]">
                    <Icon art name="check" size={14} /> In
                  </span>
                ) : (
                  <GameButton className="!px-4 !py-2 text-sm" onClick={() => join(c)}>
                    Join
                  </GameButton>
                )}
              </div>
              {sorted.length > 0 && (
                <div className="mt-3 flex flex-col gap-1.5">
                  {sorted.map((p, pi) => {
                    const hero = heroes.find((h) => h.id === p.child_id);
                    if (!hero) return null;
                    return (
                      <div key={p.child_id} className="flex items-center gap-2 rounded-lg bg-black/25 px-3 py-1.5">
                        <span className="text-display w-5 text-xs font-black text-[var(--gold)]">{pi + 1}</span>
                        <span className="text-display flex-1 truncate text-sm font-bold">{hero.nickname}</span>
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-black/40">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, p.score * 10)}%`,
                              background: "var(--accent)",
                              boxShadow: "0 0 8px var(--glow)",
                            }}
                          />
                        </div>
                        <span className="text-xs font-bold text-[var(--text-dim)]">{p.score}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
