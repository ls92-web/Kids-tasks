/* THE CAMPAIGN ENGINE.

   Every companion owns its own campaign:

     Shared World 1 → Shared World 2 → Shared World 3 → Exclusive Finale World
       → Legend Ceremony → Hero Hall → Choose Next Companion

   The engine is a PURE SELECTOR over persisted state — it computes the whole
   campaign picture from two database rows and never stores anything itself:

     companions (the bond)   steps_done   → current world / node / completions
                                            (difficulty-weighted: 1/1/2/3)
                             xp           → companion level (growth bar)
                             status       → active | legend
                             legend_at    → when the ceremony sealed it
     profiles (the hero)     coins, xp    → hero economy riding along

   Evolution form follows the CAMPAIGN STEP (campaignForm), so the champion
   grows up exactly as the maps are conquered. Server-side rules keep it
   honest: award_submission advances steps_done (weighted) + quests_done +
   xp on every approval, and complete_legend refuses to seal a Legend before
   steps_done >= campaign_total() (144). One call — getCampaign(profile,
   bond) — hands any screen everything it needs, for any companion. */

import {
  Profile,
  CompanionBond,
  PETS,
  PetDef,
  campaignForm,
  companionLevel,
  companionProgress,
} from "./game";
import {
  WorldMapDef,
  MapNode,
  FinaleWorldDef,
  WORLD_MAPS,
  FINALE_WORLDS,
  SHARED_WORLDS,
  CHAPTER_SPAN,
  WORLDS_PER_CAMPAIGN,
  CAMPAIGN_TOTAL,
  campaignStep,
  campaignWorld,
  finaleWorldMap,
  nodeStates,
  NodeState,
} from "./worlds";

export type WorldProgressState = "locked" | "active" | "completed";

export interface CampaignWorldState {
  /** 0-3 within the campaign; 3 is always the finale. */
  index: number;
  /** Renderable world def (finale worlds included — art + 36 nodes). */
  world: WorldMapDef;
  isFinale: boolean;
  state: WorldProgressState;
  /** Nodes cleared inside this world (0..36). */
  nodesDone: number;
  pct: number;
}

export interface CampaignState {
  /* identity */
  species: string;
  companion: PetDef;
  bond: CompanionBond | null;
  finaleWorld: FinaleWorldDef | null;

  /* campaign position — all derived from the persisted steps_done */
  step: number; // completed nodes across the whole campaign (0..144)
  totalSteps: number; // CAMPAIGN_TOTAL
  worlds: CampaignWorldState[]; // always 4, in order
  currentWorldIndex: number; // 0..3
  currentWorld: CampaignWorldState;
  completedWorlds: number; // 0..4
  completedNodes: number; // alias of step, per-campaign
  /** The world map to RENDER right now (child's chosen theme during shared
      worlds, the companion's own world during the finale). */
  mapWorld: WorldMapDef;
  /** Node states for the rendered map + the node the hero stands on. */
  mapNodeStates: NodeState[];
  currentNode: MapNode | null;

  /* companion growth — derived from the persisted bond xp */
  xp: number;
  level: number;
  evolution: { index: number; name: string; level: number };
  levelProgress: { into: number; needed: number; pct: number };

  /* hero economy riding along (persisted on profiles) */
  coins: number;
  heroXp: number;

  /* the ending */
  campaignCompleted: boolean; // finale world cleared
  legendReady: boolean; // completed + still active → ceremony time
  isLegend: boolean; // sealed into the Hero Hall
  legendAt: string | null;
}

/** The four worlds of a species' campaign, in order. The finale renders from
    its own painted map; every campaign is the same engine, different ending. */
export function campaignWorlds(species: string): WorldMapDef[] {
  const shared = SHARED_WORLDS.map((t) => WORLD_MAPS[t]);
  const finale = finaleWorldMap(species);
  return finale ? [...shared, finale] : shared;
}

/** The whole campaign picture in one call — reusable for every companion. */
export function getCampaign(profile: Profile, bond: CompanionBond | null): CampaignState {
  const species = bond?.species ?? profile.pet;
  const companion = PETS.find((p) => p.id === species) ?? PETS[0];
  const finaleWorld = FINALE_WORLDS[species] ?? null;

  const step = campaignStep(bond);
  const currentWorldIndex = Math.min(Math.floor(step / CHAPTER_SPAN), WORLDS_PER_CAMPAIGN - 1);

  const worlds: CampaignWorldState[] = campaignWorlds(species).map((world, index) => {
    const nodesDone = Math.max(0, Math.min(step - index * CHAPTER_SPAN, CHAPTER_SPAN));
    return {
      index,
      world,
      isFinale: index === WORLDS_PER_CAMPAIGN - 1,
      state:
        nodesDone >= CHAPTER_SPAN ? "completed" : index === currentWorldIndex ? "active" : "locked",
      nodesDone,
      pct: Math.round((nodesDone / CHAPTER_SPAN) * 100),
    };
  });

  const mapWorld = campaignWorld(species, profile.theme, step);
  const mapStates = nodeStates(mapWorld.levels, step);
  const currentIdx = mapStates.indexOf("current");

  const completed = step >= CAMPAIGN_TOTAL;
  const level = bond ? companionLevel(bond.xp) : 1;
  const prog = companionProgress(bond?.xp ?? 0);

  return {
    species,
    companion,
    bond,
    finaleWorld,

    step,
    totalSteps: CAMPAIGN_TOTAL,
    worlds,
    currentWorldIndex,
    currentWorld: worlds[Math.min(currentWorldIndex, worlds.length - 1)],
    completedWorlds: worlds.filter((w) => w.state === "completed").length,
    completedNodes: step,
    mapWorld,
    mapNodeStates: mapStates,
    currentNode: currentIdx >= 0 ? mapWorld.levels[currentIdx] : null,

    xp: bond?.xp ?? 0,
    level,
    // evolution is a STORY milestone: form follows the campaign step, so the
    // champion grows up exactly as the maps are conquered (Legend at 144)
    evolution: campaignForm(step),
    levelProgress: { into: prog.into, needed: prog.needed, pct: prog.pct },

    coins: profile.coins,
    heroXp: profile.xp,

    campaignCompleted: completed,
    legendReady: !!bond && bond.status === "active" && completed,
    isLegend: bond?.status === "legend",
    legendAt: bond?.legend_at ?? null,
  };
}
