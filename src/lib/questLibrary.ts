/* ============================================================================
   WonderNest Official Quest Library v1.0
   ----------------------------------------------------------------------------
   The official, curated catalogue of reusable Quest Profiles (per the product
   documentation). It is ADDITIVE and read-only: parents browse it and pre-fill
   the existing Quest / Routine form, then edit every field freely before saving.

   Guardrails honoured (v1.0):
   - `taskType` stays the operational taxonomy (drives challenge scoring +
     achievements). Pillars are ADDITIONAL, informational metadata.
   - The economy stays difficulty-based. Time Class + Effort Class are stored as
     informational metadata; profileDifficulty() only derives a *default*
     difficulty for the pre-fill, which the parent can change. No reward math
     changes here.

   NOTE: the documentation's summary says 62 profiles (Learning 12 /
   Responsibility 12) but its tables actually list 60 (Learning 11 /
   Responsibility 11). We seed the 60 written-out profiles verbatim.
   ============================================================================ */

import { Difficulty, QuestSlot, PRAYER_SLOTS } from "./game";

export type Pillar = "faith" | "learning" | "responsibility" | "wellbeing" | "character" | "family";
export type TimeClass = "tiny" | "short" | "medium" | "long" | "epic";
export type EffortClass = "low" | "moderate" | "high" | "exceptional";
export type QuestPriority = "essential" | "recommended" | "optional";
export type ScheduleHint =
  | "daily"
  | "school"
  | "weekly"
  | "morning-evening"
  | "up-to-5-daily"
  | "monthly"
  | "optional";
/** Operational task type — must stay within the app's existing TASK_TYPES. */
export type TaskTypeId = "chore" | "homework" | "reading" | "prayer" | "quran" | "habit" | "other";

export interface QuestProfile {
  id: string;
  name: string;
  /** Library section — used for grouping + the pillar counts. */
  pillar: Pillar;
  category: string;
  /** Development pillars per the docs (usually equal to `pillar`). Informational. */
  primaryPillar: string;
  secondaryPillar: string;
  /** Economy inputs from the docs — informational only in v1.0. */
  timeClass: TimeClass;
  effortClass: EffortClass;
  verification: string;
  schedule: ScheduleHint;
  ageMin: number;
  ageMax: number;
  priority: QuestPriority;
  notes?: string;
  /** How this profile maps onto the existing operational taxonomy. */
  taskType: TaskTypeId;
}

/** Pillar display metadata. Icons are art-icon names (the app uses no emoji). */
export const PILLARS: { id: Pillar; label: string; icon: string }[] = [
  { id: "faith", label: "Faith", icon: "sparkle" },
  { id: "learning", label: "Learning", icon: "book" },
  { id: "responsibility", label: "Responsibility", icon: "home" },
  { id: "wellbeing", label: "Wellbeing", icon: "heart" },
  { id: "character", label: "Character", icon: "star" },
  { id: "family", label: "Family", icon: "users" },
];

export const SCHEDULE_LABEL: Record<ScheduleHint, string> = {
  daily: "Daily",
  school: "School days",
  weekly: "Weekly",
  "morning-evening": "Morning & Evening",
  "up-to-5-daily": "Up to 5× daily",
  monthly: "Monthly",
  optional: "Optional",
};

export const PRIORITY_META: Record<QuestPriority, { label: string; rank: number; color: string }> = {
  essential: { label: "Essential", rank: 0, color: "var(--gold)" },
  recommended: { label: "Recommended", rank: 1, color: "var(--accent-2)" },
  optional: { label: "Optional", rank: 2, color: "var(--text-dim)" },
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* Compact builder so each profile reads as a single row:
   name, pillar, category, primary, secondary, time, effort, verification,
   schedule, ageMin, ageMax, priority, taskType */
const P = (
  name: string,
  pillar: Pillar,
  category: string,
  primaryPillar: string,
  secondaryPillar: string,
  timeClass: TimeClass,
  effortClass: EffortClass,
  verification: string,
  schedule: ScheduleHint,
  ageMin: number,
  ageMax: number,
  priority: QuestPriority,
  taskType: TaskTypeId
): QuestProfile => ({
  id: slug(name),
  name,
  pillar,
  category,
  primaryPillar,
  secondaryPillar,
  timeClass,
  effortClass,
  verification,
  schedule,
  ageMin,
  ageMax,
  priority,
  taskType,
});

const PC = "Parent Confirmation";

export const QUEST_LIBRARY: QuestProfile[] = [
  // 🕌 Faith (12)
  P("Perform Prayer", "faith", "Faith", "Faith", "Character", "short", "high", PC, "up-to-5-daily", 5, 12, "essential", "prayer"),
  P("Read Quran", "faith", "Faith", "Faith", "Learning", "medium", "high", `${PC} + voice record`, "daily", 5, 12, "essential", "quran"),
  P("Memorize Quran", "faith", "Faith", "Faith", "Learning", "medium", "high", PC, "weekly", 6, 12, "recommended", "quran"),
  P("Morning Adhkar", "faith", "Faith", "Faith", "Character", "short", "moderate", `${PC} + voice record`, "daily", 5, 12, "essential", "habit"),
  P("Evening Adhkar", "faith", "Faith", "Faith", "Character", "short", "moderate", `${PC} + voice record`, "daily", 5, 12, "essential", "habit"),
  P("Learn a New Dua", "faith", "Faith", "Faith", "Learning", "short", "moderate", PC, "weekly", 5, 12, "recommended", "habit"),
  P("Learn an Islamic Story", "faith", "Faith", "Faith", "Learning", "medium", "moderate", PC, "weekly", 5, 12, "recommended", "habit"),
  P("Practice Good Manners", "faith", "Faith", "Faith", "Character", "medium", "high", "Parent Observation", "daily", 5, 12, "essential", "habit"),
  P("Attend Friday Prayer", "faith", "Faith", "Faith", "Family", "medium", "high", PC, "weekly", 7, 12, "optional", "habit"),
  P("Pray at the Mosque", "faith", "Faith", "Faith", "Family", "medium", "moderate", PC, "optional", 5, 12, "optional", "habit"),
  P("Practice Gratitude", "faith", "Faith", "Character", "Faith", "short", "moderate", "Parent Conversation", "daily", 5, 12, "essential", "habit"),
  P("Give Charity", "faith", "Faith", "Character", "Family", "short", "moderate", PC, "optional", 5, 12, "recommended", "habit"),

  // 📚 Learning (11)
  P("Complete Homework", "learning", "School", "Learning", "Responsibility", "long", "high", `${PC} + photo`, "school", 5, 12, "essential", "homework"),
  P("Read a Book", "learning", "Reading", "Learning", "Character", "medium", "moderate", `${PC} + summary`, "daily", 5, 12, "essential", "reading"),
  P("Practice Mathematics", "learning", "School", "Learning", "Responsibility", "medium", "high", PC, "school", 5, 12, "recommended", "homework"),
  P("Practice Writing", "learning", "School", "Learning", "Responsibility", "medium", "moderate", `${PC} + photo`, "weekly", 5, 12, "recommended", "homework"),
  P("Practice Spelling", "learning", "School", "Learning", "Responsibility", "short", "moderate", PC, "school", 5, 10, "recommended", "homework"),
  P("Learn New Vocabulary", "learning", "Language", "Learning", "Character", "short", "moderate", PC, "weekly", 6, 12, "recommended", "homework"),
  P("Practice English", "learning", "Language", "Learning", "Responsibility", "medium", "high", PC, "weekly", 5, 12, "recommended", "homework"),
  P("Science Activity", "learning", "STEM", "Learning", "Wellbeing", "medium", "moderate", "Photo or Parent", "weekly", 5, 12, "recommended", "other"),
  P("Educational Puzzle", "learning", "Learning", "Learning", "Character", "short", "low", PC, "optional", 5, 10, "optional", "other"),
  P("Creative Drawing", "learning", "Creativity", "Learning", "Character", "medium", "moderate", "Photo", "weekly", 5, 12, "recommended", "other"),
  P("Educational Project", "learning", "Project", "Learning", "Responsibility", "epic", "exceptional", "Photo + Parent", "optional", 7, 12, "optional", "other"),

  // 🏠 Responsibility (11)
  P("Make Bed", "responsibility", "Household", "Responsibility", "Wellbeing", "short", "moderate", `${PC} + photo`, "daily", 5, 12, "essential", "chore"),
  P("Organize Bedroom", "responsibility", "Household", "Responsibility", "Character", "medium", "high", "Photo + Parent", "weekly", 5, 12, "essential", "chore"),
  P("Put Toys Away", "responsibility", "Household", "Responsibility", "Character", "short", "moderate", `${PC} + photo`, "daily", 5, 8, "essential", "chore"),
  P("Organize School Bag", "responsibility", "School", "Responsibility", "Learning", "short", "moderate", PC, "school", 5, 12, "essential", "chore"),
  P("Fold Clothes", "responsibility", "Household", "Responsibility", "Character", "medium", "moderate", PC, "weekly", 6, 12, "recommended", "chore"),
  P("Put Dirty Clothes in Laundry", "responsibility", "Household", "Responsibility", "Character", "tiny", "low", PC, "daily", 5, 12, "essential", "chore"),
  P("Help Set the Table", "responsibility", "Household", "Responsibility", "Family", "short", "moderate", PC, "daily", 5, 12, "recommended", "chore"),
  P("Clear the Table", "responsibility", "Household", "Responsibility", "Family", "short", "moderate", PC, "daily", 5, 12, "recommended", "chore"),
  P("Water Plants", "responsibility", "Household", "Responsibility", "Character", "short", "low", PC, "weekly", 5, 12, "optional", "chore"),
  P("Feed a Pet", "responsibility", "Animals", "Responsibility", "Character", "short", "moderate", PC, "daily", 5, 12, "optional", "chore"),
  P("Keep Personal Space Clean", "responsibility", "Household", "Responsibility", "Character", "medium", "high", "Photo or Parent", "weekly", 6, 12, "recommended", "chore"),

  // ❤️ Wellbeing (10)
  P("Brush Teeth", "wellbeing", "Hygiene", "Wellbeing", "Responsibility", "short", "moderate", `${PC} + photo`, "morning-evening", 5, 12, "essential", "habit"),
  P("Take a Shower", "wellbeing", "Hygiene", "Wellbeing", "Responsibility", "medium", "moderate", PC, "daily", 5, 12, "essential", "habit"),
  P("Wash Hands", "wellbeing", "Hygiene", "Wellbeing", "Responsibility", "tiny", "low", PC, "daily", 5, 12, "essential", "habit"),
  P("Drink Water", "wellbeing", "Health", "Wellbeing", "Responsibility", "tiny", "low", PC, "daily", 5, 12, "essential", "habit"),
  P("Eat a Healthy Meal", "wellbeing", "Nutrition", "Wellbeing", "Character", "medium", "moderate", PC, "daily", 5, 12, "recommended", "habit"),
  P("Eat Fruits or Vegetables", "wellbeing", "Nutrition", "Wellbeing", "Character", "tiny", "low", PC, "daily", 5, 12, "recommended", "habit"),
  P("Exercise", "wellbeing", "Exercise", "Wellbeing", "Character", "medium", "high", PC, "daily", 5, 12, "essential", "habit"),
  P("Sleep on Time", "wellbeing", "Health", "Wellbeing", "Responsibility", "long", "high", PC, "daily", 5, 12, "essential", "habit"),
  P("Stretching", "wellbeing", "Exercise", "Wellbeing", "Health", "short", "moderate", PC, "daily", 5, 12, "recommended", "habit"),
  P("Outdoor Play", "wellbeing", "Exercise", "Wellbeing", "Family", "long", "moderate", PC, "daily", 5, 12, "recommended", "habit"),

  // 🌟 Character (8)
  P("Help a Parent", "character", "Character", "Character", "Family", "medium", "high", PC, "daily", 5, 12, "essential", "habit"),
  P("Help a Sibling", "character", "Character", "Family", "Character", "medium", "moderate", PC, "daily", 5, 12, "recommended", "habit"),
  P("Say Thank You", "character", "Character", "Character", "Faith", "tiny", "low", PC, "daily", 5, 12, "essential", "habit"),
  P("Use Kind Words", "character", "Character", "Character", "Family", "medium", "moderate", PC, "daily", 5, 12, "essential", "habit"),
  P("Apologize Sincerely", "character", "Character", "Character", "Faith", "short", "high", PC, "optional", 5, 12, "recommended", "habit"),
  P("Share with Others", "character", "Character", "Character", "Family", "medium", "moderate", PC, "weekly", 5, 12, "recommended", "habit"),
  P("Tell the Truth", "character", "Character", "Character", "Faith", "medium", "high", PC, "daily", 5, 12, "essential", "habit"),
  P("Complete a Kind Act", "character", "Character", "Character", "Community", "medium", "moderate", PC, "weekly", 5, 12, "recommended", "habit"),

  // 👨‍👩‍👧 Family (8)
  P("Family Reading Time", "family", "Family", "Family", "Learning", "long", "moderate", PC, "weekly", 5, 12, "recommended", "reading"),
  P("Family Board Game", "family", "Family", "Family", "Character", "long", "moderate", PC, "weekly", 5, 12, "optional", "other"),
  P("Family Walk", "family", "Family", "Family", "Wellbeing", "long", "moderate", PC, "weekly", 5, 12, "recommended", "other"),
  P("Cook Together", "family", "Family", "Family", "Responsibility", "long", "high", PC, "weekly", 6, 12, "recommended", "other"),
  P("Family Clean-Up", "family", "Family", "Family", "Responsibility", "long", "high", PC, "monthly", 5, 12, "recommended", "chore"),
  P("Visit Grandparents", "family", "Family", "Family", "Character", "long", "moderate", PC, "monthly", 5, 12, "optional", "other"),
  P("Call a Relative", "family", "Family", "Family", "Character", "short", "low", PC, "weekly", 5, 12, "optional", "other"),
  P("Family Conversation Time", "family", "Family", "Family", "Character", "medium", "moderate", PC, "weekly", 5, 12, "recommended", "other"),
];

/* --------------------------------------------------------------------------
   Derivations for the pre-fill. These produce sensible DEFAULTS the parent can
   freely change; they never change reward math or the operational taxonomy.
   -------------------------------------------------------------------------- */

/** Default development pillar for a task type — used to auto-populate the
    hidden `pillar` metadata on custom quests (library quests carry their own).
    "other" has no natural home, so it stays unclassified. */
export function defaultPillar(taskType: string): Pillar | null {
  switch (taskType) {
    case "prayer":
    case "quran":
      return "faith";
    case "reading":
    case "homework":
      return "learning";
    case "chore":
      return "responsibility";
    case "habit":
      return "wellbeing";
    default:
      return null;
  }
}

const TIME_W: Record<TimeClass, number> = { tiny: 0, short: 1, medium: 2, long: 3, epic: 4 };
const EFFORT_W: Record<EffortClass, number> = { low: 0, moderate: 1, high: 2, exceptional: 3 };

/** A default difficulty derived from Time × Effort (parent may override). */
export function profileDifficulty(p: QuestProfile): Difficulty {
  const s = TIME_W[p.timeClass] + EFFORT_W[p.effortClass];
  if (s >= 7) return "epic";
  if (s >= 5) return "hard";
  if (s >= 3) return "medium";
  return "easy";
}

const EVERYDAY = [0, 1, 2, 3, 4, 5, 6];
const SCHOOL_DAYS = [0, 1, 2, 3, 4]; // Asia/Kuwait school week (Sun–Thu)
const ONE_SLOT: QuestSlot[] = [{ key: "default", label: "", time: null }];

/** Map a profile's suggested schedule onto the existing routine system.
    Schedules the routine engine can express become a pre-filled routine;
    "monthly"/"optional" (not expressible as weekday cadences) fall back to a
    one-off quest so nothing is invented. */
export function profileRoutine(p: QuestProfile): {
  repeat: boolean;
  weekdays: number[];
  slots: QuestSlot[];
} {
  switch (p.schedule) {
    case "daily":
      return { repeat: true, weekdays: EVERYDAY, slots: ONE_SLOT };
    case "school":
      return { repeat: true, weekdays: SCHOOL_DAYS, slots: ONE_SLOT };
    case "weekly":
      // once a week — a single weekday (Saturday) the parent can change
      return { repeat: true, weekdays: [6], slots: ONE_SLOT };
    case "morning-evening":
      return {
        repeat: true,
        weekdays: EVERYDAY,
        slots: [
          { key: "morning", label: "Morning", time: "07:00" },
          { key: "evening", label: "Evening", time: "20:00" },
        ],
      };
    case "up-to-5-daily":
      return { repeat: true, weekdays: EVERYDAY, slots: PRAYER_SLOTS.map((s) => ({ ...s })) };
    case "monthly":
    case "optional":
    default:
      return { repeat: false, weekdays: EVERYDAY, slots: ONE_SLOT };
  }
}
