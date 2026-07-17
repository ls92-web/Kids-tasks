/* ============================================================================
   WonderNest Official Reward & Challenge Library v1.0
   ----------------------------------------------------------------------------
   Additive catalogues, mirroring the Quest Library pattern: parents pick an
   official entry from a dropdown on the EXISTING create forms, every field is
   pre-filled but stays editable, and custom creation is untouched.

   Guardrails (v1.0):
   - Rewards: no changes to the shop, redemption, or economy — the catalogue
     only pre-fills the existing rewards form. `icon` maps each entry onto the
     app's existing reward icon set; `category` is informational metadata.
   - Challenges: templates cover ONLY what the current metrics + scoring can
     express (award_submission is untouched). Cooperative challenges and
     bonus-XP settlement are deliberately excluded from v1.0.
   ============================================================================ */

/* ---------- Official Rewards (RW001–RW039) ----------
   DOCUMENTATION CORRECTION (approved 2026-07-17): the source document's reward
   table used three categories ("Screen Time", "Social", "Surprise") that are
   not part of its own 9-category taxonomy. Normalized here — and to be fixed
   in the source docx — as:
     RW007 Extra Screen Time   → Free Privileges
     RW027 Invite a Friend Over → Family Experiences
     RW038 Treasure Box Surprise → Milestone Rewards
   Artwork/icons unchanged; only category metadata. All category labels use the
   documented list names (e.g. "Outdoor & Sports", "Milestone Rewards"). */

export interface RewardProfile {
  id: string; // official ID, e.g. "RW001"
  name: string;
  category: string;
  /** Suggested coin cost; null = parent chooses (RW039 Dream Reward). */
  cost: number | null;
  description: string;
  /** Existing rewards-form icon id (ICON_OPTIONS) this entry renders with. */
  icon: string;
}

const R = (
  id: string,
  name: string,
  category: string,
  cost: number | null,
  description: string,
  icon: string
): RewardProfile => ({ id, name, category, cost, description, icon });

export const REWARD_LIBRARY: RewardProfile[] = [
  R("RW001", "Choose Dessert", "Free Privileges", 15, "Child chooses dessert after lunch.", "icecream"),
  R("RW002", "Favorite Snack", "Free Privileges", 20, "Parent-approved favorite snack.", "icecream"),
  R("RW003", "Juice or Smoothie", "Free Privileges", 20, "Healthy drink chosen by the child.", "icecream"),
  R("RW004", "Extra Bedtime Story with Mom/Dad", "Free Privileges", 15, "One additional bedtime story by Mom/Dad.", "book"),
  R("RW005", "Choose Dinner", "Free Privileges", 25, "Child chooses the family dinner.", "dinner"),
  R("RW006", "Stay Up 30 Minutes Later", "Free Privileges", 30, "Parent-approved evenings only.", "gift"),
  R("RW007", "Extra Screen Time (30 min)", "Free Privileges", 60, "Extra 30 minutes of screen time.", "screen"),
  R("RW008", "Movie Night", "Family Experiences", 50, "Family movie with popcorn.", "movie"),
  R("RW009", "Board Game Night with Mom/Dad", "Family Experiences", 40, "Child chooses the board game.", "toy"),
  R("RW010", "Family Walk (Mom/Dad)", "Family Experiences", 35, "Child chooses the walking destination.", "outdoor"),
  R("RW011", "Bake Together with Mom", "Family Experiences", 45, "Bake a favorite recipe together.", "dinner"),
  R("RW012", "Park Visit", "Family Experiences", 50, "Family trip to the park.", "trip"),
  R("RW013", "Picnic", "Family Experiences", 80, "Family picnic outdoors.", "trip"),
  R("RW014", "Bike Ride", "Family Experiences", 40, "Family bike ride together.", "outdoor"),
  R("RW015", "Cook Favorite Meal Together with Mom", "Family Experiences", 80, "Child helps cook dinner.", "dinner"),
  R("RW016", "Family Breakfast Out", "Family Experiences", 200, "Weekend breakfast outing.", "dinner"),
  R("RW017", "Visit the Library", "Educational Rewards", 60, "Visit the local library together.", "book"),
  R("RW018", "New Story Book", "Educational Rewards", 100, "Choose a new book.", "book"),
  R("RW019", "Private Date with Mom", "Family Experiences", 80, "Private date out with mom.", "trip"),
  R("RW020", "Private Date with Dad", "Family Experiences", 80, "Private date out with Dad.", "trip"),
  R("RW021", "New Craft Supplies", "Creative Rewards", 120, "Art and craft materials.", "toy"),
  R("RW022", "Gardening Together", "Family Experiences", 70, "Plant flowers or vegetables together.", "outdoor"),
  R("RW023", "Swimming Trip", "Outdoor & Sports", 120, "Pool or beach visit.", "outdoor"),
  R("RW024", "New Football/Ball", "Outdoor & Sports", 180, "Encourages physical activity.", "ball"),
  R("RW025", "Sports Equipment", "Outdoor & Sports", 300, "Parent-selected equipment.", "ball"),
  R("RW026", "Ice Cream Treat", "Small Purchases", 35, "One ice cream.", "icecream"),
  R("RW027", "Invite a Friend Over", "Family Experiences", 120, "Parent-approved playdate.", "gift"),
  R("RW028", "Sleepover with Cousins", "Family Experiences", 180, "Family-approved sleepover.", "gift"),
  R("RW029", "LEGO Set", "Milestone Rewards", 250, "Long-term goal reward.", "toy"),
  R("RW030", "New Toy", "Milestone Rewards", 300, "Parent-selected toy.", "toy"),
  R("RW031", "Magic Planet Visit", "Premium Rewards", 250, "Family visit to the Avenues – Magic Planet.", "trip"),
  R("RW032", "Skating Visit", "Premium Rewards", 200, "Skating visit.", "trip"),
  R("RW033", "Museum Visit", "Educational Rewards", 200, "Museum trip.", "trip"),
  R("RW034", "Camping Night", "Premium Rewards", 180, "Indoor or outdoor camping.", "outdoor"),
  R("RW035", "Theme Park Visit", "Premium Rewards", 500, "Major milestone reward.", "trip"),
  R("RW036", "New Bicycle", "Premium Rewards", 800, "Long-term achievement reward.", "outdoor"),
  R("RW037", "Choose Weekend Activity", "Family Experiences", 180, "Child plans the weekend.", "trip"),
  R("RW038", "Treasure Box Surprise", "Milestone Rewards", 150, "Mystery reward chosen by parents.", "mystery"),
  R("RW039", "Dream Reward", "Custom Rewards", null, "Flexible custom reward.", "gift"),
];

/** Categories in catalogue order, for grouping the dropdown. */
export const REWARD_CATEGORIES: string[] = [...new Set(REWARD_LIBRARY.map((r) => r.category))];

/* ---------- Official Challenges (minimal v1.0 slice) ----------
   Only the competitive templates the CURRENT metrics + scoring can express:
     tasks   → any completed quest        reading → task_type 'reading'
     homework→ task_type 'homework'       habits  → task_type 'habit'
     cleaning→ task_type 'chore'
   Wellbeing library quests are habit-type and Responsibility library quests
   are chore-type, so CH005/CH006 map faithfully. Prayer / Exercise / Kindness /
   Knowledge need new metrics (deferred), cooperative challenges are a future
   mode, and bonus XP remains display-only (not yet auto-awarded). */

export type ChallengeDuration = "7d" | "weekend" | "30d";
export type ChallengeMetric =
  | "tasks"
  | "reading"
  | "homework"
  | "cleaning"
  | "habits"
  | "prayer"
  | "faith"
  | "learning"
  | "responsibility"
  | "wellbeing"
  | "character"
  | "family";

export interface ChallengeProfile {
  id: string; // official ID, e.g. "CH001"
  name: string;
  metric: ChallengeMetric;
  duration: ChallengeDuration;
  objective: string;
  bonusXp: number;
}

const C = (
  id: string,
  name: string,
  metric: ChallengeProfile["metric"],
  duration: ChallengeDuration,
  objective: string,
  bonusXp: number
): ChallengeProfile => ({ id, name, metric, duration, objective, bonusXp });

export const CHALLENGE_LIBRARY: ChallengeProfile[] = [
  C("CH001", "Reading Champion", "reading", "7d", "Complete the most Reading Quests.", 80),
  C("CH002", "Homework Hero", "homework", "7d", "Complete the most Homework Quests.", 100),
  C("CH003", "Prayer Champion", "prayer", "7d", "Complete the most Prayer Quests.", 200),
  C("CH004", "Kindness Champion", "character", "7d", "Complete the most Character Quests.", 80),
  C("CH005", "Healthy Habits Week", "habits", "7d", "Complete the most Wellbeing Quests.", 80),
  C("CH006", "Responsibility Star", "cleaning", "7d", "Complete the most Responsibility Quests.", 100),
  // Exercise is a category within Wellbeing — approved approximation: scored
  // via the wellbeing pillar; the objective text keeps the official wording.
  C("CH007", "Exercise Challenge", "wellbeing", "7d", "Complete the most Exercise Quests.", 60),
  C("CH008", "Knowledge Explorer", "learning", "7d", "Complete the most Learning Quests.", 80),
  C("CH009", "Weekend Quest Sprint", "tasks", "weekend", "Complete the most Quests.", 60),
  C("CH010", "Monthly Champion", "tasks", "30d", "Highest total completed Quests.", 250),
];

export const DURATION_LABEL: Record<ChallengeDuration, string> = {
  "7d": "7 days",
  weekend: "Weekend",
  "30d": "30 days",
};

/** End-datetime for a duration preset, as a datetime-local input value.
    Weekend = the end of the coming Saturday (Kuwait weekend is Fri–Sat). */
export function durationEndsAt(d: ChallengeDuration, from: Date = new Date()): string {
  const end = new Date(from);
  if (d === "7d") end.setDate(end.getDate() + 7);
  else if (d === "30d") end.setDate(end.getDate() + 30);
  else {
    // days until Saturday (JS getDay: Sat = 6); if already Saturday, use today
    const until = (6 - end.getDay() + 7) % 7;
    end.setDate(end.getDate() + until);
  }
  end.setHours(23, 59, 0, 0);
  // local datetime-local format: YYYY-MM-DDTHH:mm
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`;
}
