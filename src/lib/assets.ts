/* THE asset pipeline — every image path in the app comes from here.

   Folder structure (public/):
     companions/<name>/portrait.png            the circular portrait art
     companions/<name>/level{1,20,50,100}.png  the four evolution forms
     worlds/<world-id>/map.png                 painted world map (shared + finale)

   Components never build paths themselves; they call these helpers. Adding
   art = dropping files into the structure and (for a new world) adding its
   entry to the world config. */

import { petForm } from "./game";

export const ASSET_ROOTS = {
  companions: "/companions",
  worlds: "/worlds",
  badges: "/ui/badges",
  icons: "/ui/icons",
} as const;

/** Rendered achievement-badge art (public/ui/badges/<key>.png). Every key in the
    BADGES catalog has a matching file. */
export function badgeArt(key: string): string {
  return `${ASSET_ROOTS.badges}/${key}.png`;
}

/** Delivered rendered icon art for the quest-type emblems, used instead of
    the flat SVG icon set (public/ui/icons/<slug>.png). Slugs:
    home · scroll · book · heart · magic · energy · star */
export function iconArt(slug: string): string {
  return `${ASSET_ROOTS.icons}/${slug}.png`;
}

/* species id → companion folder (named after the companion, per the art drop) */
export const COMPANION_DIRS: Record<string, string> = {
  dragon: "ember",
  fox: "frost",
  owl: "professor-hoot",
  wolf: "shade",
  tiger: "rai",
  phoenix: "blaze",
  turtle: "shellby",
  forest: "sprout",
  robot: "bolt",
  ninja: "kage",
  samurai: "kenji",
  pirate: "coco",
};

/** The four delivered form levels — matches PET_FORMS in game.ts. */
export type FormLevel = 1 | 20 | 50 | 100;

function companionDir(species: string): string {
  return `${ASSET_ROOTS.companions}/${COMPANION_DIRS[species] ?? species}`;
}

/** Full-body art for an exact form level (level1/level20/level50/level100). */
export function companionFormArt(species: string, formLevel: FormLevel): string {
  return `${companionDir(species)}/level${formLevel}.png`;
}

/** Full-body art for whatever form a companion at `level` has evolved into. */
export function companionArt(species: string, level: number): string {
  return companionFormArt(species, petForm(level).level as FormLevel);
}

/** The circular portrait medallion art. */
export function companionPortraitArt(species: string): string {
  return `${companionDir(species)}/portrait.png`;
}

/** A world's painted map (shared worlds and finale worlds alike). */
export function worldMapArt(worldId: string): string {
  return `${ASSET_ROOTS.worlds}/${worldId}/map.png`;
}
