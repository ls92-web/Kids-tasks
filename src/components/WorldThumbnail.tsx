"use client";

import Image from "next/image";
import { Icon } from "./Icon";

/* A small painted-world preview for cards and lists. A LOCKED world never
   renders its map art at all — the painting is the reward for unlocking it,
   and an <img> in the DOM can be long-pressed and saved. Locked worlds (and
   worlds without delivered art) wear their accent gradient + icon instead. */
export function WorldThumbnail({
  map,
  name,
  accent,
  icon = "map",
  locked = false,
  index,
  className = "",
  sizes = "176px",
}: {
  /** Map art path from the world config; null renders the gradient fallback. */
  map: string | null;
  name: string;
  accent: string;
  /** Trial icon shown on the gradient fallback. */
  icon?: string;
  locked?: boolean;
  /** Optional 1-based world number badge. */
  index?: number;
  className?: string;
  sizes?: string;
}) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {map && !locked ? (
        <Image src={map} alt={name} fill sizes={sizes} className="object-cover" />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(150deg, ${accent}55, ${accent}11 55%, rgba(0,0,0,0.5)), radial-gradient(80% 80% at 30% 20%, ${accent}33, transparent)`,
            filter: locked ? "grayscale(0.6) brightness(0.6)" : undefined,
          }}
        >
          <div className="grid h-full w-full place-items-center">
            <span style={{ color: locked ? "rgba(255,255,255,0.35)" : accent }}>
              <Icon art name={icon} size={40} filled />
            </span>
          </div>
        </div>
      )}
      {index != null && (
        <span
          className="text-display absolute left-2 top-2 grid h-6 w-6 place-items-center rounded-full text-[11px] font-black text-white"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
        >
          {index}
        </span>
      )}
      {locked && (
        <span className="absolute bottom-2 left-2 grid h-6 w-6 place-items-center rounded-full bg-black/55">
          <Icon name="lock" size={14} art />
        </span>
      )}
    </div>
  );
}
