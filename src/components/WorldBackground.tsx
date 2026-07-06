"use client";

import { useWorld } from "./ThemeProvider";

/* One elegant, calm background per world — a large soft gradient plus light
   environmental silhouettes. No particles, no moons, no motion. The world
   sets the mood; the UI carries the story. */

export function WorldBackground() {
  const { theme } = useWorld();

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {/* soft sky gradient driven by the theme's palette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% -10%, var(--bg-2), var(--bg-1) 55%, var(--bg-0))",
        }}
      />

      {/* one quiet horizon silhouette per world */}
      <svg
        viewBox="0 0 1200 320"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-x-0 bottom-0 h-[38vh] w-full opacity-[0.35]"
      >
        {theme.id === "ninja" && (
          <g fill="var(--bg-0)">
            {/* rooftop ridge line */}
            <path d="M0 320 L0 240 L90 240 L120 200 L150 240 L260 240 L260 210 L300 170 L340 210 L340 240 L470 240 L500 205 L530 240 L640 240 L640 190 L680 150 L720 190 L720 240 L850 240 L880 210 L910 240 L1020 240 L1050 205 L1080 240 L1200 240 L1200 320 Z" />
            <path d="M0 320 L0 280 L1200 280 L1200 320 Z" opacity="0.8" />
          </g>
        )}
        {theme.id === "samurai" && (
          <g fill="var(--bg-0)">
            {/* mountain + torii on the horizon */}
            <path d="M0 320 L0 260 L180 260 Q320 130 460 260 L560 260 Q700 90 840 260 L1200 260 L1200 320 Z" />
            <path d="M940 260 L940 200 L930 200 L930 190 L1010 190 L1010 200 L1000 200 L1000 260 L985 260 L985 215 L955 215 L955 260 Z" opacity="0.9" />
            <path d="M925 190 L1015 190 L1020 180 L920 180 Z" opacity="0.9" />
          </g>
        )}
        {theme.id === "speed" && (
          <g fill="var(--bg-0)">
            {/* skyline of gentle towers */}
            <path d="M0 320 L0 250 L80 250 L80 210 L120 210 L120 250 L220 250 L220 180 L250 170 L280 180 L280 250 L400 250 L400 220 L450 220 L450 250 L560 250 L560 150 L590 140 L620 150 L620 250 L740 250 L740 210 L790 210 L790 250 L900 250 L900 190 L940 180 L980 190 L980 250 L1100 250 L1100 225 L1140 225 L1140 250 L1200 250 L1200 320 Z" />
          </g>
        )}
      </svg>

      {/* readability vignette behind the UI column */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 70% at 50% 45%, transparent 40%, rgba(0,0,0,0.28))",
        }}
      />
    </div>
  );
}
