"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorld } from "@/components/ThemeProvider";
import { Icon } from "@/components/Icon";
import { Input, TextArea, Select, SectionCard, EmptyNote, AdminButton } from "@/components/admin/ui";
import { IconPicker } from "@/components/admin/IconPicker";
import { Portrait } from "@/components/Portrait";
import { Callout } from "@/components/Callout";
import {
  Profile,
  Task,
  TASK_TYPES,
  TASK_TYPE_ICON,
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

/* curated, quest-appropriate slice of the icon pool (public/ui/icons/) */
/* Every option renders DISTINCT art — no two icons in this grid look alike.
   (v1 shipped compass+adventure — two compasses — and heart+health — two
   hearts; old quests storing those ids still render via ICON_ART.) */
const QUEST_ICON_OPTIONS = [
  { id: "home", label: "Home & Chores" },
  { id: "make-bed", label: "Make Bed" },
  { id: "bed", label: "Bedtime" },
  { id: "homework", label: "Homework" },
  { id: "multiplication", label: "Math" },
  { id: "book", label: "Reading" },
  { id: "scroll", label: "Story" },
  { id: "backpack", label: "School" },
  { id: "prayer", label: "Prayer" },
  { id: "quraan", label: "Qur'an" },
  { id: "energy", label: "Energy" },
  { id: "potion", label: "Health" },
  { id: "heart", label: "Kindness" },
  { id: "star", label: "General" },
  { id: "sword", label: "Bravery" },
  { id: "hero", label: "Hero" },
  { id: "hero-shield", label: "Responsibility" },
  { id: "shadow", label: "Evening" },
  { id: "fire", label: "Streak" },
  { id: "family", label: "Family" },
  { id: "friends", label: "Friends" },
  { id: "mail", label: "Message" },
  { id: "shop", label: "Shopping" },
  { id: "nature", label: "Outdoors" },
  { id: "ice", label: "Winter" },
  { id: "world", label: "World" },
  { id: "compass", label: "Adventure" },
  { id: "treasure-map", label: "Journey" },
  { id: "celebration", label: "Celebration" },
  { id: "quest-scroll", label: "Quest" },
  { id: "quest-target", label: "Goal" },
  { id: "mission-complete", label: "Mission" },
  { id: "checkpoint", label: "Checkpoint" },
  { id: "destination", label: "Destination" },
  { id: "tasks", label: "Tasks" },
  { id: "calendar", label: "Schedule" },
  { id: "time", label: "Time" },
  { id: "camera", label: "Photo" },
  { id: "magic", label: "Magic" },
  { id: "crystal-ball", label: "Wonder" },
];

/* one status → row-badge lookup shared by both the Current and History
   views of the merged Quests list (see QuestRow below). */
const QUEST_ROW_META: Record<string, { label: string; color: string; icon: string }> = {
  active: { label: "Active", color: "var(--accent-2)", icon: "sword" },
  submitted: { label: "Pending Review", color: "var(--gold)", icon: "eye" },
  needs_review: { label: "Pending Review", color: "var(--gold)", icon: "eye" },
  completed: { label: "Approved", color: "var(--success)", icon: "check" },
  rejected: { label: "Rejected", color: "var(--danger)", icon: "x" },
  expired: { label: "Expired", color: "var(--text-dim)", icon: "clock" },
};

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const DEFAULT_SLOTS: QuestSlot[] = [{ key: "default", label: "", time: null }];

/* datetime-local inputs want local (not UTC) "YYYY-MM-DDTHH:mm". */
function toLocalDatetimeValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* A sensible starting deadline for a brand-new one-off quest — tomorrow, same
   time. The parent can freely change it, but every quest now leaves this
   form with a real deadline set. */
function defaultDeadlineValue(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setSeconds(0, 0);
  return toLocalDatetimeValue(d);
}

/* The next upcoming calendar date that falls on weekday `d` (0=Sun…6=Sat,
   today counts) — shown under each day toggle so "Sun" reads as an exact
   date, not an ambiguous recurring label. */
function nextDateForWeekday(d: number): string {
  const now = new Date();
  const delta = (d - now.getDay() + 7) % 7;
  const target = new Date(now);
  target.setDate(now.getDate() + delta);
  return target.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
}

/* A short, stable key for a newly-added slot. Existing slots keep their keys
   forever (they anchor de-duplication); only fresh slots get a new one. */
function newSlotKey(): string {
  const rnd =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Math.floor(Math.random() * 1e9).toString(36);
  return `s_${rnd}`;
}

/* Safari reports a dead network request as "TypeError: Load failed" and
   Chrome as "Failed to fetch" — translate both into something a parent can
   act on. Real server-side errors pass through untouched. */
function friendlyError(message: string): string {
  return /load failed|failed to fetch|network|fetch/i.test(message)
    ? "Couldn't reach WonderNest — check your internet connection and try again."
    : message;
}

function weekdaySummary(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  const key = sorted.join(",");
  if (key === "0,1,2,3,4,5,6") return "Every day";
  if (key === "0,1,2,3,4") return "Sun–Thu";
  if (key === "5,6") return "Weekend (Fri–Sat)";
  return sorted.map((d) => WEEKDAY_LABELS[d]).join(", ");
}

/* One row shared by the Quests page's Current and History views — same
   appearance either way; History just omits the delete button. */
function QuestRow({
  task,
  childName,
  readOnly,
  onDelete,
}: {
  task: Task;
  childName: string;
  readOnly: boolean;
  onDelete: () => void;
}) {
  const meta = QUEST_ROW_META[task.status] ?? QUEST_ROW_META.expired;
  return (
    <div className="flex items-center gap-3 rounded-xl bg-black/25 px-4 py-3">
      <Icon name={meta.icon} size={18} art muted className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-display truncate text-sm font-bold">
          {task.title}
          {task.schedule_id && (
            <Icon name="refresh" size={12} className="ml-1.5 inline text-[var(--text-dim)]" />
          )}
        </p>
        <p className="text-xs text-[var(--text-dim)]">
          {childName} — {task.task_type} —{" "}
          {new Date(task.completed_at ?? task.created_at).toLocaleDateString()}
          {task.status === "completed" && (
            <>
              {" — "}
              <b className="font-black text-[var(--gold)]">+{task.coin_reward}c</b>{" "}
              <b className="font-black text-[var(--accent-2)]">+{task.xp_reward}xp</b>
            </>
          )}
        </p>
      </div>
      <span
        className="text-display shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase"
        style={{ color: meta.color, background: "rgba(0,0,0,0.3)" }}
      >
        {meta.label}
      </span>
      {!readOnly && (
        <button
          onClick={onDelete}
          className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg text-[var(--text-dim)] transition-colors hover:bg-black/25 hover:text-[var(--danger)]"
          title="Delete quest"
          aria-label={`Delete quest: ${task.title}`}
        >
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  );
}

export default function TasksAdmin() {
  const { profile } = useWorld();
  const [children, setChildren] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [schedules, setSchedules] = useState<QuestSchedule[]>([]);
  // text-only quest history (approved, last 2 months) — photos and voice
  // recordings are purged as soon as a quest is approved
  const [history, setHistory] = useState<Task[]>([]);
  const [form, setForm] = useState({
    child_id: "",
    title: "",
    description: "",
    task_type: "chore",
    difficulty: "easy" as Difficulty,
    est_minutes: "15",
    coin_reward: "10",
    xp_reward: "20",
    deadline: defaultDeadlineValue(),
    icon: TASK_TYPE_ICON.chore,
  });
  // a one-off quest's deadline is optional — unchecked = infinite quest,
  // stays active until the parent completes/deletes it by hand
  const [hasDeadline, setHasDeadline] = useState(true);
  // parent-marked Main Quest — shown first on the child's board (one-offs only)
  const [priority, setPriority] = useState(false);
  // the assign form starts collapsed so the page opens on the hero cards
  const [formOpen, setFormOpen] = useState(false);
  // per-hero card view chip: which slice of that hero's quests is showing
  const [heroChip, setHeroChip] = useState<Record<string, "todo" | "waiting" | "done" | "missed">>({});
  // routine row expanded to show today's individual occurrences
  const [openRoutine, setOpenRoutine] = useState<string | null>(null);
  // recurring-quest (routine) state — only used when `repeat` is on
  const [repeat, setRepeat] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>(EVERY_DAY);
  const [slots, setSlots] = useState<QuestSlot[]>(DEFAULT_SLOTS);
  // optional auto-end date for the routine — blank = runs until manually ended
  const [scheduleEndsAt, setScheduleEndsAt] = useState("");
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
        .limit(120),
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
    setHasDeadline(true);
    setPriority(false);
    setFormOpen(false);
    setWeekdays(EVERY_DAY);
    setSlots(DEFAULT_SLOTS);
    setScheduleEndsAt("");
    setForm((f) => ({
      ...f,
      title: "",
      description: "",
      deadline: defaultDeadlineValue(),
      icon: TASK_TYPE_ICON[f.task_type] ?? "star",
    }));
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
      deadline: defaultDeadlineValue(),
      icon: TASK_TYPE_ICON[p.taskType] ?? "star",
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
      icon: TASK_TYPE_ICON[rec.task_type] ?? "star",
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
    if (hasDeadline && !form.deadline) return setMsg({ ok: false, text: "Pick an end date, or turn it off for an infinite quest." });
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
      // unchecked "end date" → no deadline: the quest stays active until
      // the parent completes/deletes it by hand, never auto-expires
      deadline: hasDeadline ? new Date(form.deadline).toISOString() : null,
      priority,
      created_by: profile.id,
      pillar: libPillar ?? defaultPillar(form.task_type),
      evidence,
      verifier,
      icon: form.icon,
    });
    setBusy(false);
    if (error) return setMsg({ ok: false, text: friendlyError(error.message) });
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
      icon: form.icon,
      expires_at: scheduleEndsAt ? new Date(scheduleEndsAt).toISOString() : null,
    };
    const { error } = editingId
      ? await supabase.from("quest_schedules").update(payload).eq("id", editingId)
      : await supabase.from("quest_schedules").insert({ ...payload, created_by: profile.id });
    if (error) {
      setBusy(false);
      return setMsg({ ok: false, text: friendlyError(error.message) });
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
    setFormOpen(true);
    setLibProfileId("");
    setLibPillar(s.pillar ?? null); // keep the routine's existing pillar on edit
    // legacy routines (nulls) display their equivalent: photo + AI pre-screen + parent
    setEvidence((s.evidence as QuestEvidence) ?? "photo");
    setVerifier((s.verifier as QuestVerifier) ?? "ai_parent");
    setRepeat(true);
    setWeekdays(s.weekdays?.length ? s.weekdays : EVERY_DAY);
    setSlots(s.slots?.length ? s.slots : DEFAULT_SLOTS);
    setScheduleEndsAt(s.expires_at ? toLocalDatetimeValue(new Date(s.expires_at)) : "");
    setForm({
      child_id: s.child_id,
      title: s.title,
      description: s.description,
      task_type: s.task_type,
      difficulty: s.difficulty,
      est_minutes: String(s.est_minutes),
      coin_reward: String(s.coin_reward),
      xp_reward: String(s.xp_reward),
      deadline: defaultDeadlineValue(),
      icon: s.icon ?? TASK_TYPE_ICON[s.task_type] ?? "star",
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

  const primaryAction = repeat ? saveRoutine : createTask;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-display text-2xl font-black">Quests</h1>
        {/* the page opens on the hero cards; assigning is one tap away */}
        {!formOpen && (
          <AdminButton onClick={() => setFormOpen(true)}>
            <Icon name="plus" size={15} className="mr-1 inline" /> New Quest
          </AdminButton>
        )}
      </div>

      {formOpen && (
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
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    task_type: e.target.value,
                    icon: TASK_TYPE_ICON[e.target.value] ?? "star",
                  }))
                }
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
              <div className="sm:col-span-2">
                <IconPicker
                  label="Quest icon"
                  options={QUEST_ICON_OPTIONS}
                  value={form.icon}
                  onChange={(icon) => setForm((f) => ({ ...f, icon }))}
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
              {!repeat && hasDeadline && (
                <Input
                  label="Deadline"
                  type="datetime-local"
                  value={form.deadline}
                  onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                />
              )}
            </div>

            {/* deadline is opt-in: unticked = an infinite quest that stays
                active until the parent completes or deletes it by hand */}
            {!repeat && (
              <label className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-xl bg-black/20 px-4 py-3">
                <input
                  type="checkbox"
                  checked={hasDeadline}
                  onChange={(e) => {
                    setHasDeadline(e.target.checked);
                    if (e.target.checked && !form.deadline) {
                      setForm((f) => ({ ...f, deadline: defaultDeadlineValue() }));
                    }
                  }}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                <span className="text-display text-sm font-bold">Give this quest an end date</span>
                <span className="text-xs text-[var(--text-dim)]">
                  {hasDeadline ? "unchecked = no end date" : "stays active until you complete or delete it"}
                </span>
              </label>
            )}

            {/* Main Quest flag — shows first on the child's board, in its own
                spotlight section. Routines never carry it (Daily Training). */}
            {!repeat && (
              <label className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-xl bg-black/20 px-4 py-3">
                <input
                  type="checkbox"
                  checked={priority}
                  onChange={(e) => setPriority(e.target.checked)}
                  className="h-4 w-4 accent-[var(--gold)]"
                />
                <span className="text-display text-sm font-bold">
                  <Icon art name="star" size={15} className="mr-1 inline" />
                  Main quest
                </span>
                <span className="text-xs text-[var(--text-dim)]">
                  shown first on your hero&apos;s board — for the quests that matter most
                </span>
              </label>
            )}

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
                        title={`Next ${lbl}: ${nextDateForWeekday(d)}`}
                        className={`text-display flex min-h-[36px] w-14 cursor-pointer flex-col items-center justify-center rounded-lg text-xs font-bold leading-tight transition-colors ${
                          weekdays.includes(d)
                            ? "bg-[var(--accent)] text-white"
                            : "bg-black/25 text-[var(--text-dim)] hover:bg-black/40"
                        }`}
                      >
                        <span>{lbl}</span>
                        <span
                          className={`text-[9px] font-semibold normal-case ${
                            weekdays.includes(d) ? "text-white/70" : "text-[var(--text-dim)]/70"
                          }`}
                        >
                          {nextDateForWeekday(d)}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px] text-[var(--text-dim)]">
                    Dates shown are the next upcoming occurrence of each day.
                  </p>
                </div>

                {/* optional auto-end date */}
                <div>
                  <Input
                    label="Ends on (optional)"
                    type="datetime-local"
                    value={scheduleEndsAt}
                    onChange={(e) => setScheduleEndsAt(e.target.value)}
                  />
                  <p className="mt-1.5 text-[11px] text-[var(--text-dim)]">
                    Leave blank to repeat indefinitely — you can always pause or end it later.
                  </p>
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
              <AdminButton
                onClick={primaryAction}
                disabled={busy || !form.title.trim() || (!repeat && hasDeadline && !form.deadline)}
              >
                {busy
                  ? "Saving…"
                  : editingId
                    ? "Save routine"
                    : repeat
                      ? "Create routine"
                      : "Assign quest"}
              </AdminButton>
              <AdminButton variant="ghost" onClick={resetForm} disabled={busy}>
                Cancel
              </AdminButton>
            </div>
          </>
        )}
      </SectionCard>
      )}

      {/* one card per hero: their routines (collapsed to a progress row each)
          and their one-off quests, sliced by the To do / Waiting / Done /
          Missed chips. No more one flat stream mixing every kid together. */}
      {children.map((hero) => {
        const chip = heroChip[hero.id] ?? "todo";
        const heroTasks = tasks.filter((t) => t.child_id === hero.id);
        const heroHistory = history.filter((t) => t.child_id === hero.id);
        const heroSchedules = schedules.filter((s) => s.child_id === hero.id && !s.ended_at);
        const today = new Date();
        const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        const isToday = (d: string | null | undefined) =>
          !!d && new Date(d).toDateString() === today.toDateString();

        // scoreboard — the hero's whole day at a glance (routines included)
        const todoCount = heroTasks.filter((t) => t.status === "active" || t.status === "rejected").length;
        const waitingCount = heroTasks.filter((t) => t.status === "submitted" || t.status === "needs_review").length;
        const doneToday = heroTasks.filter((t) => t.status === "completed" && isToday(t.completed_at)).length;

        // chip slices — routine occurrences stay OUT of the one-off lists
        // (their routine's summary row owns them); Done/Missed show everything
        const oneOff = (t: Task) => !t.schedule_id;
        const rows =
          chip === "todo"
            ? heroTasks.filter((t) => oneOff(t) && (t.status === "active" || t.status === "rejected" || t.status === "expired"))
            : chip === "waiting"
              ? heroTasks.filter((t) => t.status === "submitted" || t.status === "needs_review")
              : chip === "done"
                ? heroHistory.filter((t) => t.status === "completed")
                : heroHistory.filter((t) => t.status === "expired" || t.status === "rejected");

        const CHIPS = [
          { id: "todo", label: `To do${todoCount ? ` · ${todoCount}` : ""}` },
          { id: "waiting", label: `Waiting${waitingCount ? ` · ${waitingCount}` : ""}` },
          { id: "done", label: "Done" },
          { id: "missed", label: "Missed" },
        ] as const;

        return (
          <SectionCard
            key={hero.id}
            title={
              <span className="flex items-center gap-2.5">
                <Portrait species={hero.pet} size={34} />
                {hero.nickname}
              </span>
            }
            subtitle={`${todoCount} to do · ${waitingCount} waiting · ${doneToday} done today`}
          >
            {/* routines — one row each, with today's progress */}
            {chip === "todo" && heroSchedules.length > 0 && (
              <div className="mb-3 flex flex-col gap-2">
                {heroSchedules.map((s) => {
                  const occurrences = heroTasks.filter(
                    (t) => t.schedule_id === s.id && t.occurrence_date === todayISO
                  );
                  const doneCount = occurrences.filter((t) => t.status === "completed").length;
                  const runsToday = s.weekdays.includes(today.getDay());
                  const open = openRoutine === s.id;
                  return (
                    <div key={s.id} className="rounded-xl bg-black/25 px-4 py-3">
                      {/* line 1: icon + title + meta — full width so the title
                          never gets crushed to two letters on a phone */}
                      <button
                        onClick={() => setOpenRoutine(open ? null : s.id)}
                        className="flex w-full cursor-pointer items-center gap-3 text-left"
                        title={open ? "Hide today's quests" : "Show today's quests"}
                      >
                        <Icon art name={s.icon ?? TASK_TYPE_ICON[s.task_type] ?? "star"} size={26} className="shrink-0" muted />
                        <span className="min-w-0 flex-1">
                          <span className="text-display block truncate text-sm font-bold">
                            {s.title}
                            {!s.active && <span className="ml-2 text-[10px] font-black uppercase text-[var(--gold)]">Paused</span>}
                          </span>
                          {/* meta wraps as whole chunks, never letter-by-letter */}
                          <span className="flex flex-wrap items-baseline gap-x-2 text-xs text-[var(--text-dim)]">
                            <span>{weekdaySummary(s.weekdays)}</span>
                            <span>{s.slots.length}×/day</span>
                            <b className="font-black text-[var(--gold)]">+{s.coin_reward}c</b>
                            <b className="font-black text-[var(--accent-2)]">+{s.xp_reward}xp</b>
                            {s.expires_at && <span>ends {new Date(s.expires_at).toLocaleDateString()}</span>}
                          </span>
                        </span>
                      </button>
                      {/* line 2: today's progress + the routine controls */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        {runsToday && occurrences.length > 0 ? (
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-16 overflow-hidden rounded-full bg-black/40">
                              <span
                                className="block h-full rounded-full"
                                style={{
                                  width: `${(doneCount / occurrences.length) * 100}%`,
                                  background: "linear-gradient(90deg, var(--accent-deep), var(--success))",
                                }}
                              />
                            </span>
                            <span className="text-display text-xs font-black text-[var(--text-dim)]">
                              {doneCount}/{occurrences.length} today
                            </span>
                          </span>
                        ) : (
                          <span className="text-display text-[10px] font-bold uppercase text-[var(--text-dim)]">
                            {s.active ? "Rest day" : "Paused"}
                          </span>
                        )}
                        <span className="flex-1" />
                        <AdminButton size="sm" variant="ghost" onClick={() => setRoutineActive(s, !s.active)}>
                          {s.active ? "Pause" : "Resume"}
                        </AdminButton>
                        <AdminButton size="sm" variant="ghost" onClick={() => editRoutine(s)}>
                          Edit
                        </AdminButton>
                        <AdminButton size="sm" variant="ghost" onClick={() => endRoutine(s)}>
                          End
                        </AdminButton>
                      </div>
                      {open && occurrences.length > 0 && (
                        <div className="mt-2 flex flex-col gap-2 border-t border-[var(--surface-border)] pt-2">
                          {occurrences.map((t) => (
                            <QuestRow
                              key={t.id}
                              task={t}
                              childName={hero.nickname}
                              readOnly={false}
                              onDelete={() => removeTask(t.id)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* chips: which slice of this hero's quests is showing */}
            <div className="mb-3 flex flex-wrap gap-2">
              {CHIPS.map((c) => (
                <button
                  key={c.id}
                  aria-pressed={chip === c.id}
                  onClick={() => setHeroChip((m) => ({ ...m, [hero.id]: c.id }))}
                  className={`text-display cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                    chip === c.id
                      ? "bg-[var(--accent)]/25 text-[var(--text)] ring-1 ring-[var(--accent)]"
                      : "bg-black/25 text-[var(--text-dim)] hover:bg-black/40"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {rows.length === 0 ? (
              <EmptyNote>
                {chip === "todo"
                  ? heroSchedules.length > 0
                    ? "No one-off quests — the routines above carry today."
                    : "Nothing assigned. Tap New Quest to send one."
                  : chip === "waiting"
                    ? "Nothing waiting for review."
                    : chip === "done"
                      ? "No approved quests in the last 2 months yet."
                      : "No missed or rejected quests in the last 2 months."}
              </EmptyNote>
            ) : (
              <div className="flex flex-col gap-2">
                {rows.map((t) => (
                  <QuestRow
                    key={t.id}
                    task={t}
                    childName={hero.nickname}
                    readOnly={chip === "done" || chip === "missed"}
                    onDelete={() => removeTask(t.id)}
                  />
                ))}
              </div>
            )}
          </SectionCard>
        );
      })}
    </div>
  );
}
