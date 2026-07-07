"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorld } from "@/components/ThemeProvider";
import { GameButton } from "@/components/GameButton";
import { Icon } from "@/components/Icon";
import { Input, TextArea, Select, SectionCard, EmptyNote } from "@/components/admin/ui";

interface Challenge {
  id: string;
  title: string;
  description: string;
  metric: string;
  bonus_xp: number;
  starts_at: string;
  ends_at: string;
  status: string;
}

const METRICS = [
  { id: "tasks", label: "Most quests completed" },
  { id: "reading", label: "Reading challenge" },
  { id: "homework", label: "Homework challenge" },
  { id: "cleaning", label: "Cleaning challenge" },
  { id: "habits", label: "Healthy habits challenge" },
];

export default function ChallengesAdmin() {
  const { profile } = useWorld();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    metric: "tasks",
    bonus_xp: "100",
    ends_at: "",
  });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("challenges")
      .select("*")
      .eq("family_id", profile.family_id)
      .order("created_at", { ascending: false });
    setChallenges((data as Challenge[]) ?? []);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  async function createChallenge() {
    if (!profile || form.title.trim().length < 2 || !form.ends_at) return;
    setBusy(true);
    const supabase = createClient();
    await supabase.from("challenges").insert({
      family_id: profile.family_id,
      title: form.title.trim(),
      description: form.description.trim(),
      metric: form.metric,
      bonus_xp: parseInt(form.bonus_xp, 10) || 100,
      ends_at: new Date(form.ends_at).toISOString(),
      created_by: profile.id,
    });
    setBusy(false);
    setForm((f) => ({ ...f, title: "", description: "", ends_at: "" }));
    load();
  }

  async function endChallenge(id: string) {
    const supabase = createClient();
    await supabase.from("challenges").update({ status: "finished" }).eq("id", id);
    load();
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-display text-2xl font-black">Challenges</h1>

      <SectionCard
        title="Start a family challenge"
        subtitle="Heroes join from their map and race for bonus XP"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Reading Week Showdown"
          />
          <Select
            label="Kind"
            value={form.metric}
            onChange={(e) => setForm((f) => ({ ...f, metric: e.target.value }))}
          >
            {METRICS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>
          <div className="sm:col-span-2">
            <TextArea
              label="Description"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Whoever finishes the most reading quests this week wins"
            />
          </div>
          <Input
            label="Bonus XP"
            value={form.bonus_xp}
            onChange={(e) => setForm((f) => ({ ...f, bonus_xp: e.target.value }))}
          />
          <Input
            label="Ends"
            type="datetime-local"
            value={form.ends_at}
            onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
          />
        </div>
        <div className="mt-4">
          <GameButton
            onClick={createChallenge}
            disabled={busy || !form.title.trim() || !form.ends_at}
          >
            {busy ? "Raising the banner..." : "Launch Challenge"}
          </GameButton>
        </div>
      </SectionCard>

      <SectionCard title="All challenges">
        {challenges.length === 0 ? (
          <EmptyNote>No challenges yet.</EmptyNote>
        ) : (
          <div className="flex flex-col gap-2">
            {challenges.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl bg-black/20 px-4 py-3">
                <Icon name="lightning" size={18} className="shrink-0 text-[var(--accent-2)]" />
                <div className="min-w-0 flex-1">
                  <p className="text-display truncate text-sm font-bold">{c.title}</p>
                  <p className="text-xs text-[var(--text-dim)]">
                    {METRICS.find((m) => m.id === c.metric)?.label} — +{c.bonus_xp} XP — ends{" "}
                    {new Date(c.ends_at).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className="text-display shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase"
                  style={{
                    color: c.status === "active" ? "var(--success)" : "var(--text-dim)",
                    background: "rgba(0,0,0,0.3)",
                  }}
                >
                  {c.status}
                </span>
                {c.status === "active" && (
                  <button
                    onClick={() => endChallenge(c.id)}
                    className="shrink-0 cursor-pointer text-xs font-bold text-[var(--text-dim)] hover:text-[var(--danger)]"
                  >
                    End
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
