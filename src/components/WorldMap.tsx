"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Icon } from "./Icon";
import { CompanionPortrait } from "./CompanionPortrait";
import { ThemeId } from "@/lib/game";
import { WORLD_MAPS, nodeStates, MapNode } from "@/lib/worlds";

/* The hero's journey painted onto the world map for their chosen theme.
   Level nodes sit at percentage coordinates over the artwork, so they stay
   locked to the same spot on the path at any screen size. Cleared nodes glow,
   the current node pulses (with the child's companion perched on it), and
   locked nodes stay shadowed to pull the child forward. */

export function WorldMap({
  theme,
  tasksCompleted,
  species,
  className = "",
}: {
  theme: ThemeId;
  tasksCompleted: number;
  species?: string;
  className?: string;
}) {
  const world = WORLD_MAPS[theme];
  const states = nodeStates(world.levels, tasksCompleted);
  const currentIdx = states.indexOf("current");
  const completed = states.filter((s) => s === "completed").length;

  // Which node's label to float — defaults to where the hero is now.
  const [selected, setSelected] = useState<number>(currentIdx >= 0 ? currentIdx : 0);

  // Dotted connector tracing the node order, so progression reads even where
  // the painted path dips behind scenery.
  const linePath = world.levels
    .map((n, i) => `${i === 0 ? "M" : "L"} ${n.x} ${n.y}`)
    .join(" ");
  const doneCount = Math.max(1, completed);
  const donePath = world.levels
    .slice(0, doneCount)
    .map((n, i) => `${i === 0 ? "M" : "L"} ${n.x} ${n.y}`)
    .join(" ");

  return (
    <div
      className={`panel panel-glow relative w-full select-none overflow-hidden ${className}`}
      style={{ aspectRatio: "1280 / 960" }}
    >
      <Image
        src={world.map}
        alt={`${world.name} map`}
        fill
        priority
        sizes="(max-width: 640px) 100vw, 640px"
        className="object-cover"
      />
      {/* soft vignette so nodes + labels stay legible over bright artwork */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_40%,transparent_55%,rgba(0,0,0,0.35))]" />

      {/* connector path */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        <path
          d={linePath}
          fill="none"
          stroke="rgba(0,0,0,0.35)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={linePath}
          fill="none"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="0.8"
          strokeDasharray="2 2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {doneCount > 1 && (
          <motion.path
            d={donePath}
            fill="none"
            stroke={world.accent}
            strokeWidth="1.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.4, ease: "easeInOut" }}
            style={{ filter: `drop-shadow(0 0 1.5px ${world.accent})` }}
          />
        )}
      </svg>

      {/* level nodes */}
      {world.levels.map((node, i) => (
        <Node
          key={node.id}
          node={node}
          index={i}
          state={states[i]}
          accent={world.accent}
          selected={selected === i}
          onSelect={() => setSelected(i)}
          species={states[i] === "current" ? species : undefined}
        />
      ))}

      {/* progress chip */}
      <div className="absolute bottom-2 left-2 z-20 rounded-lg bg-black/55 px-2.5 py-1 backdrop-blur-sm">
        <span className="text-display text-[10px] font-black text-white">
          {completed} / {world.levels.length} levels cleared
        </span>
      </div>
    </div>
  );
}

function Node({
  node,
  index,
  state,
  accent,
  selected,
  onSelect,
  species,
}: {
  node: MapNode;
  index: number;
  state: "completed" | "current" | "locked";
  accent: string;
  selected: boolean;
  onSelect: () => void;
  species?: string;
}) {
  const size = state === "current" ? 30 : 24;
  return (
    <div
      className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${node.x}%`, top: `${node.y}%` }}
    >
      {/* hero token perched above the current node */}
      {species && state === "current" && (
        <div className="absolute -top-1 left-1/2 z-30 -translate-x-1/2 -translate-y-full animate-floaty">
          <CompanionPortrait species={species} size={34} />
        </div>
      )}

      <motion.button
        type="button"
        onClick={onSelect}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.15 + index * 0.08, type: "spring", stiffness: 240, damping: 15 }}
        whileTap={{ scale: 0.9 }}
        className="relative grid cursor-pointer place-items-center rounded-full"
        style={{
          width: size,
          height: size,
          background:
            state === "locked"
              ? "rgba(0,0,0,0.6)"
              : `radial-gradient(circle at 35% 30%, ${accent}, ${accent}66)`,
          border: `2px solid ${state === "locked" ? "rgba(255,255,255,0.28)" : accent}`,
          boxShadow:
            state === "current"
              ? `0 0 18px ${accent}`
              : state === "completed"
                ? `0 0 9px ${accent}88`
                : "0 2px 6px rgba(0,0,0,0.5)",
        }}
        aria-label={`${node.name} — ${state}`}
      >
        {state === "current" && (
          <span
            className="fx-light absolute inset-[-45%] animate-pulse-glow rounded-full"
            style={{ background: `radial-gradient(circle, ${accent}55, transparent 70%)` }}
          />
        )}
        {state === "completed" && (
          <Icon name="check" size={13} className="relative text-white" />
        )}
        {state === "current" && (
          <Icon name="star" size={13} filled className="relative text-white" />
        )}
        {state === "locked" && (
          <Icon name="lock" size={11} className="relative text-white/60" />
        )}
      </motion.button>

      {/* floating label for the selected node */}
      {selected && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute left-1/2 top-full z-40 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-black/75 px-2.5 py-1 text-center backdrop-blur-sm"
        >
          <span className="text-display block text-[10px] font-black leading-tight text-white">
            {node.name}
          </span>
          <span
            className="text-display block text-[8px] font-bold uppercase tracking-wider"
            style={{
              color:
                state === "completed"
                  ? "var(--success)"
                  : state === "current"
                    ? accent
                    : "rgba(255,255,255,0.5)",
            }}
          >
            {state === "completed"
              ? "Cleared"
              : state === "current"
                ? "You are here"
                : `Clear ${node.requires} quests`}
          </span>
        </motion.div>
      )}
    </div>
  );
}
