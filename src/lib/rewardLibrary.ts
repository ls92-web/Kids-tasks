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
   ECONOMY v1.1 (2026-07-22) — THE SAVING JOURNEY. The store teaches patience,
   saving, and working toward meaningful goals — not daily spending. Rewards
   are organized into four SAVING TIERS, each a promise about how long an
   active hero saves for it (measured against real income of ~75 coins/day:
   ~40 from quests at the 10/20/40/80 difficulty defaults, ~23 expected from
   the daily chest, ~12 amortized from achievements/legends):

     Daily Treats     250-450   ≈ 3-7 days of saving
     Weekly Rewards   600-1000  ≈ 1-2 weeks
     Premium Rewards  1400-2600 ≈ 3-6 weeks
     Dream Rewards    3200-6500 ≈ 1.5-3 months

   The old 9-category taxonomy (v1.0) is superseded by these tiers; the tier
   is what the child's store groups by and what the pricing bands mean.
   rewardRarity() in game.ts mirrors the tier boundaries for card styling. */

export interface RewardTier {
  id: string;
  name: string;
  /** What this tier teaches — shown under the tier header in the store. */
  blurb: string;
  /** Minimum suggested cost for this tier (bands meet at these edges). */
  min: number;
}

/** The four saving tiers, cheapest first. Order matters for grouping. */
export const REWARD_TIERS: RewardTier[] = [
  { id: "daily", name: "Daily Treats", blurb: "Small joys — a few days of saving", min: 0 },
  { id: "weekly", name: "Weekly Rewards", blurb: "Worth about a week or two of quests", min: 600 },
  { id: "premium", name: "Premium Rewards", blurb: "Big goals — save for about a month", min: 1400 },
  { id: "dream", name: "Dream Rewards", blurb: "Legendary goals worth months of effort", min: 3200 },
];

/** Which saving tier a coin cost falls into (custom rewards included). */
export function tierForCost(cost: number): RewardTier {
  let tier = REWARD_TIERS[0];
  for (const t of REWARD_TIERS) if (cost >= t.min) tier = t;
  return tier;
}

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
  // ----- Daily Treats (250-450 · ≈3-7 days) -----
  R("RW004", "Extra Bedtime Story with Mom/Dad", "Daily Treats", 250, "One additional bedtime story by Mom/Dad.", "book"),
  R("RW003", "Juice or Smoothie", "Daily Treats", 280, "Healthy drink chosen by the child.", "icecream"),
  R("RW001", "Choose Dessert", "Daily Treats", 300, "Child chooses dessert after lunch.", "icecream"),
  R("RW002", "Favorite Snack", "Daily Treats", 300, "Parent-approved favorite snack.", "icecream"),
  R("RW010", "Family Walk (Mom/Dad)", "Daily Treats", 320, "Child chooses the walking destination.", "outdoor"),
  R("RW026", "Ice Cream Treat", "Daily Treats", 350, "One ice cream.", "icecream"),
  R("RW005", "Choose Dinner", "Daily Treats", 350, "Child chooses the family dinner.", "dinner"),
  R("RW014", "Bike Ride", "Daily Treats", 380, "Family bike ride together.", "outdoor"),
  R("RW006", "Stay Up 30 Minutes Later", "Daily Treats", 400, "Parent-approved evenings only.", "gift"),
  R("RW009", "Board Game Night with Mom/Dad", "Daily Treats", 400, "Child chooses the board game.", "toy"),

  // ----- Weekly Rewards (600-1000 · ≈1-2 weeks) -----
  R("RW007", "Extra Screen Time (30 min)", "Weekly Rewards", 600, "Extra 30 minutes of screen time.", "screen"),
  R("RW017", "Visit the Library", "Weekly Rewards", 600, "Visit the local library together.", "book"),
  R("RW011", "Bake Together with Mom", "Weekly Rewards", 650, "Bake a favorite recipe together.", "dinner"),
  R("RW022", "Gardening Together", "Weekly Rewards", 650, "Plant flowers or vegetables together.", "outdoor"),
  R("RW008", "Movie Night", "Weekly Rewards", 700, "Family movie with popcorn.", "movie"),
  R("RW012", "Park Visit", "Weekly Rewards", 700, "Family trip to the park.", "trip"),
  R("RW015", "Cook Favorite Meal Together with Mom", "Weekly Rewards", 750, "Child helps cook dinner.", "dinner"),
  R("RW013", "Picnic", "Weekly Rewards", 800, "Family picnic outdoors.", "trip"),
  R("RW018", "New Story Book", "Weekly Rewards", 800, "Choose a new book.", "book"),
  R("RW037", "Choose Weekend Activity", "Weekly Rewards", 850, "Child plans the weekend.", "trip"),
  R("RW019", "Private Date with Mom", "Weekly Rewards", 900, "Private date out with mom.", "trip"),
  R("RW020", "Private Date with Dad", "Weekly Rewards", 900, "Private date out with Dad.", "trip"),
  R("RW038", "Treasure Box Surprise", "Weekly Rewards", 950, "Mystery reward chosen by parents.", "mystery"),

  // ----- Premium Rewards (1400-2600 · ≈3-6 weeks) -----
  R("RW021", "New Craft Supplies", "Premium Rewards", 1400, "Art and craft materials.", "toy"),
  R("RW027", "Invite a Friend Over", "Premium Rewards", 1400, "Parent-approved playdate.", "gift"),
  R("RW016", "Family Breakfast Out", "Premium Rewards", 1500, "Weekend breakfast outing.", "dinner"),
  R("RW023", "Swimming Trip", "Premium Rewards", 1500, "Pool or beach visit.", "outdoor"),
  R("RW033", "Museum Visit", "Premium Rewards", 1500, "Museum trip.", "trip"),
  R("RW024", "New Football/Ball", "Premium Rewards", 1600, "Encourages physical activity.", "ball"),
  R("RW032", "Skating Visit", "Premium Rewards", 1600, "Skating visit.", "trip"),
  R("RW030", "New Toy", "Premium Rewards", 1800, "Parent-selected toy.", "toy"),
  R("RW028", "Sleepover with Cousins", "Premium Rewards", 1800, "Family-approved sleepover.", "gift"),
  R("RW029", "LEGO Set", "Premium Rewards", 2000, "A LEGO set worth saving for.", "toy"),
  R("RW034", "Camping Night", "Premium Rewards", 2000, "Indoor or outdoor camping.", "outdoor"),
  R("RW031", "Magic Planet Visit", "Premium Rewards", 2600, "Family visit to the Avenues – Magic Planet.", "trip"),

  // ----- Dream Rewards (3200-6500 · ≈1.5-3 months) -----
  R("RW025", "Sports Equipment", "Dream Rewards", 3200, "Parent-selected equipment.", "ball"),
  R("RW035", "Theme Park Visit", "Dream Rewards", 5000, "A major milestone adventure.", "trip"),
  R("RW036", "New Bicycle", "Dream Rewards", 6000, "The long-term achievement reward.", "outdoor"),
  R("RW039", "Dream Reward", "Dream Rewards", null, "The family's own dream goal — parent sets the price.", "gift"),
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
  /** competitive = race for the top; cooperative = shared family goal. */
  mode: "competitive" | "cooperative";
  /** Family goal for cooperative challenges (completed quests, summed). */
  goalTarget?: number;
}

const C = (
  id: string,
  name: string,
  metric: ChallengeProfile["metric"],
  duration: ChallengeDuration,
  objective: string,
  bonusXp: number,
  mode: ChallengeProfile["mode"] = "competitive",
  goalTarget?: number
): ChallengeProfile => ({ id, name, metric, duration, objective, bonusXp, mode, goalTarget });

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
  // Cooperative (shared family goal; "each" payout per the doc). Only the
  // quest-countable templates are seeded — screen-free/minutes-based ones are
  // deferred. CH014/CH015 goal targets are app defaults (doc omits numbers):
  // 35 = five daily prayers x 7 days; 7 = daily Quran reading x 7 days.
  C("CH011", "Family Helper Week", "cleaning", "7d", "Complete 40 household Quests together.", 100, "cooperative", 40),
  C("CH014", "Prayer Together", "prayer", "7d", "Complete family Prayer Quests.", 120, "cooperative", 35),
  C("CH015", "Quran Together", "faith", "7d", "Complete family Quran Reading Quests.", 120, "cooperative", 7),
  C("CH016", "Family Walk Challenge", "family", "7d", "Complete five family walks.", 100, "cooperative", 5),
  C("CH017", "Kindness Week", "character", "7d", "Complete 30 Kind Acts together.", 100, "cooperative", 30),
  C("CH018", "Healthy Eating Week", "wellbeing", "7d", "Complete 21 Healthy Meal Quests.", 100, "cooperative", 21),
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
