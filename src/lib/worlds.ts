/* World-map configuration — data-driven so level nodes can be re-placed freely.

   Each world is keyed by ThemeId and carries its painted map plus a list of
   level nodes positioned as PERCENTAGE coordinates over that map image
   (x = % from left, y = % from top). Because they're percentages they stay
   glued to the same spot on the artwork at every screen size — tweak the
   numbers below to nudge a node along the path, no code changes needed.

   `requires` = how many quests the hero must complete to clear that node.
   A node is `completed` once tasks_completed >= requires, the first
   not-yet-cleared node is `current`, and everything after it is `locked`. */

import { ThemeId } from "./game";

export interface MapNode {
  id: string;
  name: string;
  x: number; // % from left of the map image
  y: number; // % from top of the map image
  requires: number; // quests completed needed to clear this node
}

export interface WorldMapDef {
  id: string; // matches the public/worlds/<id>/ folder
  name: string;
  theme: ThemeId;
  map: string; // path under /public
  accent: string; // themed glow colour for the path + nodes
  levels: MapNode[];
}

// Shared unlock ladder — how many quests each successive node asks for.
const LADDER = [1, 3, 6, 10, 15, 21, 28, 36];

export const WORLD_MAPS: Record<ThemeId, WorldMapDef> = {
  ninja: {
    id: "shadow-ninja-village",
    name: "Shadow Ninja Village",
    theme: "ninja",
    map: "/worlds/shadow-ninja-village/map.png",
    accent: "#6ea8ff",
    // winding stone path: bottom-left cluster → bridge → castle top-right
    levels: [
      { id: "n1", name: "Bamboo Gate", x: 34, y: 74, requires: LADDER[0] },
      { id: "n2", name: "Lantern Bridge", x: 27, y: 63, requires: LADDER[1] },
      { id: "n3", name: "Whispering Forest", x: 39, y: 56, requires: LADDER[2] },
      { id: "n4", name: "Rooftop Run", x: 50, y: 53, requires: LADDER[3] },
      { id: "n5", name: "Moon Shrine", x: 58, y: 47, requires: LADDER[4] },
      { id: "n6", name: "Smoke Canyon", x: 65, y: 42, requires: LADDER[5] },
      { id: "n7", name: "Blossom Peak", x: 70, y: 33, requires: LADDER[6] },
      { id: "n8", name: "Shadow Citadel", x: 72, y: 24, requires: LADDER[7] },
    ],
  },
  samurai: {
    id: "legend-samurai",
    name: "Legend of the Samurai",
    theme: "samurai",
    map: "/worlds/legend-samurai/map.png",
    accent: "#f4b740",
    // golden path: bottom-centre → red bridges → castle top-right
    levels: [
      { id: "s1", name: "Village Gate", x: 49, y: 82, requires: LADDER[0] },
      { id: "s2", name: "Rice Terraces", x: 49, y: 70, requires: LADDER[1] },
      { id: "s3", name: "Golden Maple Road", x: 53, y: 60, requires: LADDER[2] },
      { id: "s4", name: "Mountain Dojo", x: 56, y: 50, requires: LADDER[3] },
      { id: "s5", name: "Sacred Torii", x: 57, y: 42, requires: LADDER[4] },
      { id: "s6", name: "Thunder Pass", x: 56, y: 34, requires: LADDER[5] },
      { id: "s7", name: "Temple of Echoes", x: 61, y: 27, requires: LADDER[6] },
      { id: "s8", name: "Summit of Legends", x: 66, y: 19, requires: LADDER[7] },
    ],
  },
  speed: {
    id: "speed-realm",
    name: "Speed Realm",
    theme: "speed",
    map: "/worlds/speed-realm/map.png",
    accent: "#22d3ee",
    // neon racetrack: bottom-centre → loop → trophy tower top-centre
    levels: [
      { id: "r1", name: "Launch Pad", x: 50, y: 88, requires: LADDER[0] },
      { id: "r2", name: "Neon Loop", x: 55, y: 77, requires: LADDER[1] },
      { id: "r3", name: "Crystal Cavern", x: 64, y: 67, requires: LADDER[2] },
      { id: "r4", name: "Skyway Sprint", x: 68, y: 56, requires: LADDER[3] },
      { id: "r5", name: "Magnet Rail", x: 58, y: 48, requires: LADDER[4] },
      { id: "r6", name: "Storm Circuit", x: 49, y: 42, requires: LADDER[5] },
      { id: "r7", name: "Prism Tower", x: 49, y: 32, requires: LADDER[6] },
      { id: "r8", name: "Infinity Ring", x: 53, y: 20, requires: LADDER[7] },
    ],
  },
};

export type NodeState = "completed" | "current" | "locked";

/** State of every node given how many quests the child has completed. */
export function nodeStates(levels: MapNode[], tasksCompleted: number): NodeState[] {
  let currentAssigned = false;
  return levels.map((lvl) => {
    if (tasksCompleted >= lvl.requires) return "completed";
    if (!currentAssigned) {
      currentAssigned = true;
      return "current";
    }
    return "locked";
  });
}

/** Progress summary for captions: cleared count + the node you're on. */
export function worldProgress(world: WorldMapDef, tasksCompleted: number) {
  const states = nodeStates(world.levels, tasksCompleted);
  const completed = states.filter((s) => s === "completed").length;
  const currentIdx = states.indexOf("current");
  return {
    completed,
    total: world.levels.length,
    current: currentIdx >= 0 ? world.levels[currentIdx] : null,
    states,
  };
}
