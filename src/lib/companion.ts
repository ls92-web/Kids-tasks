/* The companion's brain: warm, personalized messages generated from the
   child's real progress. Fresh every visit — never network-dependent — and
   deliberately avoids repeating the exact line (or even the same TOPIC) it
   used last time, so reopening the app doesn't feel like a rerun. It never
   shames — only celebrates, encourages, and points at the next adventure. */

import { voiceLine, VoiceContext } from "./voices";
import {
  Profile,
  Task,
  ThemeId,
  THEMES,
  COMPANIONS,
  PETS,
  BADGES,
  computeCounts,
  levelFromXp,
  rankName,
} from "./game";

export interface CompanionContext {
  profile: Profile;
  tasks: Task[];
  nextRewardName?: string | null;
  coinsToReward?: number | null;
}

/* Pick a random line from `pool`, but never the same one this key last gave
   out — so reopening the app (or coming back an hour later) reliably reads
   as something new, instead of a 1/N chance of feeling repetitive. Falls
   back to plain random when storage is unavailable (SSR, iOS Block Cookies). */
function pickFresh<T extends string>(pool: T[], key: string): T {
  if (pool.length <= 1) return pool[0];
  try {
    const storeKey = `qf_said_${key}`;
    const last = localStorage.getItem(storeKey);
    const choices = last ? pool.filter((p) => p !== last) : pool;
    const pick = choices[Math.floor(Math.random() * choices.length)];
    localStorage.setItem(storeKey, pick);
    return pick;
  } catch {
    return pool[Math.floor(Math.random() * pool.length)];
  }
}

export function companionGreeting(theme: ThemeId): string {
  const c = COMPANIONS[theme];
  return `${c.name}, ${c.title}`;
}

/* ---------- Event reactions (not AI — tiny prewritten lines) ----------
   Instant, warm, child-friendly one-liners for the moments that matter.
   Anything in the app can call sayFromCompanion(event); the speech bubble
   beside the companion picks it up. Never guilt, never pressure. */

export type CompanionEvent =
  | "open"
  | "questDone"
  | "coins"
  | "levelUp"
  | "allDone"
  | "nodeUnlocked"
  | "evolved"
  | "legendary"
  | "campaignComplete"
  | "worldUnlocked";

/* Every companion answers these moments in its own voice — see
   src/lib/voices.ts for the personalities. */
const EVENT_CONTEXT: Record<CompanionEvent, VoiceContext> = {
  open: "daytime",
  questDone: "questDone",
  coins: "coins",
  levelUp: "levelUp",
  allDone: "allDone",
  nodeUnlocked: "nodeUnlocked",
  evolved: "evolved",
  legendary: "legendary",
  campaignComplete: "campaignComplete",
  worldUnlocked: "worldUnlocked",
};

/** A reaction line for this moment, in this companion's voice. */
export function companionLine(event: CompanionEvent, species: string, name?: string): string {
  return voiceLine(species, EVENT_CONTEXT[event], name);
}

export const COMPANION_SAY_EVENT = "qf-companion-say";

/** Fire-and-forget: the CompanionGuide bubble shows a line for this moment.
    Pass `text` to say something specific (e.g. dream-reward encouragement)
    instead of the event's stock voice line. */
export function sayFromCompanion(event: CompanionEvent, text?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(COMPANION_SAY_EVENT, { detail: { event, text } }));
}

export function companionMessages(ctx: CompanionContext, theme: ThemeId): string[] {
  const { profile, tasks } = ctx;
  const k = (topic: string) => `${profile.id}_${topic}`; // per-child memory key
  const quest = THEMES[theme].questWord.toLowerCase();
  const { level, pct } = levelFromXp(profile.xp);
  const rank = rankName(theme, level);
  const petName = (PETS.find((p) => p.id === profile.pet) ?? PETS[0]).name;
  const messages: string[] = [];

  const today = new Date().toDateString();
  const doneToday = tasks.filter(
    (t) => t.status === "completed" && new Date(t.created_at).toDateString() === today
  ).length;
  const active = tasks.filter((t) => t.status === "active" || t.status === "rejected").length;
  const waiting = tasks.filter(
    (t) => t.status === "submitted" || t.status === "needs_review"
  ).length;
  const hour = new Date().getHours();

  // 1) Opening line — time of day, spoken in THIS companion's voice
  const timeContext: VoiceContext = hour < 12 ? "morning" : hour < 18 ? "daytime" : "evening";
  messages.push(voiceLine(profile.pet, timeContext, profile.nickname));

  // 2) Memory: a true fact worth celebrating — WHICH fact varies visit to
  // visit (never just the highest-priority one, forever), and the phrasing
  // within it varies too. Every candidate here must currently be true.
  const counts = computeCounts(tasks);
  const nearBadge = BADGES.map((b) => ({ b, remaining: b.target - b.progress({ profile, counts }) }))
    .filter((x) => x.remaining > 0 && x.remaining <= 3 && x.b.target <= 260)
    .sort((a, z) => a.remaining - z.remaining)[0];

  const memoryCandidates: { topic: string; lines: string[] }[] = [];
  if (nearBadge) {
    memoryCandidates.push({
      topic: "badge",
      lines: [
        `You're only ${nearBadge.remaining} away from the "${nearBadge.b.title}" badge!`,
        `So close to "${nearBadge.b.title}" — just ${nearBadge.remaining} more to go!`,
        `I can almost see the "${nearBadge.b.title}" badge glowing. ${nearBadge.remaining} left!`,
        `${nearBadge.remaining} more and the "${nearBadge.b.title}" badge is officially yours!`,
      ],
    });
  }
  if (profile.streak_days >= 3) {
    memoryCandidates.push({
      topic: "streak",
      lines: [
        `A ${profile.streak_days}-day streak! ${petName} does a happy little dance every time.`,
        `${profile.streak_days} days in a row — ${petName} is bursting with pride.`,
        `Your flame has burned for ${profile.streak_days} days straight. Guard it well today!`,
        `${profile.streak_days} days strong. You're unstoppable, ${profile.nickname}!`,
      ],
    });
  }
  if (profile.tasks_completed >= 10) {
    memoryCandidates.push({
      topic: "count",
      lines: [
        `${profile.tasks_completed} ${quest}s conquered so far. I remember every single one.`,
        `You've completed ${profile.tasks_completed} ${quest}s since we met. The realm remembers.`,
        `A true ${rank} — ${profile.tasks_completed} victories and counting.`,
        `${profile.tasks_completed} ${quest}s down. Every single one made us stronger.`,
      ],
    });
  }
  if (pct >= 60) {
    memoryCandidates.push({
      topic: "level",
      lines: [
        `You're so close to level ${level + 1} — I can almost see it glowing.`,
        `Level ${level + 1} is just over the hill. One good push!`,
        `Almost level ${level + 1}! I can feel the magic building.`,
      ],
    });
  }
  if (memoryCandidates.length > 0) {
    // rotate WHICH true fact is shared, not only the phrasing of one
    const topics = memoryCandidates.map((c) => c.topic);
    const chosenTopic = pickFresh(topics, k("memory_topic"));
    const chosen = memoryCandidates.find((c) => c.topic === chosenTopic)!;
    messages.push(pickFresh(chosen.lines, k(`memory_${chosen.topic}`)));
  }

  // 3) A gentle nudge toward what's next — never pressure
  if (doneToday > 0 && active === 0 && waiting === 0) {
    messages.push(voiceLine(profile.pet, "allDone", profile.nickname));
  } else if (waiting > 0 && active === 0) {
    messages.push(
      pickFresh(
        [
          `Your proof is with the grown-ups now. I have a good feeling about it.`,
          `The council is looking at your work — fingers crossed, hero.`,
          `Your work is being reviewed. I'll be right here waiting with you.`,
        ],
        k("waiting")
      )
    );
  } else if (active > 0) {
    const rewardLine =
      ctx.nextRewardName && ctx.coinsToReward != null && ctx.coinsToReward > 0
        ? `Only ${ctx.coinsToReward} coins until "${ctx.nextRewardName}" is yours!`
        : null;
    messages.push(
      pickFresh(
        [
          `${active} ${quest}${active === 1 ? "" : "s"} await${active === 1 ? "s" : ""} today. Pick your favorite and begin!`,
          rewardLine ?? `The next ${quest} looks like an easy win for someone like you.`,
          `I believe in you, ${profile.nickname}. Start small, finish strong.`,
          `Ready when you are! Let's make today count.`,
        ].filter(Boolean) as string[],
        k("active")
      )
    );
  }

  return messages.slice(0, 2);
}
