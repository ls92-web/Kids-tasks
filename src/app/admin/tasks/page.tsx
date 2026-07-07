"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorld } from "@/components/ThemeProvider";
import { GameButton } from "@/components/GameButton";
import { Icon } from "@/components/Icon";
import { Input, TextArea, Select, SectionCard, EmptyNote } from "@/components/admin/ui";
import { Profile, Task, TASK_TYPES, DIFFICULTY, Difficulty } from "@/lib/game";

const DIFF_DEFAULTS: Record<Difficulty, { coins: number; xp: number }> = {
  easy: { coins: 10, xp: 20 },
  medium: { coins: 20, xp: 45 },
  hard: { coins: 40, xp: 90 },
  epic: { coins: 80, xp: 180 },
};

export default function TasksAdmin() {
  const { profile } = useWorld();
  const [children, setChildren] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [form, setForm] = useState({
    child_id: "",
    title: "",
    description: "",
    task_type: "chore",
    difficulty: "easy" as Difficulty,
    est_minutes: "15",
    coin_reward: "10",
    xp_reward: "20",
    deadline: "",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    if (!profile) return;
    const supabase = createClient();
    const [{ data: kids }, { data: t }] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("family_id", profile.family_id)
        .eq("role", "child"),
      supabase
        .from("tasks")
        .select("*")
        .eq("family_id", profile.family_id)
        .order("created_at", { ascending: false })
        .limit(60),
    ]);
    setChildren((kids as Profile[]) ?? []);
    setTasks((t as Task[]) ?? []);
    setForm((f) => ({ ...f, child_id: f.child_id || (kids?.[0]?.id ?? "") }));
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  function setDifficulty(d: Difficulty) {
    setForm((f) => ({
      ...f,
      difficulty: d,
      coin_reward: String(DIFF_DEFAULTS[d].coins),
      xp_reward: String(DIFF_DEFAULTS[d].xp),
    }));
  }

  async function createTask() {
    if (!profile || !form.child_id || form.title.trim().length < 2) return;
    setBusy(true);
    setMsg("");
    const supabase = createClient();
    const { error } = await supabase.from("tasks").insert({
      family_id: profile.family_id,
      child_id: form.child_id,
      title: form.title.trim(),
      description: form.description.trim(),
      task_type: form.task_type,
      difficulty: form.difficulty,
      est_minutes: parseInt(form.est_minutes, 10) || 15,
      coin_reward: parseInt(form.coin_reward, 10) || 10,
      xp_reward: parseInt(form.xp_reward, 10) || 20,
      deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      created_by: profile.id,
    });
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setForm((f) => ({ ...f, title: "", description: "", deadline: "" }));
    setMsg("Quest assigned.");
    load();
  }

  async function removeTask(id: string) {
    const supabase = createClient();
    await supabase.from("tasks").delete().eq("id", id);
    load();
  }

  const childName = (id: string) => children.find((c) => c.id === id)?.nickname ?? "?";

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-display text-2xl font-black">Quests</h1>

      <SectionCard title="Assign a quest" subtitle="Rewards auto-fill from difficulty — tweak freely">
        {children.length === 0 ? (
          <EmptyNote>Create a hero first, then assign quests.</EmptyNote>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="Hero"
                value={form.child_id}
                onChange={(e) => setForm((f) => ({ ...f, child_id: e.target.value }))}
              >
                {children.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nickname}
                  </option>
                ))}
              </Select>
              <Select
                label="Type"
                value={form.task_type}
                onChange={(e) => setForm((f) => ({ ...f, task_type: e.target.value }))}
              >
                {TASK_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
              <div className="sm:col-span-2">
                <Input
                  label="Title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Make your bed"
                />
              </div>
              <div className="sm:col-span-2">
                <TextArea
                  label="Description"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Pull the covers neat and place the pillows at the top"
                />
              </div>
            </div>

            <p className="text-display mb-1.5 mt-4 text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]">
              Difficulty
            </p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(DIFFICULTY) as Difficulty[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`text-display cursor-pointer rounded-xl px-4 py-2 text-sm font-bold capitalize transition-all ${
                    form.difficulty === d ? "text-white" : "bg-black/25 text-[var(--text-dim)]"
                  }`}
                  style={
                    form.difficulty === d
                      ? {
                          background: "linear-gradient(160deg, var(--accent), var(--accent-deep))",
                          boxShadow: "0 0 16px -4px var(--glow)",
                        }
                      : {}
                  }
                >
                  {DIFFICULTY[d].label}
                </button>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Input
                label="Minutes"
                value={form.est_minutes}
                onChange={(e) => setForm((f) => ({ ...f, est_minutes: e.target.value }))}
              />
              <Input
                label="Coins"
                value={form.coin_reward}
                onChange={(e) => setForm((f) => ({ ...f, coin_reward: e.target.value }))}
              />
              <Input
                label="XP"
                value={form.xp_reward}
                onChange={(e) => setForm((f) => ({ ...f, xp_reward: e.target.value }))}
              />
              <Input
                label="Deadline"
                type="datetime-local"
                value={form.deadline}
                onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
              />
            </div>

            {msg && <p className="mt-3 text-sm font-bold text-[var(--accent-2)]">{msg}</p>}
            <div className="mt-4">
              <GameButton onClick={createTask} disabled={busy || !form.title.trim()}>
                {busy ? "Assigning..." : "Assign Quest"}
              </GameButton>
            </div>
          </>
        )}
      </SectionCard>

      <SectionCard title="All quests">
        {tasks.length === 0 ? (
          <EmptyNote>No quests yet.</EmptyNote>
        ) : (
          <div className="flex flex-col gap-2">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-xl bg-black/20 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-display truncate text-sm font-bold">{t.title}</p>
                  <p className="text-xs text-[var(--text-dim)]">
                    {childName(t.child_id)} — {t.task_type} — {t.status} — +{t.coin_reward}c / +
                    {t.xp_reward}xp
                  </p>
                </div>
                <span
                  className="text-display shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase"
                  style={{
                    color:
                      t.status === "completed"
                        ? "var(--success)"
                        : t.status === "needs_review"
                          ? "var(--gold)"
                          : "var(--text-dim)",
                    background: "rgba(0,0,0,0.3)",
                  }}
                >
                  {t.status.replace("_", " ")}
                </span>
                <button
                  onClick={() => removeTask(t.id)}
                  className="shrink-0 cursor-pointer text-[var(--text-dim)] transition-colors hover:text-[var(--danger)]"
                  title="Delete quest"
                >
                  <Icon name="x" size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
