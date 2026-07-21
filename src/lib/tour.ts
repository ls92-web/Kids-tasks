/* ============================================================
   Guided onboarding + progressive discovery.

   One tiny engine (src/components/Tour.tsx) drives everything:
   - the parent's calm dashboard tour
   - the child's companion-voiced welcome (an adventure, not a tutorial)
   - one-shot "discovery" tips that appear the first time a feature
     becomes relevant (the shop, the Hero Hall, evolution, the finale)

   Every tour is seen-once per ACCOUNT: profiles.tours_seen is the durable
   record (so a new device or browser never replays a finished tour), and
   localStorage is the synchronous read cache — seeded from the profile at
   session load (syncSeenTours) and appended on completion. Steps point at
   [data-tour="…"] anchors.
   ============================================================ */

import { createClient } from "@/lib/supabase/client";

export interface TourStep {
  /** matches a [data-tour="…"] element; omit for a centered card */
  anchor?: string;
  title?: string;
  text: string;
}

/* A companion "beat" — one short line the child's companion says, optionally
   drifting over to a UI element to gently glow it. No darkening, no tutorial
   chrome: the companion is a partner discovering the world alongside them. */
export interface CoachStep {
  /** matches a [data-tour="…"] element the companion drifts beside + glows */
  anchor?: string;
  text: string;
}

const key = (id: string, profileId: string) => `qf_tour_${id}_${profileId}`;

/* localStorage itself THROWS on iOS with "Block All Cookies" enabled —
   every access is guarded so a tour flag can never break a screen. The
   in-memory fallback keeps the session sane when storage is unavailable. */
const memorySeen = new Set<string>();

export function hasSeenTour(id: string, profileId: string): boolean {
  if (typeof window === "undefined") return true;
  if (memorySeen.has(key(id, profileId))) return true;
  try {
    return localStorage.getItem(key(id, profileId)) === "1";
  } catch {
    return false;
  }
}

export function markTourSeen(id: string, profileId: string) {
  memorySeen.add(key(id, profileId));
  try {
    localStorage.setItem(key(id, profileId), "1");
  } catch {}
  // durable per-account record — a new device/browser won't replay it
  // (supabase-js builders are lazy; .then() actually sends the request)
  void createClient()
    .rpc("mark_tour_seen", { p_tour: id })
    .then(() => {});
}

/** Mirror the account's durable record into the device cache — call once per
    session, right after the profile loads and before screens render. The
    account is the source of truth in BOTH directions: flags it lists are
    seeded, and stale device flags it does NOT list are removed (so resetting
    an account's guides makes them replay on every device). */
export function syncSeenTours(profile: { id: string; tours_seen?: string[] | null }) {
  if (typeof window === "undefined") return;
  const seen = new Set((profile.tours_seen ?? []).map((id) => key(id, profile.id)));
  seen.forEach((k) => {
    memorySeen.add(k);
    try {
      localStorage.setItem(k, "1");
    } catch {}
  });
  // drop this profile's cached flags that the account no longer vouches for
  const suffix = `_${profile.id}`;
  memorySeen.forEach((k) => {
    if (k.startsWith("qf_tour_") && k.endsWith(suffix) && !seen.has(k)) memorySeen.delete(k);
  });
  try {
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("qf_tour_") && k.endsWith(suffix) && !seen.has(k)) stale.push(k);
    }
    stale.forEach((k) => localStorage.removeItem(k));
  } catch {}
}

/** every companion beat, for a full "Adventure Guide" replay reset */
export const CHILD_TOURS = [
  "coach_welcome",
  "coach_map",
  "coach_shop",
  "coach_hall",
  "coach_finale",
];
export const PARENT_TOURS = ["parent", "parent-quest"];

export function resetTours(profileId: string, ids: string[]) {
  ids.forEach((id) => {
    memorySeen.delete(key(id, profileId));
    try {
      localStorage.removeItem(key(id, profileId));
    } catch {}
  });
}

/* ---------- Help topics (kept to two short sentences each) ---------- */

export interface HelpTopic {
  icon: string;
  title: string;
  body: string;
}

export const CHILD_HELP: HelpTopic[] = [
  {
    icon: "star",
    title: "Your companion",
    body: "Your companion travels with you on every quest and grows stronger as you do. They stay by your side until they become Legendary.",
  },
  {
    icon: "map",
    title: "The world map",
    body: "Every finished quest walks you one step along the map. The gold node at the end is the world's final challenge.",
  },
  {
    icon: "sword",
    title: "Campaigns",
    body: "A campaign is four worlds travelled together with one companion. The last world belongs to them alone.",
  },
  {
    icon: "chest",
    title: "Treasures",
    body: "Coins you earn buy real rewards in the Treasure Vault. Your parent makes them real.",
  },
  {
    icon: "trophy",
    title: "The Hero Hall",
    body: "Every companion who finishes their adventure with you stands in the Hall forever. Locked companions are still waiting to meet you.",
  },
  {
    icon: "flame",
    title: "Legends",
    body: "Finish a whole campaign and your companion becomes a Legend. Only then does a new companion join you.",
  },
];

export const PARENT_HELP: HelpTopic[] = [
  {
    icon: "users",
    title: "Your family",
    body: "Your Family Code (on the Heroes page) is the invitation — your child joins with it and picks a hero name and secret PIN. You can also create heroes yourself.",
  },
  {
    icon: "sword",
    title: "Quests",
    body: "Create real-life quests and assign them to a hero. Difficulty fills in fair coins, XP and time — tweak anything.",
  },
  {
    icon: "eye",
    title: "Approvals",
    body: "When your child submits a photo proof, it lands in Review. Nothing is awarded until you approve it.",
  },
  {
    icon: "gift",
    title: "Rewards",
    body: "Stock real-life rewards that coins can buy. When a child claims one, you mark it granted once it happens for real.",
  },
  {
    icon: "sparkle",
    title: "Companions & XP",
    body: "Every approved quest gives XP that grows your child's companion through a four-world campaign. Completing the final world makes it a Legend.",
  },
];
