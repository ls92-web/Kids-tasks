/* The companion's brain: warm, personalized messages generated from the
   child's real progress. Deterministic per day (seeded), so the guide says
   something different every day without ever calling a network. It never
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

function seededPick<T>(pool: T[], seed: number): T {
  return pool[Math.abs(seed) % pool.length];
}

function daySeed(profileId: string): number {
  const now = new Date();
  const day = Math.floor(now.getTime() / 86_400_000);
  let h = day;
  for (const ch of profileId.slice(0, 8)) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
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

/** Fire-and-forget: the CompanionGuide bubble shows a line for this moment. */
export function sayFromCompanion(event: CompanionEvent) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(COMPANION_SAY_EVENT, { detail: { event } }));
}

export function companionMessages(ctx: CompanionContext, theme: ThemeId): string[] {
  const { profile, tasks } = ctx;
  const seed = daySeed(profile.id);
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

  // 2) Memory: the badge the hero is closest to unlocking, if within reach
  const counts = computeCounts(tasks);
  const nearBadge = BADGES.map((b) => ({ b, remaining: b.target - b.progress({ profile, counts }) }))
    .filter((x) => x.remaining > 0 && x.remaining <= 3 && x.b.target <= 260)
    .sort((a, z) => a.remaining - z.remaining)[0];
  if (nearBadge) {
    messages.push(
      seededPick(
        [
          `You're only ${nearBadge.remaining} away from the "${nearBadge.b.title}" badge!`,
          `So close to "${nearBadge.b.title}" — just ${nearBadge.remaining} more to go!`,
          `I can almost see the "${nearBadge.b.title}" badge glowing. ${nearBadge.remaining} left!`,
        ],
        seed + 5
      )
    );
  } else if (profile.streak_days >= 3) {
    messages.push(
      seededPick(
        [
          `A ${profile.streak_days}-day streak! ${petName} does a happy little dance every time.`,
          `${profile.streak_days} days in a row — ${petName} is bursting with pride.`,
          `Your flame has burned for ${profile.streak_days} days straight. Guard it well today!`,
        ],
        seed + 1
      )
    );
  } else if (profile.tasks_completed >= 10) {
    messages.push(
      seededPick(
        [
          `${profile.tasks_completed} ${quest}s conquered so far. I remember every single one.`,
          `You've completed ${profile.tasks_completed} ${quest}s since we met. The realm remembers.`,
          `A true ${rank} — ${profile.tasks_completed} victories and counting.`,
        ],
        seed + 1
      )
    );
  } else if (pct >= 60) {
    messages.push(
      seededPick(
        [
          `You're so close to level ${level + 1} — I can almost see it glowing.`,
          `Level ${level + 1} is just over the hill. One good push!`,
        ],
        seed + 1
      )
    );
  }

  // 3) A gentle nudge toward what's next — never pressure
  if (doneToday > 0 && active === 0 && waiting === 0) {
    messages.push(voiceLine(profile.pet, "allDone", profile.nickname));
  } else if (waiting > 0 && active === 0) {
    messages.push(
      seededPick(
        [
          `Your proof is with the grown-ups now. I have a good feeling about it.`,
          `The council is looking at your work — fingers crossed, hero.`,
        ],
        seed + 2
      )
    );
  } else if (active > 0) {
    const rewardLine =
      ctx.nextRewardName && ctx.coinsToReward != null && ctx.coinsToReward > 0
        ? `Only ${ctx.coinsToReward} coins until "${ctx.nextRewardName}" is yours!`
        : null;
    messages.push(
      seededPick(
        [
          `${active} ${quest}${active === 1 ? "" : "s"} await${active === 1 ? "s" : ""} today. Pick your favorite and begin!`,
          rewardLine ?? `The next ${quest} looks like an easy win for someone like you.`,
          `I believe in you, ${profile.nickname}. Start small, finish strong.`,
        ].filter(Boolean) as string[],
        seed + 2
      )
    );
  }

  return messages.slice(0, 2);
}
