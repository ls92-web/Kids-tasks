/* Game math, themes, classes, ranks — the shared rulebook. */

export type ThemeId = "ninja" | "samurai" | "speed";

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  tagline: string;
  coinName: string;
  questWord: string;
  verifyTitle: string;
  verifySteps: [string, string, string];
  ranks: string[];
  mapStops: string[];
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  ninja: {
    id: "ninja",
    name: "Shadow Ninja Village",
    tagline: "Move unseen. Begin the adventure.",
    coinName: "Moon Coins",
    questWord: "Quest",
    verifyTitle: "Magic Scan",
    verifySteps: [
      "Unrolling the secret scroll…",
      "Moonlight reads your proof…",
      "The village elders decide…",
    ],
    ranks: [
      "Shadow Novice",
      "Paper Lantern",
      "Silent Step",
      "Moonlit Blade",
      "Night Fang",
      "Phantom Master",
      "Eternal Shadow",
    ],
    mapStops: [
      "Bamboo Gate",
      "Lantern Bridge",
      "Whispering Forest",
      "Rooftop Run",
      "Moon Shrine",
      "Smoke Canyon",
      "Blossom Peak",
      "Shadow Citadel",
    ],
  },
  samurai: {
    id: "samurai",
    name: "Legend of the Samurai",
    tagline: "Honor grows with every deed.",
    coinName: "Honor Coins",
    questWord: "Trial",
    verifyTitle: "Scroll Decoding",
    verifySteps: [
      "The ancient scroll unfurls…",
      "Golden ink studies your deed…",
      "The council of masters judges…",
    ],
    ranks: [
      "Wanderer",
      "Ashigaru",
      "Ronin",
      "Blade Disciple",
      "Honor Guard",
      "Daimyo's Champion",
      "Living Legend",
    ],
    mapStops: [
      "Village Gate",
      "Rice Terraces",
      "Golden Maple Road",
      "Mountain Dojo",
      "Sacred Torii",
      "Thunder Pass",
      "Temple of Echoes",
      "Summit of Legends",
    ],
  },
  speed: {
    id: "speed",
    name: "Speed Realm",
    tagline: "Charge the rings. Break the record.",
    coinName: "Charge Rings",
    questWord: "Run",
    verifyTitle: "Crystal Analysis",
    verifySteps: [
      "Charging the energy crystal…",
      "Beam sweep in progress…",
      "Core verdict incoming…",
    ],
    ranks: [
      "Spark Runner",
      "Boost Cadet",
      "Ring Chaser",
      "Turbo Ace",
      "Sonic Vanguard",
      "Lightspeed Elite",
      "Velocity Legend",
    ],
    mapStops: [
      "Launch Pad",
      "Neon Loop",
      "Crystal Cavern",
      "Skyway Sprint",
      "Magnet Rail",
      "Storm Circuit",
      "Prism Tower",
      "Infinity Ring",
    ],
  },
};

export const CHARACTER_CLASSES = [
  { id: "shadow_warrior", name: "Shadow Warrior", blurb: "Strikes from silence" },
  { id: "forest_guardian", name: "Forest Guardian", blurb: "Protector of living things" },
  { id: "lightning_runner", name: "Lightning Runner", blurb: "Faster than thought" },
  { id: "sky_hunter", name: "Sky Hunter", blurb: "Eyes above everything" },
  { id: "dragon_apprentice", name: "Dragon Apprentice", blurb: "Learning ancient fire" },
  { id: "spirit_blade", name: "Spirit Blade", blurb: "Calm mind, bright edge" },
  { id: "mystic_scout", name: "Mystic Scout", blurb: "Finds hidden paths" },
  { id: "explorer", name: "Explorer", blurb: "First through every gate" },
  { id: "inventor", name: "Inventor", blurb: "Builds wonders from scraps" },
  { id: "nature_keeper", name: "Nature Keeper", blurb: "Friend of every creature" },
  { id: "sky_captain", name: "Sky Captain", blurb: "Commands the open clouds" },
] as const;

/* Visual gear unlocked by leveling — drawn onto the avatar */
export const GEAR_UNLOCKS = [
  { level: 5, label: "Hero's Circlet" },
  { level: 12, label: "Spirit Wings" },
  { level: 20, label: "Champion's Crown" },
  { level: 30, label: "Legend's Aura" },
] as const;

/* Reward rarity by coin cost — drives card frame styling in the store */
export function rewardRarity(cost: number): {
  id: "common" | "rare" | "epic" | "legendary";
  label: string;
  color: string;
} {
  if (cost >= 400) return { id: "legendary", label: "Legendary", color: "#ffb45e" };
  if (cost >= 180) return { id: "epic", label: "Epic", color: "#c77dff" };
  if (cost >= 80) return { id: "rare", label: "Rare", color: "#5ec8ff" };
  return { id: "common", label: "Common", color: "#8fdca0" };
}

/* Per-theme AI companion — the child's adventure guide */
export const COMPANIONS: Record<ThemeId, { name: string; title: string }> = {
  ninja: { name: "Kage", title: "your lantern spirit" },
  samurai: { name: "Hoshi", title: "your crane sage" },
  speed: { name: "Volt", title: "your circuit sprite" },
};

export const AVATARS = [
  { id: "fox", name: "Kit", hue: 18 },
  { id: "wolf", name: "Fang", hue: 215 },
  { id: "hawk", name: "Gale", hue: 265 },
  { id: "panda", name: "Mochi", hue: 150 },
  { id: "dragon", name: "Ember", hue: 350 },
  { id: "tiger", name: "Blaze", hue: 32 },
  { id: "owl", name: "Sage", hue: 190 },
  { id: "cat", name: "Pounce", hue: 300 },
] as const;

/* ---------- Levels ---------- */
/* XP needed to go from level n to n+1 */
export function xpForNext(level: number): number {
  return 100 + (level - 1) * 60;
}

export function levelFromXp(xp: number): {
  level: number;
  into: number;
  needed: number;
  pct: number;
} {
  let level = 1;
  let remaining = xp;
  while (remaining >= xpForNext(level) && level < 99) {
    remaining -= xpForNext(level);
    level += 1;
  }
  const needed = xpForNext(level);
  return { level, into: remaining, needed, pct: Math.min(100, (remaining / needed) * 100) };
}

/* Rank unlocks at these levels (index-aligned with theme.ranks) */
export const RANK_LEVELS = [1, 5, 10, 16, 23, 31, 40];

export function rankIndex(level: number): number {
  let idx = 0;
  for (let i = 0; i < RANK_LEVELS.length; i++) {
    if (level >= RANK_LEVELS[i]) idx = i;
  }
  return idx;
}

export function rankName(theme: ThemeId, level: number): string {
  return THEMES[theme].ranks[rankIndex(level)];
}

export const DIFFICULTY = {
  easy: { label: "Easy", stars: 1, color: "var(--success)" },
  medium: { label: "Medium", stars: 2, color: "var(--accent-2)" },
  hard: { label: "Hard", stars: 3, color: "var(--gold)" },
  epic: { label: "Epic", stars: 4, color: "var(--danger)" },
} as const;

export type Difficulty = keyof typeof DIFFICULTY;

export const TASK_TYPES = [
  { id: "chore", label: "Chore" },
  { id: "homework", label: "Homework" },
  { id: "reading", label: "Reading" },
  { id: "prayer", label: "Prayer" },
  { id: "quran", label: "Qur'an" },
  { id: "habit", label: "Habit" },
  { id: "other", label: "Other" },
] as const;

/* ---------- Families ---------- */
/* Crest choices for family creation (ids map to Icon names). */
export const CRESTS = [
  { id: "shield", label: "Shield of Dawn" },
  { id: "sword", label: "Blade of Courage" },
  { id: "flame", label: "Eternal Flame" },
  { id: "star", label: "Guiding Star" },
  { id: "lightning", label: "Storm Sigil" },
  { id: "trophy", label: "Champion's Cup" },
  { id: "book", label: "Tome of Wisdom" },
  { id: "sparkle", label: "Spark of Magic" },
] as const;

export interface Family {
  id: string;
  name: string;
  crest: string;
  code: string;
}

export interface Profile {
  id: string;
  family_id: string;
  role: "parent" | "child";
  username: string | null;
  nickname: string;
  avatar: string;
  character_class: string;
  pet: string;
  theme: ThemeId;
  xp: number;
  coins: number;
  streak_days: number;
  tasks_completed: number;
  total_coins_earned: number;
  last_chest_date: string | null;
  animation_intensity: "full" | "reduced" | "minimal";
}

/* ============================================================
   PET COMPANIONS — see ART_DIRECTION.md for the permanent style bible.
   Premium chibi creatures with an elemental affinity that evolve through
   four canonical forms as the HERO levels up:
     Baby (Lv 1) → Explorer (Lv 20) → Hero (Lv 50) → Legend (Lv 100)
   Each higher form is larger, more detailed, and its elemental aura burns
   brighter — exactly like the reference evolution chart.
   ============================================================ */

/* Elemental affinities (id → label + signature glow color) — matches the
   official evolution chart. */
export const ELEMENTS = {
  shadow: { label: "Shadow", color: "#9a86e0" },
  honor: { label: "Honor", color: "#f2b846" },
  fire: { label: "Fire", color: "#ff7a3d" },
  nature: { label: "Nature", color: "#7ee06a" },
  arcane: { label: "Arcane", color: "#8f7bff" },
  ice: { label: "Ice", color: "#5fd0ff" },
  dark: { label: "Dark", color: "#b06bff" },
  light: { label: "Light", color: "#ffd76a" },
  tech: { label: "Tech", color: "#4fb8ff" },
  adventure: { label: "Adventure", color: "#ff9a3d" },
  thunder: { label: "Thunder", color: "#ffe45e" },
} as const;

export type ElementId = keyof typeof ELEMENTS;

export interface PetDef {
  id: string;
  name: string;
  species: string;
  element: ElementId;
  /** One-word personality — how this creature carries itself. */
  personality: string;
  /** Child-friendly one-liner for pickers, ceremonies, and the Hero Hall. */
  blurb: string;
}

/* The official 12 companions (see ART_DIRECTION.md). Each ships premium art at
   /public/companions/<id>-<form>.png for all four evolution forms. */
export const PETS: PetDef[] = [
  { id: "dragon", name: "Ember", species: "Mini Dragon", element: "fire", personality: "Brave", blurb: "A little dragon with a big heart who never, ever gives up." },
  { id: "fox", name: "Frost", species: "Crystal Fox", element: "ice", personality: "Curious", blurb: "A sparkling fox who finds wonder in every snowflake." },
  { id: "owl", name: "Professor Hoot", species: "Mage Owl", element: "arcane", personality: "Wise", blurb: "Knows a spell for everything — and a story for bedtime." },
  { id: "wolf", name: "Shade", species: "Shadow Wolf", element: "dark", personality: "Loyal", blurb: "Quiet as dusk, and always right beside you." },
  { id: "tiger", name: "Rai", species: "Thunder Tiger", element: "thunder", personality: "Fearless", blurb: "Charges at every challenge with a rumble of thunder." },
  { id: "phoenix", name: "Blaze", species: "Young Phoenix", element: "light", personality: "Radiant", blurb: "Glows brightest exactly when you need it most." },
  { id: "turtle", name: "Shellby", species: "Guardian Turtle", element: "nature", personality: "Kind", blurb: "A gentle guardian who always protects their friends." },
  { id: "forest", name: "Sprout", species: "Forest Spirit", element: "nature", personality: "Playful", blurb: "Turns every chore into a game of hide-and-seek." },
  { id: "robot", name: "Bolt", species: "Little Robot", element: "tech", personality: "Inventive", blurb: "Beep! Has a gadget for every problem — mostly." },
  { id: "ninja", name: "Kage", species: "Tiny Ninja", element: "shadow", personality: "Clever", blurb: "A silent little ninja who loves secret quests." },
  { id: "samurai", name: "Kenji", species: "Baby Samurai", element: "honor", personality: "Honorable", blurb: "Small sword, huge heart — keeps every promise." },
  { id: "pirate", name: "Coco", species: "Treasure Pirate", element: "adventure", personality: "Adventurous", blurb: "Smells treasure from a mile away. Usually snacks." },
];

export function petElement(id: string): (typeof ELEMENTS)[ElementId] & { id: ElementId } {
  const meta = PETS.find((p) => p.id === id);
  const el = (meta?.element ?? "fire") as ElementId;
  return { id: el, ...ELEMENTS[el] };
}

export type PetMood = "excited" | "happy" | "proud" | "sleepy" | "cheer";

/* ---------- Companion bonds & campaigns ----------
   A hero bonds with ONE companion at a time; that bond IS the active
   CAMPAIGN. The companion earns its own XP from every approved quest (for
   growth/evolution) and its campaign advances one step per quest
   (quests_done). The campaign walks the three shared worlds and ends in the
   companion's exclusive finale world (see FINALE_WORLDS in worlds.ts).
   Completing the finale makes the companion LEGENDARY — permanent in the
   Hero Hall — and only then can a new companion campaign begin. Companions
   cannot be switched mid-campaign. Locked companions = no bond row yet. */

export interface CompanionBond {
  id: string;
  child_id: string;
  species: string;
  xp: number;
  /** Campaign progress: quests approved during this bond (0..CAMPAIGN_TOTAL). */
  quests_done: number;
  status: "active" | "legend";
  bonded_at: string;
  legend_at: string | null;
}

/* Total XP to reach companion level 100. NOTE: since the Companion Campaigns
   model, Legendary status is earned by COMPLETING THE CAMPAIGN (quests_done
   >= CAMPAIGN_TOTAL, enforced by complete_legend in SQL) — this constant only
   backs the level/evolution math. */
export const LEGEND_XP = 300960;

/* Companion level uses the same curve as the hero but can reach 100. */
export function companionLevel(xp: number): number {
  let level = 1;
  let remaining = xp;
  while (level < 100 && remaining >= xpForNext(level)) {
    remaining -= xpForNext(level);
    level += 1;
  }
  return level;
}

/* Level + progress-within-level for a companion (for the Hall detail card). */
export function companionProgress(xp: number): {
  level: number;
  into: number;
  needed: number;
  pct: number;
} {
  let level = 1;
  let remaining = xp;
  while (level < 100 && remaining >= xpForNext(level)) {
    remaining -= xpForNext(level);
    level += 1;
  }
  if (level >= 100) return { level: 100, into: 0, needed: 0, pct: 100 };
  const needed = xpForNext(level);
  return { level, into: remaining, needed, pct: Math.min(100, (remaining / needed) * 100) };
}

/* How a locked companion joins the roster. Starters are free at first pick;
   the rest unlock through meaningful progression. Display/pick gating here —
   the same rules are ENFORCED server-side in bond_companion() (and starters
   in join-family); keep both in sync when changing them. */
export type UnlockRule =
  | { kind: "starter" }
  | { kind: "world"; world: ThemeId; label: string }
  | { kind: "heroLevel"; level: number }
  | { kind: "quests"; count: number }
  | { kind: "coins"; total: number };

export const COMPANION_UNLOCKS: Record<string, UnlockRule> = {
  dragon: { kind: "starter" },
  ninja: { kind: "starter" },
  turtle: { kind: "starter" },
  owl: { kind: "heroLevel", level: 10 },
  forest: { kind: "quests", count: 25 },
  wolf: { kind: "quests", count: 50 },
  tiger: { kind: "heroLevel", level: 25 },
  pirate: { kind: "coins", total: 1000 },
  phoenix: { kind: "heroLevel", level: 40 },
  fox: { kind: "world", world: "ninja", label: "Complete Shadow Ninja Village" },
  samurai: { kind: "world", world: "samurai", label: "Complete Legend of the Samurai" },
  robot: { kind: "world", world: "speed", label: "Complete Speed Realm" },
};

export function unlockHint(rule: UnlockRule): string {
  switch (rule.kind) {
    case "starter": return "Ready to join you";
    case "world": return rule.label;
    case "heroLevel": return `Reach hero level ${rule.level}`;
    case "quests": return `Complete ${rule.count} quests`;
    case "coins": return `Earn ${rule.total} coins in total`;
  }
}

/* worldsCompleted = how many chapter maps the hero has fully cleared. */
export function speciesUnlocked(
  species: string,
  profile: Pick<Profile, "xp" | "tasks_completed" | "total_coins_earned">,
  worldsCompleted: number
): boolean {
  const rule = COMPANION_UNLOCKS[species];
  if (!rule) return false;
  const heroLevel = levelFromXp(profile.xp).level;
  switch (rule.kind) {
    case "starter": return true;
    case "world": {
      const order: ThemeId[] = ["ninja", "samurai", "speed"];
      return worldsCompleted > order.indexOf(rule.world);
    }
    case "heroLevel": return heroLevel >= rule.level;
    case "quests": return profile.tasks_completed >= rule.count;
    case "coins": return profile.total_coins_earned >= rule.total;
  }
}

/* The four canonical evolution forms, gated by the COMPANION's level. */
export const PET_FORMS = [
  { index: 0, name: "Baby", level: 1 },
  { index: 1, name: "Explorer", level: 20 },
  { index: 2, name: "Hero", level: 50 },
  { index: 3, name: "Legend", level: 100 },
] as const;

/* Current evolution form for a given companion level. */
export function petForm(level: number): { index: number; name: string; level: number } {
  let form = PET_FORMS[0] as { index: number; name: string; level: number };
  for (const f of PET_FORMS) if (level >= f.level) form = f;
  return form;
}

/* Progress toward the next form (for the growth bar). */
export function petFormProgress(heroLevel: number): {
  pct: number;
  next: { index: number; name: string; level: number } | null;
  levelsToGo: number;
} {
  const current = petForm(heroLevel);
  const next = PET_FORMS.find((f) => f.level > heroLevel) ?? null;
  if (!next) return { pct: 100, next: null, levelsToGo: 0 };
  const span = next.level - current.level;
  const done = heroLevel - current.level;
  return { pct: Math.max(0, Math.min(100, (done / span) * 100)), next, levelsToGo: next.level - heroLevel };
}

/* Cosmetic gear the creature gains as it evolves (used by the SVG fallback). */
export function petAccessories(formIndex: number): string[] {
  const a: string[] = [];
  if (formIndex >= 1) a.push("bow");
  if (formIndex >= 2) a.push("cape");
  if (formIndex >= 3) a.push("crown");
  return a;
}

/* ---------- Badge / achievement catalog ---------- */
export type Rarity = "common" | "rare" | "epic" | "legendary";
export const RARITY: Record<Rarity, { label: string; color: string }> = {
  common: { label: "Common", color: "#8fdca0" },
  rare: { label: "Rare", color: "#5ec8ff" },
  epic: { label: "Epic", color: "#c77dff" },
  legendary: { label: "Legendary", color: "#ffb45e" },
};

export interface BadgeDef {
  key: string;
  title: string;
  icon: string;
  rarity: Rarity;
  description: string;
  target: number;
  /* current progress toward the badge, from the hero's stats */
  progress: (p: { profile: Profile; counts: TaskCounts }) => number;
}

export interface TaskCounts {
  total: number;
  homework: number;
  chore: number;
  reading: number;
  /** Minutes read — sum of est_minutes across completed reading quests. */
  readingMinutes: number;
  prayer: number;
  quran: number;
  helper: number;
  bed: number;
  morning: number;
}

/* The achievement badges — one rendered badge per entry lives at
   public/ui/badges/<key>.png (src/lib/assets.ts badgeArt). Milestone badges
   (evolution/world/legend) are earned server-side and show target 1 with no
   running counter; the rest track a real count. Requirements follow the
   Official Achievement Library v1.0 (source of truth going forward); keys
   already earned at older thresholds stay unlocked. Keep in sync with
   check_achievements / complete_legend in the database. */
export const BADGES: BadgeDef[] = [
  { key: "first_steps", title: "First Steps", icon: "star", rarity: "common", description: "Finish your very first quest.", target: 1, progress: (x) => x.counts.total },
  { key: "early_bird", title: "Early Bird", icon: "star", rarity: "rare", description: "Finish 7 quests in the morning.", target: 7, progress: (x) => x.counts.morning },
  { key: "bed_master", title: "Bed Master", icon: "home", rarity: "rare", description: "Make your bed 50 times.", target: 50, progress: (x) => x.counts.bed },
  { key: "reading_star", title: "Reading Star", icon: "book", rarity: "rare", description: "Read for 1,000 minutes.", target: 1000, progress: (x) => x.counts.readingMinutes },
  { key: "family_helper", title: "Family Helper", icon: "heart", rarity: "rare", description: "Complete 100 household quests.", target: 100, progress: (x) => x.counts.chore },
  { key: "streak_7", title: "7-Day Streak", icon: "flame", rarity: "rare", description: "Keep a 7-day streak alive.", target: 7, progress: (x) => x.profile.streak_days },
  { key: "homework_hero", title: "Homework Hero", icon: "scroll", rarity: "epic", description: "Finish 100 homework quests.", target: 100, progress: (x) => x.counts.homework },
  { key: "prayer_guardian", title: "Prayer Guardian", icon: "sparkle", rarity: "epic", description: "Complete 100 prayer quests.", target: 100, progress: (x) => x.counts.prayer },
  { key: "quran_companion", title: "Qur'an Companion", icon: "book", rarity: "epic", description: "Complete 50 Qur'an reading quests.", target: 50, progress: (x) => x.counts.quran },
  { key: "first_evolution", title: "First Evolution", icon: "sparkle", rarity: "epic", description: "Evolve your companion for the first time.", target: 1, progress: () => 0 },
  { key: "first_world", title: "World Explorer", icon: "map", rarity: "epic", description: "Complete your very first world.", target: 36, progress: (x) => x.profile.tasks_completed },
  { key: "first_legend", title: "First Legend", icon: "trophy", rarity: "legendary", description: "Guide a companion to become a Legend.", target: 1, progress: () => 0 },
];

export function computeCounts(tasks: Task[]): TaskCounts {
  const done = tasks.filter((t) => t.status === "completed");
  return {
    total: done.length,
    homework: done.filter((t) => t.task_type === "homework").length,
    chore: done.filter((t) => t.task_type === "chore").length,
    reading: done.filter((t) => t.task_type === "reading").length,
    readingMinutes: done
      .filter((t) => t.task_type === "reading")
      .reduce((sum, t) => sum + (t.est_minutes || 0), 0),
    prayer: done.filter((t) => t.task_type === "prayer").length,
    quran: done.filter((t) => t.task_type === "quran").length,
    helper: done.filter((t) => t.task_type === "other" || t.task_type === "habit").length,
    bed: done.filter((t) => t.task_type === "chore" && t.title.toLowerCase().includes("bed")).length,
    morning: done.filter((t) => new Date(t.created_at).getHours() < 12).length,
  };
}

/* ---------- Magical worlds — unlocked as the hero levels up ---------- */
export interface WorldDef {
  id: string;
  name: string;
  unlockLevel: number;
  colors: [string, string];
  accent: string;
}
export const WORLDS: WorldDef[] = [
  { id: "village", name: "Starter Village", unlockLevel: 1, colors: ["#2a4a6e", "#16283f"], accent: "#8fd0ff" },
  { id: "forest", name: "Whispering Forest", unlockLevel: 4, colors: ["#1f4a2e", "#0f2a1a"], accent: "#7ee0a0" },
  { id: "crystal", name: "Crystal Kingdom", unlockLevel: 8, colors: ["#3a2a6e", "#1e1440"], accent: "#c77dff" },
  { id: "dragon", name: "Dragon Mountains", unlockLevel: 13, colors: ["#5a2418", "#2e1008"], accent: "#ff7a4d" },
  { id: "sky", name: "Sky Islands", unlockLevel: 18, colors: ["#2a5a7e", "#123048"], accent: "#9fe4ff" },
  { id: "ocean", name: "Ocean Realm", unlockLevel: 24, colors: ["#0f3a5e", "#06243f"], accent: "#4fd6e0" },
  { id: "frozen", name: "Frozen Peaks", unlockLevel: 30, colors: ["#3a5a7e", "#1e3852"], accent: "#c4ecff" },
  { id: "galaxy", name: "Galaxy Realm", unlockLevel: 36, colors: ["#2a1a5e", "#140a34"], accent: "#b48fff" },
  { id: "celestial", name: "Celestial Castle", unlockLevel: 42, colors: ["#5e4a1a", "#342810"], accent: "#ffd76a" },
];

export function currentWorld(level: number): WorldDef {
  let w = WORLDS[0];
  for (const world of WORLDS) if (level >= world.unlockLevel) w = world;
  return w;
}

/* ---------- Daily surprise events (deterministic by weekday) ---------- */
export interface DailyEvent {
  title: string;
  blurb: string;
  icon: string;
  chestBoost: boolean;
}
/* Indexed by JS getDay(): 0 = Sunday ... 6 = Saturday */
export const DAILY_EVENTS: DailyEvent[] = [
  { title: "Weekend Bonus", blurb: "The realm celebrates all weekend long.", icon: "star", chestBoost: true },
  { title: "Mystery Monday", blurb: "Extra mystery chests are hiding today!", icon: "chest", chestBoost: true },
  { title: "Treasure Tuesday", blurb: "Treasure feels closer than ever.", icon: "chest", chestBoost: true },
  { title: "Wonder Wednesday", blurb: "A brand new day for brave heroes.", icon: "sparkle", chestBoost: false },
  { title: "Thankful Thursday", blurb: "Helping hands shine brightest today.", icon: "users", chestBoost: false },
  { title: "Double XP Friday", blurb: "Every quest feels extra rewarding!", icon: "lightning", chestBoost: true },
  { title: "Weekend Bonus", blurb: "The realm celebrates all weekend long.", icon: "star", chestBoost: true },
];

export function todaysEvent(): DailyEvent {
  return DAILY_EVENTS[new Date().getDay()];
}

export interface Task {
  id: string;
  family_id: string;
  child_id: string;
  title: string;
  description: string;
  task_type: string;
  difficulty: Difficulty;
  est_minutes: number;
  coin_reward: number;
  xp_reward: number;
  deadline: string | null;
  status: "active" | "submitted" | "needs_review" | "completed" | "rejected" | "expired";
  created_at: string;
  completed_at: string | null;
  /** Set only on occurrences materialized from a recurring quest_schedule. */
  schedule_id?: string | null;
  occurrence_date?: string | null;
  slot_key?: string | null;
  /** Informational development pillar (auto-populated; hidden in the v1 UI). */
  pillar?: string | null;
}

/* ---------- Recurring quests (routines) ----------
   A quest_schedule is a lightweight template. generate_due_quests() lazily
   materializes ordinary `tasks` rows from it — one per (schedule, child, local
   day, slot) — so every downstream system (proof, review, XP, companion,
   achievements, challenges) keeps working on plain task rows, unchanged. */

/** A named, stable occurrence within a routine. `key` never changes once
    created (it anchors de-duplication); `label` and `time` are display-only. */
export interface QuestSlot {
  key: string;
  label: string;
  /** optional local "HH:MM" — shown/ordered only; no prayer-time calc in v1. */
  time: string | null;
}

export interface QuestSchedule {
  id: string;
  family_id: string;
  child_id: string;
  created_by: string;
  title: string;
  description: string;
  task_type: string;
  difficulty: Difficulty;
  est_minutes: number;
  coin_reward: number;
  xp_reward: number;
  /** Postgres dow convention: 0=Sunday … 6=Saturday. */
  weekdays: number[];
  slots: QuestSlot[];
  active: boolean;
  ended_at: string | null;
  created_at: string;
  /** Informational development pillar (auto-populated; hidden in the v1 UI). */
  pillar?: string | null;
}

/** Short weekday labels indexed by Postgres dow (0=Sun … 6=Sat). */
export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Weekday shortcut sets (dow arrays). Default families sit in Asia/Kuwait,
    where the school week runs Sun–Thu and the weekend is Fri–Sat. */
export const WEEKDAY_PRESETS: { id: string; label: string; days: number[] }[] = [
  { id: "everyday", label: "Every day", days: [0, 1, 2, 3, 4, 5, 6] },
  { id: "school", label: "School days (Sun–Thu)", days: [0, 1, 2, 3, 4] },
  { id: "weekend", label: "Weekend (Fri–Sat)", days: [5, 6] },
];

/** The five daily prayers as ready-made slots (parent may add optional times). */
export const PRAYER_SLOTS: QuestSlot[] = [
  { key: "fajr", label: "Fajr", time: null },
  { key: "dhuhr", label: "Dhuhr", time: null },
  { key: "asr", label: "Asr", time: null },
  { key: "maghrib", label: "Maghrib", time: null },
  { key: "isha", label: "Isha", time: null },
];

export interface Reward {
  id: string;
  name: string;
  description: string;
  icon: string;
  image_path: string | null;
  coin_cost: number;
  quantity: number | null;
  available: boolean;
  expires_at: string | null;
}
