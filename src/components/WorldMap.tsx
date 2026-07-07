"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Icon } from "./Icon";
import { Companion } from "./Companion";
import { useWorld } from "./ThemeProvider";
import { sfx } from "@/lib/sound";
import { companionLevel } from "@/lib/game";
import { companionLine } from "@/lib/companion";
import { WorldMapDef, nodeStates, MapNode, NodeState } from "@/lib/worlds";
import { glide, EASE_OUT } from "@/lib/motion";

/* The campaign map — the emotional center of the child's world.

   36 steps painted onto each world: quiet dots for ordinary steps, named
   landmark medallions, and the gold trial at step 36. The child's companion
   stands wherever they are in their campaign right now.

   THE ADVANCE SEQUENCE: the map remembers how many campaign steps it showed
   last time (localStorage, per BOND — a new campaign starts fresh). When
   quests were approved since then, it replays the difference — each new node
   lights up in turn, the glowing path extends, and the companion hops forward
   to the new current node. */

const seenKey = (bondId: string) => `qf_map_seen_${bondId}`;

export function WorldMap({
  world,
  campaignStep,
  species,
  holdAnimation = false,
  className = "",
}: {
  /** The campaign world to render — shared or finale (see campaignWorld()). */
  world: WorldMapDef;
  /** The active campaign's progress — the bond's quests_done. */
  campaignStep: number;
  species?: string;
  /** Keep the pre-approval state on screen (e.g. while a celebration overlay
      is up); the advance sequence starts once this flips false. */
  holdAnimation?: boolean;
  className?: string;
}) {
  const { companion: bond } = useWorld();

  // What the map currently DISPLAYS — trails campaignStep during the sequence.
  const [displayed, setDisplayed] = useState<number>(() => {
    if (typeof window === "undefined" || !bond) return campaignStep;
    const stored = parseInt(localStorage.getItem(seenKey(bond.id)) ?? "", 10);
    if (Number.isNaN(stored)) return campaignStep;
    return Math.min(Math.max(stored, 0), campaignStep);
  });
  const [advancing, setAdvancing] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // a tiny reaction when the journey moves forward
  const [bubble, setBubble] = useState<string | null>(null);
  const wasAdvancing = useRef(false);
  useEffect(() => {
    const justFinished = wasAdvancing.current && !advancing;
    wasAdvancing.current = advancing;
    if (justFinished) {
      setBubble(companionLine("nodeUnlocked", species ?? bond?.species ?? "dragon"));
      const t = setTimeout(() => setBubble(null), 4500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advancing]);

  // Play the advance: one step at a time, a heartbeat apart.
  useEffect(() => {
    if (!bond || holdAnimation) return;
    if (displayed >= campaignStep) {
      localStorage.setItem(seenKey(bond.id), String(campaignStep));
      return;
    }
    setAdvancing(true);
    // one heartbeat per step, but cap the whole journey at ~4s for big gaps
    const gap = campaignStep - displayed;
    const stepMs = Math.max(300, Math.min(700, Math.round(4000 / gap)));
    const start = setTimeout(() => {
      timer.current = setInterval(() => {
        setDisplayed((d) => {
          const next = Math.min(d + 1, campaignStep);
          if (next >= campaignStep) {
            if (timer.current) clearInterval(timer.current);
            localStorage.setItem(seenKey(bond.id), String(campaignStep));
            sfx.complete();
            setTimeout(() => setAdvancing(false), 800);
          } else {
            sfx.coin();
          }
          return next;
        });
      }, stepMs);
    }, 900); // let the screen settle before the journey moves
    return () => {
      clearTimeout(start);
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdAnimation, campaignStep, bond?.id]);

  const states = nodeStates(world.levels, displayed);
  const currentIdx = states.indexOf("current");
  const completed = states.filter((s) => s === "completed").length;
  const currentNode =
    currentIdx >= 0 ? world.levels[currentIdx] : world.levels[world.levels.length - 1];


  // Which node's label to float — follows the hero unless the child taps around.
  const [selected, setSelected] = useState<number | null>(null);
  const labelIdx = selected ?? (currentIdx >= 0 ? currentIdx : world.levels.length - 1);

  const linePath = world.levels
    .map((n, i) => `${i === 0 ? "M" : "L"} ${n.x} ${n.y}`)
    .join(" ");
  const doneNodes = world.levels.slice(0, Math.max(1, completed));
  const donePath = doneNodes.map((n, i) => `${i === 0 ? "M" : "L"} ${n.x} ${n.y}`).join(" ");

  const surface = (
    <div className="relative h-full w-full select-none">
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

      {/* connector path — the glowing stretch extends as steps are cleared */}
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
        {completed > 1 && (
          <motion.path
            d={donePath}
            fill="none"
            stroke={world.accent}
            strokeWidth="1.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
            style={{ filter: `drop-shadow(0 0 1.5px ${world.accent})` }}
          />
        )}
      </svg>

      {/* step nodes */}
      {world.levels.map((node, i) => (
        <Node
          key={node.id}
          node={node}
          index={i}
          state={states[i]}
          accent={world.accent}
          finaleIcon={world.finale.icon}
          selected={labelIdx === i}
          justLit={advancing && node.requires === displayed}
          onSelect={() => setSelected(selected === i ? null : i)}
        />
      ))}

      {/* the companion itself — full-body, form-aware art — walking the path.
          When it evolves, the change is visible right here on the map. */}
      {species && currentIdx >= 0 && (
        <motion.div
          className="pointer-events-none absolute z-40"
          initial={false}
          animate={{ left: `${currentNode.x}%`, top: `${currentNode.y}%` }}
          transition={glide}
        >
          {/* static wrapper owns centering — motion owns position + hop */}
          <div className="-translate-x-1/2 -translate-y-[88%]">
            {/* tiny reaction bubble when the path grows */}
            {bubble && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="absolute bottom-full left-1/2 mb-1 w-max max-w-[150px] -translate-x-1/2 rounded-xl bg-black/75 px-2.5 py-1.5 text-center backdrop-blur-sm"
                style={{ borderBottomLeftRadius: 4 }}
              >
                <span className="text-display text-[10px] font-bold leading-tight text-white">
                  {bubble}
                </span>
              </motion.div>
            )}
            <motion.div
              key={currentIdx} // small hop each time the hero arrives somewhere new
              initial={{ y: 0, scale: 1 }}
              animate={{ y: [0, -12, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
              style={{ filter: "drop-shadow(0 6px 8px rgba(0,0,0,0.55))" }}
            >
              <Companion
                species={species}
                level={bond ? companionLevel(bond.xp) : 1}
                size={58}
                float={false}
              />
            </motion.div>
          </div>
        </motion.div>
      )}

      {/* progress chip — always pointing at the finale */}
      <div className="absolute bottom-2 left-2 z-20 rounded-lg bg-black/55 px-2.5 py-1 backdrop-blur-sm">
        <span className="text-display text-[10px] font-black text-white">
          {completed >= world.levels.length
            ? "Chapter complete!"
            : `${completed} / ${world.levels.length} steps — finale: ${world.finale.name}`}
        </span>
      </div>
    </div>
  );

  return (
    <div
      className={`panel relative w-full overflow-hidden ${className}`}
      style={{ aspectRatio: "1280 / 960" }}
    >
      {surface}
    </div>
  );
}

function Node({
  node,
  index,
  state,
  accent,
  finaleIcon,
  selected,
  justLit,
  onSelect,
}: {
  node: MapNode;
  index: number;
  state: NodeState;
  accent: string;
  finaleIcon: string;
  selected: boolean;
  justLit: boolean;
  onSelect: () => void;
}) {
  const isCurrent = state === "current";
  const isFinal = node.kind === "final";
  const isLandmark = node.kind === "landmark";
  const size = isFinal ? 34 : isLandmark || isCurrent ? 24 : 11;
  const gold = "#ffd76a";
  const ring = isFinal ? gold : accent;

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${node.x}%`, top: `${node.y}%`, zIndex: selected || isCurrent ? 30 : isFinal ? 20 : 10 }}
    >
      <motion.button
        type="button"
        onClick={onSelect}
        initial={{ scale: 0 }}
        animate={justLit ? { scale: [1, 1.7, 1] } : { scale: 1 }}
        transition={
          justLit
            ? { duration: 0.5, ease: "easeOut" }
            : { delay: 0.1 + index * 0.02, type: "spring", stiffness: 260, damping: 16 }
        }
        whileTap={{ scale: 0.9 }}
        className="relative grid cursor-pointer place-items-center rounded-full"
        style={{
          width: size,
          height: size,
          background:
            state === "locked"
              ? "rgba(0,0,0,0.6)"
              : isFinal
                ? `radial-gradient(circle at 35% 30%, ${gold}, #b8860b)`
                : `radial-gradient(circle at 35% 30%, ${accent}, ${accent}66)`,
          border: `2px solid ${state === "locked" ? (isFinal ? `${gold}88` : "rgba(255,255,255,0.28)") : ring}`,
          boxShadow: justLit
            ? `0 0 26px ${accent}`
            : isCurrent
              ? `0 0 18px ${accent}`
              : isFinal
                ? state === "completed"
                  ? `0 0 20px ${gold}`
                  : `0 0 12px ${gold}66`
                : state === "completed"
                  ? `0 0 8px ${accent}88`
                  : "0 2px 6px rgba(0,0,0,0.5)",
        }}
        aria-label={`${node.name} — ${state}`}
      >
        {(isCurrent || isFinal) && (
          <span
            className="fx-light absolute inset-[-45%] animate-pulse-glow rounded-full"
            style={{
              background: `radial-gradient(circle, ${isFinal ? gold : accent}55, transparent 70%)`,
            }}
          />
        )}
        {isFinal ? (
          <Icon
            name={state === "locked" ? "lock" : finaleIcon}
            size={16}
            filled
            className={state === "locked" ? "relative text-white/70" : "relative text-white"}
          />
        ) : isLandmark || isCurrent ? (
          <>
            {state === "completed" && <Icon name="check" size={13} className="relative text-white" />}
            {state === "current" && <Icon name="star" size={13} filled className="relative text-white" />}
            {state === "locked" && <Icon name="lock" size={11} className="relative text-white/60" />}
          </>
        ) : (
          <span
            className="relative block rounded-full"
            style={{
              width: 5,
              height: 5,
              background: state === "completed" ? "#fff" : "rgba(255,255,255,0.35)",
            }}
          />
        )}
      </motion.button>

      {/* floating label for the highlighted node */}
      {selected && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute left-1/2 top-full z-40 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-black/75 px-2.5 py-1 text-center backdrop-blur-sm"
        >
          <span className="text-display block text-[10px] font-black leading-tight text-white">
            {isFinal && <Icon name={finaleIcon} size={9} filled className="mr-1 inline text-[var(--gold)]" />}
            {node.name}
          </span>
          <span
            className="text-display block text-[8px] font-bold uppercase tracking-wider"
            style={{
              color:
                state === "completed"
                  ? "var(--success)"
                  : state === "current"
                    ? isFinal
                      ? gold
                      : accent
                    : "rgba(255,255,255,0.5)",
            }}
          >
            {state === "completed"
              ? isFinal
                ? "Chapter complete!"
                : "Cleared"
              : state === "current"
                ? isFinal
                  ? "The final challenge!"
                  : "You are here"
                : isFinal
                  ? "The chapter finale"
                  : `Clear ${node.requires} quests`}
          </span>
        </motion.div>
      )}
    </div>
  );
}
