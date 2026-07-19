"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorld } from "@/components/ThemeProvider";
import { Icon } from "@/components/Icon";
import { Input, TextArea, Select, SectionCard, EmptyNote, AdminButton } from "@/components/admin/ui";
import { Callout } from "@/components/Callout";
import {
  Profile,
  Task,
  TASK_TYPES,
  DIFFICULTY,
  Difficulty,
  QuestSchedule,
  QuestSlot,
  WEEKDAY_LABELS,
  WEEKDAY_PRESETS,
  PRAYER_SLOTS,
  QuestEvidence,
  QuestVerifier,
  EVIDENCE_OPTIONS,
  VERIFIER_OPTIONS,
} from "@/lib/game";
import {
  QUEST_LIBRARY,
  PILLARS,
  profileDifficulty,
  profileRoutine,
  scheduleRoutine,
  defaultPillar,
  verificationFromText,
  ScheduleHint,
} from "@/lib/questLibrary";

const DIFF_DEFAULTS: Record<Difficulty, { coins: number; xp: number; minutes: number }> = {
  easy: { coins: 10, xp: 20, minutes: 10 },
  medium: { coins: 20, xp: 45, minutes: 20 },
  hard: { coins: 40, xp: 90, minutes: 40 },
  epic: { coins: 80, xp: 180, minutes: 60 },
};

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const DEFAULT_SLOTS: QuestSlot[] = [{ key: "default", label: "", time: null }];

/* A short, stable key for a newly-added slot. Existing slots keep their keys
   forever (they anchor de-duplication); only fresh slots get a new one. */
function newSlotKey(): string {
  const rnd =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Math.floor(Math.random() * 1e9).toString(36);
  return `s_${rnd}`;
}

function weekdaySummary(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  const key = sorted.join(",");
  if (key === "0,1,2,3,4,5,6") return "Every day";
  if (key === "0,1,2,3,4") return "Sun–Thu";
  if (key === "5,6") return "Weekend (Fri–Sat)";
  return sorted.map((d) => WEEKDAY_LABELS[d]).join(", ");
}

export default function TasksAdmin() {
  const { profile } = useWorld();
  const [children, setChildren] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [schedules, setSchedules] = useState<QuestSchedule[]>([]);
  // text-only quest history (approved/not approved/expired), last 2 months —
  // photos and voice recordings are purged as soon as a quest is approved
  const [history, setHistory] = useState<Task[]>([]);
  const [historyHero, setHistoryHero] = useState("");
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
  // recurring-quest (routine) state — only used when `repeat` is on
  const [repeat, setRepeat] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>(EVERY_DAY);
  const [slots, setSlots] = useState<QuestSlot[]>(DEFAULT_SLOTS);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [libProfileId, setLibProfileId] = useState("");
  // hidden development-pillar metadata: from the library profile when one is
  // picked, otherwise derived from task_type at save time (v1: no UI field)
  const [libPillar, setLibPillar] = useState<string | null>(null);
  // confirmation method — a new custom quest defaults to Parent + no evidence
  const [evidence, setEvidence] = useState<QuestEvidence>("none");
  const [verifier, setVerifier] = useState<QuestVerifier>("parent");
  const [aiBusy, setAiBusy] = useState(false);
  const [busy, setBusy] = useState(false);

  // v1 rules, enforced by auto-correction (and the DB check constraint):
  // AI verification requires photo evidence; voice/none are parent-only.
  function chooseEvidence(e: QuestEvidence) {
    setEvidence(e);
    if (e !== "photo") setVerifier("parent");
  }
  function chooseVerifier(v: QuestVerifier) {
    setVerifier(v);
    if (v !== "parent") setEvidence("photo");
  }
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const supabase = createClient();
    // materialize any routine occurrences due today (idempotent, family-scoped)
    await supabase.rpc("generate_due_quests");
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: kids }, { data: t }, { data: sc }, { data: hist }] = await Promise.all([
      supabase.from("profiles").select("*").eq("family_id", profile.family_id).eq("role", "child"),
      supabase
        .from("tasks")
        .select("*")
        .eq("family_id", profile.family_id)
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("quest_schedules")
        .select("*")
        .eq("family_id", profile.family_id)
        .order("created_at", { ascending: false }),
      // text-only history: quests that reached a final outcome, last 2 months
      supabase
        .from("tasks")
        .select("*")
        .eq("family_id", profile.family_id)
        .in("status", ["completed", "rejected", "expired"])
        .gte("created_at", sixtyDaysAgo)
        .order("created_at", { ascending: false })
        .limit(300),
    ]);
    setChildren((kids as Profile[]) ?? []);
    setTasks((t as Task[]) ?? []);
    setSchedules((sc as QuestSchedule[]) ?? []);
    setHistory((hist as Task[]) ?? []);
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
      est_minutes: String(DIFF_DEFAULTS[d].minutes),
    }));
  }

  // ---- slot editor helpers ---------------------------------------------------
  function toggleWeekday(d: number) {
    setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d].sort((a, b) => a - b)));
  }
  function addSlot() {
    setSlots((s) => [...s, { key: newSlotKey(), label: "", time: null }]);
  }
  function removeSlot(i: number) {
    setSlots((s) => (s.length <= 1 ? s : s.filter((_, idx) => idx !== i)));
  }
  function setSlotLabel(i: number, label: string) {
    setSlots((s) => s.map((sl, idx) => (idx === i ? { ...sl, label } : sl)));
  }
  function setSlotTime(i: number, time: string) {
    setSlots((s) => s.map((sl, idx) => (idx === i ? { ...sl, time: time || null } : sl)));
  }

  function resetForm() {
    setEditingId(null);
    setLibProfileId("");
    setLibPillar(null);
    setEvidence("none");
    setVerifier("parent");
    setRepeat(false);
    setWeekdays(EVERY_DAY);
    setSlots(DEFAULT_SLOTS);
    setForm((f) => ({ ...f, title: "", description: "", deadline: "" }));
  }

  // ---- pick an Official Library quest from the dropdown ----------------------
  // Auto-fills type, difficulty, coins, XP, minutes and the suggested routine —
  // title & description stay fully editable. Everything remains editable; the
  // economy stays difficulty-based (rewards from DIFF_DEFAULTS), the operational
  // taxonomy stays task_type, and the routine maps onto the existing system.
  function pickLibrary(id: string) {
    setLibProfileId(id);
    if (!id) {
      setLibPillar(null);
      return; // "Custom quest" — leave whatever the parent has typed
    }
    const p = QUEST_LIBRARY.find((q) => q.id === id);
    if (!p) return;
    setLibPillar(p.pillar);
    const v = verificationFromText(p.verification);
    setEvidence(v.evidence);
    setVerifier(v.verifier);
    const diff = profileDifficulty(p);
    const routine = profileRoutine(p);
    setEditingId(null);
    setMsg(null);
    setForm((f) => ({
      ...f,
      title: p.name,
      description: "",
      task_type: p.taskType,
      difficulty: diff,
      coin_reward: String(DIFF_DEFAULTS[diff].coins),
      xp_reward: String(DIFF_DEFAULTS[diff].xp),
      est_minutes: String(DIFF_DEFAULTS[diff].minutes),
      deadline: "",
    }));
    setRepeat(routine.repeat);
    setWeekdays(routine.weekdays);
    setSlots(routine.slots);
  }

  // ---- AI Quest Assistant ----------------------------------------------------
  // Classifies the parent's custom quest against the Official Library and fills
  // type, difficulty, rewards, pillar and a suggested schedule. Recommendations
  // only — every field stays editable, and the AI never assigns anything.
  async function aiSuggest() {
    if (aiBusy || form.title.trim().length < 3) return;
    setAiBusy(true);
    setMsg(null);
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke("classify-quest", {
      body: { title: form.title.trim(), description: form.description.trim() },
    });
    setAiBusy(false);
    const rec = data?.recommendation;
    if (error || !rec) {
      setMsg({ ok: false, text: "The assistant is resting — fill in the quest manually for now." });
      return;
    }
    setForm((f) => ({
      ...f,
      task_type: rec.task_type,
      difficulty: rec.difficulty as Difficulty,
      coin_reward: String(rec.coins),
      xp_reward: String(rec.xp),
      est_minutes: String(rec.est_minutes),
    }));
    setLibPillar(rec.pillar ?? null);
    const v = verificationFromText(rec.verification ?? "");
    setEvidence(v.evidence);
    setVerifier(v.verifier);
    const routine = scheduleRoutine(rec.schedule as ScheduleHint);
    setRepeat(routine.repeat);
    setWeekdays(routine.weekdays);
    setSlots(routine.slots);
    setMsg({
      ok: true,
      text: `AI suggests: ${rec.match ? `like “${rec.match}” — ` : ""}${rec.reason || "classified."} Everything below is editable.`,
    });
  }

  // ---- one-off quest ---------------------------------------------------------
  async function createTask() {
    if (!profile || !form.child_id || form.title.trim().length < 2) return;
    setBusy(true);
    setMsg(null);
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
      pillar: libPillar ?? defaultPillar(form.task_type),
      evidence,
      verifier,
    });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message });
    resetForm();
    setMsg({ ok: true, text: "Quest assigned." });
    load();
  }

  // ---- routine (recurring quest) create / edit -------------------------------
  async function saveRoutine() {
    if (!profile || !form.child_id || form.title.trim().length < 2) return;
    if (weekdays.length === 0) return setMsg({ ok: false, text: "Pick at least one day." });
    // when there is more than one slot each needs a name, so the generated
    // quests are clearly distinct (e.g. "Brush Teeth · Morning")
    const cleanSlots: QuestSlot[] = slots.map((s) => ({
      key: s.key || newSlotKey(),
      label: s.label.trim(),
      time: s.time || null,
    }));
    if (cleanSlots.length > 1 && cleanSlots.some((s) => !s.label)) {
      return setMsg({ ok: false, text: "Give every time of day a name (e.g. Morning, Evening)." });
    }
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const payload = {
      family_id: profile.family_id,
      child_id: form.child_id,
      title: form.title.trim(),
      description: form.description.trim(),
      task_type: form.task_type,
      difficulty: form.difficulty,
      est_minutes: parseInt(form.est_minutes, 10) || 5,
      coin_reward: parseInt(form.coin_reward, 10) || 2,
      xp_reward: parseInt(form.xp_reward, 10) || 5,
      weekdays,
      slots: cleanSlots,
      pillar: libPillar ?? defaultPillar(form.task_type),
      evidence,
      verifier,
    };
    const { error } = editingId
      ? await supabase.from("quest_schedules").update(payload).eq("id", editingId)
      : await supabase.from("quest_schedules").insert({ ...payload, created_by: profile.id });
    if (error) {
      setBusy(false);
      return setMsg({ ok: false, text: error.message });
    }
    // surface today's occurrences immediately
    await supabase.rpc("generate_due_quests");
    setBusy(false);
    const was = editingId;
    resetForm();
    setMsg({ ok: true, text: was ? "Routine updated — future days only." : "Routine created." });
    load();
  }

  function editRoutine(s: QuestSchedule) {
    setEditingId(s.id);
    setLibProfileId("");
    setLibPillar(s.pillar ?? null); // keep the routine's existing pillar on edit
    // legacy routines (nulls) display their equivalent: photo + AI pre-screen + parent
    setEvidence((s.evidence as QuestEvidence) ?? "photo");
    setVerifier((s.verifier as QuestVerifier) ?? "ai_parent");
    setRepeat(true);
    setWeekdays(s.weekdays?.length ? s.weekdays : EVERY_DAY);
    setSlots(s.slots?.length ? s.slots : DEFAULT_SLOTS);
    setForm({
      child_id: s.child_id,
      title: s.title,
      description: s.description,
      task_type: s.task_type,
      difficulty: s.difficulty,
      est_minutes: String(s.est_minutes),
      coin_reward: String(s.coin_reward),
      xp_reward: String(s.xp_reward),
      deadline: "",
    });
    setMsg(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function setRoutineActive(s: QuestSchedule, active: boolean) {
    const supabase = createClient();
    await supabase.from("quest_schedules").update({ active }).eq("id", s.id);
    load();
  }
  async function endRoutine(s: QuestSchedule) {
    const supabase = createClient();
    // stop future generation forever; keep the row and all past quests/history
    await supabase
      .from("quest_schedules")
      .update({ active: false, ended_at: new Date().toISOString() })
      .eq("id", s.id);
    if (editingId === s.id) resetForm();
    load();
  }

  async function removeTask(id: string) {
    const supabase = createClient();
    await supabase.from("tasks").delete().eq("id", id);
    load();
  }

  const childName = (id: string) => children.find((c) => c.id === id)?.nickname ?? "?";
  const primaryAction = repeat ? saveRoutine : createTask;

  const HISTORY_OUTCOME: Record<string, { label: string; color: string; icon: string }> = {
    completed: { label: "Approved", color: "var(--success)", icon: "check" },
    rejected: { label: "Not approved", color: "var(--danger)", icon: "x" },
    expired: { label: "Expired", color: "var(--text-dim)", icon: "clock" },
  };
  const filteredHistory = historyHero ? history.filter((t) => t.child_id === historyHero) : history;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-display text-2xl font-black">Quests</h1>

      <SectionCard
        title={editingId ? "Edit routine" : "Assign a quest"}
        subtitle={
          editingId
            ? "Changes apply to future days only — past quests stay as they are"
            : "Rewards auto-fill from difficulty — tweak freely"
        }
      >
        {children.length === 0 ? (
          <EmptyNote>Create a hero first, then assign quests.</EmptyNote>
        ) : (
          <>
            {!editingId && (
              <div className="mb-3">
                <Select
                  label="Start from the Official Library (optional)"
                  value={libProfileId}
                  onChange={(e) => pickLibrary(e.target.value)}
                >
                  <option value="">Custom quest — write your own</option>
                  {PILLARS.map((pl) => (
                    <optgroup key={pl.id} label={pl.label}>
                      {QUEST_LIBRARY.filter((q) => q.pillar === pl.id).map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-[var(--text-dim)]">
                    Picks a quest and fills type, difficulty, coins, XP and schedule — you can edit everything below.
                  </p>
                  {!libProfileId && form.title.trim().length >= 3 && (
                    <AdminButton size="sm" variant="ghost" onClick={aiSuggest} disabled={aiBusy}>
                      <Icon name="sparkle" size={14} art muted />{" "}
                      {aiBusy ? "Thinking…" : "AI suggestions for this quest"}
                    </AdminButton>
                  )}
                </div>
              </div>
            )}
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
                  onKeyDown={(e) => e.key === "Enter" && !repeat && createTask()}
                  placeholder={repeat ? "Brush Teeth" : "Make your bed"}
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
                  aria-pressed={form.difficulty === d}
                  onClick={() => setDifficulty(d)}
                  className={`text-display min-h-[40px] cursor-pointer rounded-xl px-4 text-sm font-bold capitalize transition-colors ${
                    form.difficulty === d
                      ? "bg-[var(--accent)] text-white"
                      : "bg-black/25 text-[var(--text-dim)] hover:bg-black/40"
                  }`}
                >
                  {DIFFICULTY[d].label}
                </button>
              ))}
            </div>

            {/* confirmation method — evidence + who verifies */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="text-display mb-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]">
                  Proof from your hero
                </p>
                <div className="flex flex-wrap gap-2">
                  {EVIDENCE_OPTIONS.map((o) => (
                    <button
                      key={o.id}
                      aria-pressed={evidence === o.id}
                      onClick={() => chooseEvidence(o.id)}
                      className={`text-display min-h-[40px] cursor-pointer rounded-xl px-4 text-sm font-bold transition-colors ${
                        evidence === o.id
                          ? "bg-[var(--accent)] text-white"
                          : "bg-black/25 text-[var(--text-dim)] hover:bg-black/40"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-display mb-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]">
                  Confirmed by
                </p>
                <div className="flex flex-wrap gap-2">
                  {VERIFIER_OPTIONS.map((o) => {
                    const needsPhoto = o.id !== "parent" && evidence !== "photo";
                    return (
                      <button
                        key={o.id}
                        aria-pressed={verifier === o.id}
                        onClick={() => chooseVerifier(o.id)}
                        title={needsPhoto ? "Selecting this switches proof to Photo" : undefined}
                        className={`text-display min-h-[40px] cursor-pointer rounded-xl px-4 text-sm font-bold transition-colors ${
                          verifier === o.id
                            ? "bg-[var(--accent)] text-white"
                            : "bg-black/25 text-[var(--text-dim)] hover:bg-black/40"
                        }`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[11px] text-[var(--text-dim)]">
                  {verifier === "ai"
                    ? "AI approves clear passes instantly; anything uncertain still comes to you."
                    : verifier === "ai_parent"
                      ? "AI pre-screens the photo, then you make the final call."
                      : evidence === "none"
                        ? "Your hero taps “I did it!” and it comes straight to you."
                        : "The proof comes straight to you for approval."}
                </p>
              </div>
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
              {!repeat && (
                <Input
                  label="Deadline"
                  type="datetime-local"
                  value={form.deadline}
                  onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                />
              )}
            </div>

            {/* routine toggle */}
            <label className="mt-4 flex cursor-pointer items-center gap-2.5 rounded-xl bg-black/20 px-4 py-3">
              <input
                type="checkbox"
                checked={repeat}
                disabled={!!editingId}
                onChange={(e) => setRepeat(e.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              <span className="text-display text-sm font-bold">
                Repeat this quest (routine)
              </span>
              <span className="text-xs text-[var(--text-dim)]">
                auto-creates it on the chosen days
              </span>
            </label>

            {repeat && (
              <div className="mt-3 flex flex-col gap-4 rounded-xl border border-[var(--surface-border)] bg-black/15 p-4">
                {/* weekdays */}
                <div>
                  <p className="text-display mb-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]">
                    Repeat on
                  </p>
                  <div className="mb-2 flex flex-wrap gap-2">
                    {WEEKDAY_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setWeekdays(p.days)}
                        className="text-display cursor-pointer rounded-lg bg-black/30 px-3 py-1.5 text-xs font-bold text-[var(--text-dim)] hover:bg-black/50 hover:text-[var(--text)]"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {WEEKDAY_LABELS.map((lbl, d) => (
                      <button
                        key={d}
                        aria-pressed={weekdays.includes(d)}
                        onClick={() => toggleWeekday(d)}
                        className={`text-display min-h-[36px] w-11 cursor-pointer rounded-lg text-xs font-bold transition-colors ${
                          weekdays.includes(d)
                            ? "bg-[var(--accent)] text-white"
                            : "bg-black/25 text-[var(--text-dim)] hover:bg-black/40"
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* slots */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-display text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]">
                      Times of day
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSlots([{ key: "morning", label: "Morning", time: "07:00" }, { key: "evening", label: "Evening", time: "20:00" }])}
                        className="text-display cursor-pointer rounded-lg bg-black/30 px-2.5 py-1 text-[11px] font-bold text-[var(--text-dim)] hover:bg-black/50 hover:text-[var(--text)]"
                      >
                        Morning &amp; Evening
                      </button>
                      <button
                        onClick={() => setSlots(PRAYER_SLOTS.map((s) => ({ ...s })))}
                        className="text-display cursor-pointer rounded-lg bg-black/30 px-2.5 py-1 text-[11px] font-bold text-[var(--text-dim)] hover:bg-black/50 hover:text-[var(--text)]"
                      >
                        5 daily prayers
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {slots.map((s, i) => (
                      <div key={s.key} className="flex items-center gap-2">
                        <input
                          value={s.label}
                          onChange={(e) => setSlotLabel(i, e.target.value)}
                          placeholder={slots.length > 1 ? "Name (e.g. Morning)" : "Name (optional)"}
                          className="min-w-0 flex-1 rounded-lg border border-[var(--surface-border)] bg-black/30 px-3 py-2 text-sm font-semibold outline-none focus:[box-shadow:0_0_0_2px_var(--glow-soft)]"
                        />
                        <input
                          type="time"
                          value={s.time ?? ""}
                          onChange={(e) => setSlotTime(i, e.target.value)}
                          className="shrink-0 rounded-lg border border-[var(--surface-border)] bg-black/30 px-2 py-2 text-sm font-semibold text-[var(--text-dim)] outline-none focus:[box-shadow:0_0_0_2px_var(--glow-soft)]"
                        />
                        <button
                          onClick={() => removeSlot(i)}
                          disabled={slots.length <= 1}
                          aria-label="Remove this time"
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--text-dim)] transition-colors enabled:cursor-pointer enabled:hover:bg-black/25 enabled:hover:text-[var(--danger)] disabled:opacity-30"
                        >
                          <Icon name="x" size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={addSlot}
                    className="text-display mt-2 flex cursor-pointer items-center gap-1.5 rounded-lg bg-black/25 px-3 py-1.5 text-xs font-bold text-[var(--text-dim)] hover:bg-black/40 hover:text-[var(--text)]"
                  >
                    <Icon name="plus" size={14} /> Add a time
                  </button>
                  <p className="mt-2 text-[11px] text-[var(--text-dim)]">
                    The time is a reminder only — each occurrence stays available until the end of its day.
                  </p>
                </div>
              </div>
            )}

            {msg && (
              <Callout tone={msg.ok ? "success" : "error"} className="mt-3">
                {msg.text}
              </Callout>
            )}
            <div className="mt-4 flex gap-2">
              <AdminButton onClick={primaryAction} disabled={busy || !form.title.trim()}>
                {busy
                  ? "Saving…"
                  : editingId
                    ? "Save routine"
                    : repeat
                      ? "Create routine"
                      : "Assign quest"}
              </AdminButton>
              {(editingId || repeat) && (
                <AdminButton variant="ghost" onClick={resetForm} disabled={busy}>
                  Cancel
                </AdminButton>
              )}
            </div>
          </>
        )}
      </SectionCard>

      {/* routines management */}
      {schedules.length > 0 && (
        <SectionCard title="Routines" subtitle="Repeat automatically — pausing or ending never deletes past quests">
          <div className="flex flex-col gap-2">
            {schedules.map((s) => {
              const ended = !!s.ended_at;
              const slotNames = s.slots
                .map((sl) => sl.label)
                .filter(Boolean)
                .join(" · ");
              return (
                <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-black/25 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-display truncate text-sm font-bold">
                      {s.title}
                      {slotNames && <span className="text-[var(--text-dim)]"> — {slotNames}</span>}
                    </p>
                    <p className="text-xs text-[var(--text-dim)]">
                      {childName(s.child_id)} — {weekdaySummary(s.weekdays)} —{" "}
                      {s.slots.length}×/day — +{s.coin_reward}c / +{s.xp_reward}xp
                    </p>
                  </div>
                  <span
                    className="text-display shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase"
                    style={{
                      color: ended ? "var(--text-dim)" : s.active ? "var(--success)" : "var(--gold)",
                      background: "rgba(0,0,0,0.3)",
                    }}
                  >
                    {ended ? "Ended" : s.active ? "Active" : "Paused"}
                  </span>
                  {!ended && (
                    <>
                      <AdminButton size="sm" variant="ghost" onClick={() => setRoutineActive(s, !s.active)}>
                        {s.active ? "Pause" : "Resume"}
                      </AdminButton>
                      <AdminButton size="sm" variant="ghost" onClick={() => editRoutine(s)}>
                        Edit
                      </AdminButton>
                      <AdminButton size="sm" variant="ghost" onClick={() => endRoutine(s)}>
                        End
                      </AdminButton>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      <SectionCard title="All quests">
        {tasks.length === 0 ? (
          <EmptyNote>No quests yet.</EmptyNote>
        ) : (
          <div className="flex flex-col gap-2">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-xl bg-black/25 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-display truncate text-sm font-bold">
                    {t.title}
                    {t.schedule_id && (
                      <Icon name="refresh" size={12} className="ml-1.5 inline text-[var(--text-dim)]" />
                    )}
                  </p>
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
                  className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg text-[var(--text-dim)] transition-colors hover:bg-black/25 hover:text-[var(--danger)]"
                  title="Delete quest"
                  aria-label={`Delete quest: ${t.title}`}
                >
                  <Icon name="x" size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Quest History"
        subtitle="What each hero has done over the last 2 months — photos and voice recordings are removed once a quest is approved"
      >
        {children.length > 1 && (
          <div className="mb-3">
            <Select
              label="Hero"
              value={historyHero}
              onChange={(e) => setHistoryHero(e.target.value)}
            >
              <option value="">All heroes</option>
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nickname}
                </option>
              ))}
            </Select>
          </div>
        )}
        {filteredHistory.length === 0 ? (
          <EmptyNote>No quest history yet.</EmptyNote>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredHistory.map((t) => {
              const outcome = HISTORY_OUTCOME[t.status] ?? HISTORY_OUTCOME.expired;
              return (
                <div key={t.id} className="flex items-center gap-3 rounded-xl bg-black/25 px-4 py-3">
                  <Icon name={outcome.icon} size={18} art muted className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-display truncate text-sm font-bold">{t.title}</p>
                    <p className="text-xs text-[var(--text-dim)]">
                      {childName(t.child_id)} —{" "}
                      {new Date(t.completed_at ?? t.created_at).toLocaleDateString()}
                      {t.status === "completed" && ` — +${t.coin_reward}c / +${t.xp_reward}xp`}
                    </p>
                  </div>
                  <span
                    className="text-display shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase"
                    style={{ color: outcome.color, background: "rgba(0,0,0,0.3)" }}
                  >
                    {outcome.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
