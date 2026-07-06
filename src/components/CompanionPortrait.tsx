"use client";

import { useState } from "react";
import { petElement } from "@/lib/game";

/* A child's avatar = their companion's premium portrait, framed in a circular
   medallion ringed in the creature's elemental color. Replaces the old SVG
   animal crest. Art: /public/companions/<species>-portrait.png. */
export function CompanionPortrait({
  species,
  size = 52,
  className = "",
  ring = true,
}: {
  species: string;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  const el = petElement(species);
  const [failed, setFailed] = useState(false);
  const src = failed ? `/companions/${species}-0.png` : `/companions/${species}-portrait.png`;

  return (
    <div className={`relative inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
      <div
        className="relative h-full w-full overflow-hidden rounded-full"
        style={{
          background: `radial-gradient(circle at 40% 30%, ${el.color}33, rgba(0,0,0,0.55))`,
          boxShadow: ring
            ? `0 0 0 2px ${el.color}cc, 0 0 14px -2px ${el.color}, inset 0 0 0 3px rgba(255,255,255,0.08)`
            : undefined,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ transform: "scale(1.06)" }}
        />
      </div>
    </div>
  );
}
