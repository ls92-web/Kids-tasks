"use client";

import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import { useWorld } from "@/components/ThemeProvider";
import { WorldMap } from "@/components/WorldMap";
import { Icon } from "@/components/Icon";
import { sfx } from "@/lib/sound";
import { getCampaign } from "@/lib/campaign";

/* An opened world: the painted map shown in full, nodes/paths/states all
   rendered by code over the untouched artwork. Reached by tapping a world
   card on the Companion Campaign screen; only the page itself scrolls. */

export default function WorldPage() {
  const router = useRouter();
  const params = useParams<{ worldId: string }>();
  const { profile, companion } = useWorld();

  if (!profile) return null;
  const cs = getCampaign(profile, companion);
  const entry = cs.worlds.find((w) => w.world.id === params.worldId);

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
          <h1 className="text-display text-glow text-2xl font-black" style={{ color: world.accent }}>
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
              ? "Completed"
              : entry.state === "active"
                ? "Exploring"
                : "Locked"}
          </span>
          <span className="text-display text-xs font-bold text-[var(--text-dim)]">
            {entry.nodesDone}/{world.levels.length} steps
          </span>
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-[var(--text-dim)]">
          <Icon name={world.finale.icon} size={14} className="shrink-0 text-[var(--gold)]" />
          {world.finale.blurb}
        </p>
      </motion.div>

      {/* the world itself — fully in view; the page does the scrolling */}
      <WorldMap world={world} campaignStep={cs.step} species={isHere ? cs.species : undefined} />
    </div>
  );
}
