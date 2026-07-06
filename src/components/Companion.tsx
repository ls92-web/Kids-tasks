"use client";

import { useState } from "react";
import { petForm, petElement, ELEMENTS, ElementId } from "@/lib/game";
import { companionArt, companionFormArt } from "@/lib/assets";

/* The one reusable companion renderer for the whole app.
   It shows the official premium art for a creature and AUTOMATICALLY picks the
   correct evolution image from the companion's level:
     Baby (Lv 1) → Explorer (Lv 20) → Hero (Lv 50) → Legend (Lv 100)
   All paths come from the asset pipeline (src/lib/assets.ts) — never built
   here. A soft elemental aura glows behind it and intensifies with each form. */

const AURA_OPACITY = [0.14, 0.22, 0.32, 0.46];
const hex2 = (o: number) => Math.round(o * 255).toString(16).padStart(2, "0");

export function Companion({
  species,
  level,
  size = 96,
  className = "",
  float = true,
  element,
}: {
  species: string;
  level: number;
  size?: number;
  className?: string;
  float?: boolean;
  element?: ElementId;
}) {
  const form = Math.max(0, Math.min(3, petForm(level).index));
  const elColor = element ? ELEMENTS[element].color : petElement(species).color;
  const [fails, setFails] = useState(0);
  // failed high-form art falls back to the baby form before hiding entirely
  const src = fails === 0 ? companionArt(species, level) : companionFormArt(species, 1);

  return (
    <div
      className={`relative inline-block ${float ? "animate-floaty" : ""} ${className}`}
      style={{ width: size, height: size, animationDuration: "4s" }}
    >
      {/* elemental aura — brighter with each evolution form */}
      <div
        className="fx-light pointer-events-none absolute inset-[-14%] rounded-full"
        style={{
          background: `radial-gradient(circle, ${elColor}${hex2(AURA_OPACITY[form])} 0%, transparent 70%)`,
          animation: form >= 2 ? "pulse-glow 2.6s ease-in-out infinite" : undefined,
        }}
      />
      {/* orbiting element sparks appear on higher forms */}
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
                background: elColor,
                boxShadow: `0 0 8px ${elColor}`,
              }}
            />
          </div>
        ))}

      {fails < 2 && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          onError={() => setFails((f) => f + 1)}
          className="absolute inset-0 h-full w-full object-contain"
          style={{ filter: `drop-shadow(0 0 10px ${elColor}66)` }}
        />
      )}
    </div>
  );
}
