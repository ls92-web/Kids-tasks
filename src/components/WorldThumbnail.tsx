"use client";

import Image from "next/image";
import { Icon } from "./Icon";

/* A small painted-world preview for cards and lists: the world's map art,
   dimmed to grayscale while locked, with an optional number badge and lock.
   Worlds without delivered art wear their accent gradient + trial icon. */
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
      {map ? (
        <Image
          src={map}
          alt={name}
          fill
          sizes={sizes}
          className="object-cover"
          style={locked ? { filter: "grayscale(0.85) brightness(0.5)" } : undefined}
        />
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
              <Icon name={icon} size={40} filled />
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
