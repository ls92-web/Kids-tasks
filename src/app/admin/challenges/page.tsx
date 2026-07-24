"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorld } from "@/components/ThemeProvider";
import { Icon } from "@/components/Icon";
import { Input, TextArea, Select, SectionCard, EmptyNote, AdminButton } from "@/components/admin/ui";
import { IconPicker } from "@/components/admin/IconPicker";
import {
  CHALLENGE_LIBRARY,
  ChallengeDuration,
  DURATION_LABEL,
  durationEndsAt,
} from "@/lib/rewardLibrary";

interface Challenge {
  id: string;
  title: string;
  description: string;
  metric: string;
  bonus_xp: number;
  starts_at: string;
  ends_at: string;
  status: string;
  mode: "competitive" | "cooperative";
  goal_target: number | null;
  icon: string | null;
}

const METRICS = [
  { id: "tasks", label: "Most quests completed" },
  { id: "reading", label: "Reading challenge" },
  { id: "homework", label: "Homework challenge" },
  { id: "cleaning", label: "Cleaning challenge" },
  { id: "habits", label: "Healthy habits challenge" },
  // pillar + prayer metrics (count quests by development pillar / prayer type)
  { id: "prayer", label: "Prayer challenge" },
  { id: "faith", label: "Faith challenge" },
  { id: "learning", label: "Learning challenge" },
  { id: "responsibility", label: "Responsibility challenge" },
  { id: "wellbeing", label: "Wellbeing challenge" },
  { id: "character", label: "Character & kindness challenge" },
  { id: "family", label: "Family challenge" },
];

/* metric → default icon slug — the same "same automation" default pattern
   the quest form uses for task_type. */
const METRIC_ICON: Record<string, string> = {
  tasks: "sword",
  reading: "book",
  homework: "multiplication",
  cleaning: "home",
  habits: "energy",
  prayer: "prayer",
  faith: "quraan",
  learning: "quest-target",
  responsibility: "hero-shield",
  wellbeing: "heart",
  character: "star",
  family: "family",
};

/* Curated, challenge-appropriate slice of the icon pool — every option is
   visually distinct (v1 offered trophy AND leaderboard, two identical cups). */
const CHALLENGE_ICON_OPTIONS = [
  { id: "trophy", label: "Trophy" },
  { id: "champion", label: "Crown" },
  { id: "medal", label: "Medal" },
  { id: "legendary", label: "Legendary" },
  { id: "star", label: "General" },
  { id: "sword", label: "Quests" },
  { id: "quest-target", label: "Goal" },
  { id: "mission-complete", label: "Bullseye" },
  { id: "checkpoint", label: "Race Flag" },
  { id: "destination", label: "Finish Line" },
  { id: "flame", label: "Streak" },
  { id: "energy", label: "Habits" },
  { id: "progress", label: "Progress" },
  { id: "xp", label: "XP Boost" },
  { id: "time", label: "Time Trial" },
  { id: "book", label: "Reading" },
  { id: "prayer", label: "Prayer" },
  { id: "quraan", label: "Qur'an" },
  { id: "multiplication", label: "Homework" },
  { id: "home", label: "Cleaning" },
  { id: "hero-shield", label: "Responsibility" },
  { id: "heart", label: "Wellbeing" },
  { id: "family", label: "Family" },
  { id: "friends", label: "Friends" },
  { id: "nature", label: "Outdoors" },
  { id: "ice", label: "Winter" },
  { id: "shadow", label: "Night" },
  { id: "world", label: "World" },
  { id: "celebration", label: "Celebration" },
  { id: "gift", label: "Bonus" },
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
    mode: "competitive" as "competitive" | "cooperative",
    goal_target: "",
    icon: METRIC_ICON.tasks,
  });
  const [libChallengeId, setLibChallengeId] = useState("");
  const [busy, setBusy] = useState(false);

  // ---- pick an Official Library challenge from the dropdown ------------------
  // Auto-fills title, kind, objective, XP goal and the end date from the
  // template's duration — everything stays editable. Only templates the current
  // scoring system can express are offered; scoring itself is unchanged.
  function pickChallengeLibrary(id: string) {
    setLibChallengeId(id);
    if (!id) return; // "Custom challenge" — leave whatever the parent has typed
    const c = CHALLENGE_LIBRARY.find((x) => x.id === id);
    if (!c) return;
    setForm({
      title: c.name,
      description: c.objective,
      metric: c.metric,
      bonus_xp: String(c.bonusXp),
      ends_at: durationEndsAt(c.duration),
      mode: c.mode,
      goal_target: c.goalTarget ? String(c.goalTarget) : "",
      icon: METRIC_ICON[c.metric] ?? "sword",
    });
  }

  function applyDuration(d: ChallengeDuration) {
    setForm((f) => ({ ...f, ends_at: durationEndsAt(d) }));
  }

  const load = useCallback(async () => {
    if (!profile) return;
    const supabase = createClient();
    // settle any naturally-expired challenges first (idempotent, family-scoped)
    await supabase.rpc("settle_challenges");
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
    if (form.mode === "cooperative" && !(parseInt(form.goal_target, 10) > 0)) return;
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
      mode: form.mode,
      goal_target: form.mode === "cooperative" ? parseInt(form.goal_target, 10) : null,
      icon: form.icon,
    });
    setBusy(false);
    setForm((f) => ({ ...f, title: "", description: "", ends_at: "" }));
    setLibChallengeId("");
    load();
  }

  async function endChallenge(id: string) {
    const supabase = createClient();
    // ending early settles with NO award — only natural expiry pays bonus XP
    await supabase
      .from("challenges")
      .update({ status: "finished", settled_at: new Date().toISOString() })
      .eq("id", id);
    load();
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-display text-2xl font-black">Challenges</h1>

      <SectionCard
        title="Start a family challenge"
        subtitle="Heroes join from their map and race to the top of the board"
      >
        <div className="mb-3">
          <Select
            label="Start from the Official Library (optional)"
            value={libChallengeId}
            onChange={(e) => pickChallengeLibrary(e.target.value)}
          >
            <option value="">Custom challenge — write your own</option>
            <optgroup label="Competitive — race for the top">
              {CHALLENGE_LIBRARY.filter((c) => c.mode === "competitive").map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {DURATION_LABEL[c.duration]}
                </option>
              ))}
            </optgroup>
            <optgroup label="Cooperative — one family goal">
              {CHALLENGE_LIBRARY.filter((c) => c.mode === "cooperative").map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {DURATION_LABEL[c.duration]}
                </option>
              ))}
            </optgroup>
          </Select>
          <p className="mt-1 text-[11px] text-[var(--text-dim)]">
            Picks a challenge and fills the title, kind, goal and end date — you can edit everything below.
          </p>
        </div>

        {/* mode — competitive races on a leaderboard, cooperative shares one goal */}
        <div className="mb-3">
          <p className="text-display mb-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]">
            Mode
          </p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: "competitive", label: "Competitive — race for the top" },
                { id: "cooperative", label: "Cooperative — one family goal" },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                aria-pressed={form.mode === m.id}
                onClick={() => setForm((f) => ({ ...f, mode: m.id }))}
                className={`text-display min-h-[40px] cursor-pointer rounded-xl px-4 text-sm font-bold transition-colors ${
                  form.mode === m.id
                    ? "bg-[var(--accent)] text-white"
                    : "bg-black/25 text-[var(--text-dim)] hover:bg-black/40"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

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
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                metric: e.target.value,
                icon: METRIC_ICON[e.target.value] ?? "sword",
              }))
            }
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
          <div className="sm:col-span-2">
            <IconPicker
              label="Challenge icon"
              options={CHALLENGE_ICON_OPTIONS}
              value={form.icon}
              onChange={(icon) => setForm((f) => ({ ...f, icon }))}
            />
          </div>
          {form.mode === "cooperative" && (
            <Input
              label="Family goal (quests together)"
              value={form.goal_target}
              onChange={(e) => setForm((f) => ({ ...f, goal_target: e.target.value }))}
              placeholder="40"
            />
          )}
          <Input
            label={form.mode === "cooperative" ? "Bonus XP (each, on success)" : "Bonus XP (champion)"}
            value={form.bonus_xp}
            onChange={(e) => setForm((f) => ({ ...f, bonus_xp: e.target.value }))}
          />
          <div>
            <Input
              label="Ends"
              type="datetime-local"
              value={form.ends_at}
              onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
            />
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(Object.keys(DURATION_LABEL) as ChallengeDuration[]).map((d) => (
                <button
                  key={d}
                  onClick={() => applyDuration(d)}
                  className="text-display cursor-pointer rounded-lg bg-black/30 px-2.5 py-1 text-[11px] font-bold text-[var(--text-dim)] hover:bg-black/50 hover:text-[var(--text)]"
                >
                  {DURATION_LABEL[d]}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4">
          <AdminButton
            onClick={createChallenge}
            disabled={
              busy ||
              !form.title.trim() ||
              !form.ends_at ||
              (form.mode === "cooperative" && !(parseInt(form.goal_target, 10) > 0))
            }
          >
            {busy ? "Starting…" : "Start challenge"}
          </AdminButton>
        </div>
      </SectionCard>

      <SectionCard title="All challenges">
        {challenges.length === 0 ? (
          <EmptyNote>No challenges yet.</EmptyNote>
        ) : (
          <div className="flex flex-col gap-2">
            {challenges.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl bg-black/25 px-4 py-3">
                <Icon name={c.icon ?? "lightning"} size={20} art muted className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-display truncate text-sm font-bold">{c.title}</p>
                  <p className="text-xs text-[var(--text-dim)]">
                    {METRICS.find((m) => m.id === c.metric)?.label} —{" "}
                    {c.mode === "cooperative"
                      ? `family goal ${c.goal_target ?? "?"} — +${c.bonus_xp} XP each`
                      : `race for the top — +${c.bonus_xp} XP champion`}{" "}
                    — ends {new Date(c.ends_at).toLocaleDateString()}
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
