"use client";

import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import { useWorld } from "@/components/ThemeProvider";
import { WorldMap } from "@/components/WorldMap";
import { Icon } from "@/components/Icon";
import { sfx } from "@/lib/sound";
import { getCampaign, CampaignWorldState } from "@/lib/campaign";
import { FINALE_WORLDS, finaleWorldMap } from "@/lib/worlds";

/* An opened world: the painted map shown in full, nodes/paths/states all
   rendered by code over the untouched artwork. Reached by tapping a world
   card on the Companion Campaign screen; only the page itself scrolls. */

export default function WorldPage() {
  const router = useRouter();
  const params = useParams<{ worldId: string }>();
  const { profile, companion } = useWorld();

  if (!profile) return null;
  const cs = getCampaign(profile, companion);
  let entry: CampaignWorldState | undefined = cs.worlds.find(
    (w) => w.world.id === params.worldId
  );

  // Not part of the active campaign? Any finale world can still be viewed
  // as a locked preview (also how the path-editing tour reaches every map).
  if (!entry) {
    const species = Object.keys(FINALE_WORLDS).find(
      (sp) => FINALE_WORLDS[sp].id === params.worldId
    );
    const world = species ? finaleWorldMap(species) : null;
    if (world) {
      entry = { index: 3, world, isFinale: true, state: "locked", nodesDone: 0, pct: 0 };
    }
  }

  if (!entry) {
    // unknown world id — back to the campaign overview
    router.replace("/app/campaign");
    return null;
  }

  const { world } = entry;
  const isHere = cs.mapWorld.id === world.id;

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={() => {
          sfx.click();
          router.back();
        }}
        className="text-display flex w-fit cursor-pointer items-center gap-1.5 text-sm font-bold text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
      >
        <Icon name="arrowLeft" size={16} /> Back
      </button>

      {/* world header — quiet, one line of story */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-display text-2xl font-black" style={{ color: world.accent }}>
            {world.name}
          </h1>
          <span
            className="text-display rounded-md bg-black/35 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
            style={{
              color:
                entry.state === "completed"
                  ? "var(--success)"
                  : entry.state === "active"
                    ? world.accent
                    : "var(--text-dim)",
            }}
          >
            {entry.state === "completed"
              ? "Conquered!"
              : entry.state === "active"
                ? "Exploring"
                : "Locked"}
          </span>
          <span className="text-display text-xs font-bold text-[var(--text-dim)]">
            {entry.nodesDone}/{world.levels.length} steps
          </span>
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--text-dim)]">
          <Icon art name={world.finale.icon} size={14} className="shrink-0 text-[var(--gold)]" />
          {world.finale.blurb}
        </p>
      </motion.div>

      {/* The world itself — fully in view; the page does the scrolling.
          A LOCKED world stays a mystery: its painting is the reward for
          reaching it, so nothing of the art is rendered until then. */}
      {entry.state === "locked" ? (
        <div
          className="panel grid place-items-center overflow-hidden"
          style={{
            aspectRatio: "1280 / 960",
            background: `radial-gradient(80% 80% at 50% 30%, ${world.accent}22, transparent), linear-gradient(170deg, rgba(10,14,30,0.95), rgba(4,6,16,0.98))`,
          }}
        >
          <div className="flex flex-col items-center gap-3 px-6 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-black/40">
              <Icon name="lock" size={34} art />
            </span>
            <p className="text-display text-lg font-black" style={{ color: world.accent }}>
              This world is still hidden
            </p>
            <p className="max-w-xs text-sm text-[var(--text-dim)]">
              Keep adventuring — its map is revealed the moment you unlock it.
            </p>
          </div>
        </div>
      ) : (
        <WorldMap world={world} campaignStep={cs.step} species={isHere ? cs.species : undefined} />
      )}
    </div>
  );
}
