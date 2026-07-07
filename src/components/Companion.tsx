"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { petForm, petElement, ELEMENTS, ElementId } from "@/lib/game";
import { companionArt, companionFormArt } from "@/lib/assets";
import { COMPANION_SAY_EVENT, CompanionEvent } from "@/lib/companion";
import { sfx } from "@/lib/sound";

/* The one reusable companion renderer for the whole app — now alive.

   IDLE (always): breathing, a whole-body micro-sway (the tail/ear feel on
   flat art), a periodic blink-squash, optional floating. Layered on nested
   wrappers so the transforms compose; all respect the child's animation
   intensity setting ([data-anim="minimal"] stops CSS loops).

   INTERACTIVE (opt-in): hover scale + brighter glow + deeper shadow, and a
   poke — tapping the creature makes it do its happy hop with a tiny chirp.
   SELECTED (opt-in): soft steady glow + one small bounce when chosen.
   REACTIVE (opt-in): listens to the companion event bus —
     quest completed → a happy jump with sparkles
     level up / legendary → a magic burst and light pulse
   CELEBRATE: plays the happy jump once on mount (celebration overlay).
   EVOLUTION: when the form changes while mounted, a flash-and-burst
   transition crossfades into the new art.
   LEGEND (form 3): ambient drifting motes, gold-warmed aura.

   Everything stays small and slow — presence, not performance. */

const AURA_OPACITY = [0.14, 0.22, 0.32, 0.46];
const GOLD = "#ffd76a";
const hex2 = (o: number) => Math.round(o * 255).toString(16).padStart(2, "0");

type Reaction = "cheer" | "burst" | null;

export function Companion({
  species,
  level,
  size = 96,
  className = "",
  float = true,
  element,
  interactive = false,
  selected = false,
  reactive = false,
  celebrate = false,
}: {
  species: string;
  level: number;
  size?: number;
  className?: string;
  float?: boolean;
  element?: ElementId;
  /** Hover: gentle scale, brighter glow, deeper shadow. */
  interactive?: boolean;
  /** Chosen state: soft steady glow + a small bounce when it flips true. */
  selected?: boolean;
  /** React to the companion event bus (quest done, level up, legendary). */
  reactive?: boolean;
  /** Play the happy jump + sparkles once on mount. */
  celebrate?: boolean;
}) {
  const form = Math.max(0, Math.min(3, petForm(level).index));
  const isLegend = form >= 3;
  const elColor = element ? ELEMENTS[element].color : petElement(species).color;
  const glowColor = isLegend ? GOLD : elColor;

  const [fails, setFails] = useState(0);
  const src = fails === 0 ? companionArt(species, level) : companionFormArt(species, 1);

  /* ---- reactions (one-shot, keyed so sparkles re-render) ---- */
  const [reaction, setReaction] = useState<Reaction>(celebrate ? "cheer" : null);
  const [reactionKey, setReactionKey] = useState(0);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function play(r: Exclude<Reaction, null>) {
    setReaction(r);
    setReactionKey((k) => k + 1);
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setReaction(null), 1100);
  }

  useEffect(() => {
    if (!reactive) return;
    function onSay(e: Event) {
      const ev = (e as CustomEvent<{ event: CompanionEvent }>).detail?.event;
      if (ev === "questDone" || ev === "allDone") play("cheer");
      if (ev === "levelUp" || ev === "legendary" || ev === "evolved") play("burst");
    }
    window.addEventListener(COMPANION_SAY_EVENT, onSay);
    return () => window.removeEventListener(COMPANION_SAY_EVENT, onSay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reactive]);

  useEffect(() => () => {
    if (clearTimer.current) clearTimeout(clearTimer.current);
  }, []);

  /* ---- evolution transition: form changed while on screen ---- */
  const prevForm = useRef(form);
  const [evolving, setEvolving] = useState(false);
  useEffect(() => {
    if (prevForm.current !== form) {
      prevForm.current = form;
      setEvolving(true);
      play("burst");
      const t = setTimeout(() => setEvolving(false), 900);
      return () => clearTimeout(t);
    }
  }, [form]);

  /* ---- selection bounce: only when selected flips true ---- */
  const [selBounce, setSelBounce] = useState(0);
  const prevSelected = useRef(selected);
  useEffect(() => {
    if (selected && !prevSelected.current) setSelBounce((k) => k + 1);
    prevSelected.current = selected;
  }, [selected]);

  return (
    <div
      className={`group relative inline-block ${float ? "animate-floaty" : ""} ${
        interactive ? "cursor-pointer" : ""
      } ${className}`}
      style={{ width: size, height: size, animationDuration: "4s" }}
      onClick={
        interactive
          ? () => {
              // a poke! the creature answers with its happy hop
              play("cheer");
              sfx.chirp();
            }
          : undefined
      }
    >
      {/* elemental aura — brighter with each form, gold-warmed for Legends,
          stronger while hovered or selected */}
      <div
        className={`fx-light pointer-events-none absolute inset-[-14%] rounded-full transition-opacity duration-300 ${
          interactive ? "opacity-90 group-hover:opacity-100" : ""
        }`}
        style={{
          background: `radial-gradient(circle, ${glowColor}${hex2(
            Math.min(0.6, AURA_OPACITY[form] + (selected ? 0.14 : 0))
          )} 0%, transparent 70%)`,
          animation: form >= 2 || selected ? "pulse-glow 2.6s ease-in-out infinite" : undefined,
        }}
      />

      {/* orbiting element sparks on higher forms */}
      {form >= 1 &&
        Array.from({ length: form }).map((_, i) => (
          <div
            key={i}
            className="fx-light pointer-events-none absolute left-1/2 top-1/2"
            style={{ animation: `rays-spin ${5 + i}s linear infinite`, transformOrigin: "0 0" }}
          >
            <div
              className="rounded-full"
              style={{
                width: 5,
                height: 5,
                transform: `translate(${size * 0.42}px, 0)`,
                background: glowColor,
                boxShadow: `0 0 8px ${glowColor}`,
              }}
            />
          </div>
        ))}

      {/* Legends breathe gold — slow ambient motes drifting upward */}
      {isLegend && (
        <div className="fx-light pointer-events-none absolute inset-0 overflow-visible">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="absolute rounded-full"
              style={{
                width: 3.5,
                height: 3.5,
                left: `${22 + i * 26}%`,
                bottom: "6%",
                background: GOLD,
                boxShadow: `0 0 6px ${GOLD}`,
              }}
              animate={{ y: [0, -size * 0.55], opacity: [0, 0.85, 0] }}
              transition={{
                duration: 3.4 + i * 0.7,
                delay: i * 1.1,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
          ))}
        </div>
      )}

      {/* reaction sparkles — a small ring of joy, then gone */}
      {reaction && (
        <div key={reactionKey} className="pointer-events-none absolute inset-0 z-10">
          {Array.from({ length: reaction === "burst" ? 8 : 6 }).map((_, i) => {
            const n = reaction === "burst" ? 8 : 6;
            const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
            const dist = size * (reaction === "burst" ? 0.62 : 0.5);
            return (
              <motion.span
                key={i}
                className="absolute left-1/2 top-1/2 rounded-full"
                style={{
                  width: reaction === "burst" ? 5 : 4,
                  height: reaction === "burst" ? 5 : 4,
                  background: i % 3 === 0 ? "#fff" : glowColor,
                  boxShadow: `0 0 8px ${glowColor}`,
                }}
                initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
                animate={{
                  x: Math.cos(angle) * dist,
                  y: Math.sin(angle) * dist,
                  opacity: [0, 1, 0],
                  scale: [0.4, 1, 0.5],
                }}
                transition={{ duration: 0.85, ease: "easeOut" }}
              />
            );
          })}
          {/* light pulse behind a magic burst */}
          {reaction === "burst" && (
            <motion.span
              className="absolute inset-[-10%] rounded-full"
              style={{ background: `radial-gradient(circle, ${glowColor}66, transparent 70%)` }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: [0, 0.9, 0], scale: [0.6, 1.35] }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            />
          )}
        </div>
      )}

      {/* evolution flash — a breath of white light as the new form arrives */}
      {evolving && (
        <motion.span
          className="pointer-events-none absolute inset-[-6%] z-10 rounded-full"
          style={{ background: `radial-gradient(circle, #fff, ${glowColor}55 60%, transparent 75%)` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.95, 0] }}
          transition={{ duration: 0.8, times: [0, 0.3, 1] }}
        />
      )}

      {/* the creature — breathe > sway > blink layers, then reactions */}
      {fails < 2 && (
        <div
          className="fx-light absolute inset-0"
          style={{
            animation: "companion-breathe 3.6s ease-in-out infinite",
            transformOrigin: "50% 100%",
          }}
        >
          <div
            className="h-full w-full"
            style={{
              animation: "companion-sway 6.8s ease-in-out infinite",
              transformOrigin: "50% 92%",
            }}
          >
            <div
              className="h-full w-full"
              style={{
                animation: "companion-blink 5.4s ease-in-out infinite",
                transformOrigin: "50% 78%",
              }}
            >
              <motion.div
                key={`sel-${selBounce}`}
                className="h-full w-full"
                animate={
                  reaction === "cheer"
                    ? { y: [0, -size * 0.14, 0, -size * 0.05, 0], scale: [1, 1.04, 1, 1.02, 1] }
                    : reaction === "burst"
                      ? { scale: [1, 1.07, 0.98, 1] }
                      : selBounce > 0
                        ? { scale: [1, 1.06, 1] }
                        : {}
                }
                transition={{ duration: reaction === "cheer" ? 0.9 : 0.55, ease: "easeOut" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  width={size}
                  height={size}
                  onError={() => setFails((f) => f + 1)}
                  className={`absolute inset-0 h-full w-full object-contain transition-all duration-300 ${
                    interactive ? "group-hover:scale-[1.035]" : ""
                  }`}
                  style={{
                    filter: `drop-shadow(0 0 10px ${glowColor}66)`,
                  }}
                />
              </motion.div>
            </div>
          </div>
        </div>
      )}

      {/* deeper grounding shadow on hover */}
      {interactive && (
        <div
          className="pointer-events-none absolute inset-x-[18%] bottom-[-2%] h-[7%] rounded-full opacity-0 blur-[3px] transition-opacity duration-300 group-hover:opacity-60"
          style={{ background: "rgba(0,0,0,0.7)" }}
        />
      )}
    </div>
  );
}
