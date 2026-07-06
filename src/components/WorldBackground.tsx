"use client";

import { useWorld } from "./ThemeProvider";

/* One elegant, calm background per world — a large soft gradient plus light
   environmental silhouettes. Completely static: no moons, no particles, no
   drifting lanterns. The world sets the mood; the UI carries the story.

     ninja   — deep indigo/purple, quiet rooftops + bamboo
     samurai — warm gold sunrise, mountain + torii
     speed   — blue/cyan skyline with a soft neon road fading into depth

   `variant="plain"` (parent dashboard) keeps only the gradient + vignette —
   calm and professional, no scenery. */

export function WorldBackground({ variant = "world" }: { variant?: "world" | "plain" }) {
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

      {variant === "world" && (
        <>
          {/* a whisper of the world's signature colour in the sky */}
          <div
            className="absolute inset-x-0 top-0 h-[45vh]"
            style={{
              background:
                theme.id === "ninja"
                  ? "linear-gradient(180deg, rgba(124,92,220,0.14), transparent)"
                  : theme.id === "samurai"
                    ? "linear-gradient(180deg, rgba(244,183,64,0.12), transparent)"
                    : "linear-gradient(180deg, rgba(34,211,238,0.10), transparent)",
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
                {/* bamboo stand on the right */}
                <g opacity="0.9">
                  <rect x="1096" y="120" width="9" height="200" rx="4" />
                  <rect x="1118" y="90" width="10" height="230" rx="5" />
                  <rect x="1142" y="130" width="8" height="190" rx="4" />
                  <rect x="1163" y="105" width="9" height="215" rx="4" />
                  <path d="M1100 130 q-24 -10 -38 -28 q22 4 38 16 Z" />
                  <path d="M1123 98 q-26 -12 -40 -30 q24 4 40 18 Z" />
                  <path d="M1128 122 q26 -8 40 -24 q-22 2 -40 12 Z" />
                  <path d="M1167 112 q24 -10 36 -26 q-20 2 -36 14 Z" />
                </g>
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
              <g>
                {/* skyline of gentle towers */}
                <path
                  fill="var(--bg-0)"
                  d="M0 320 L0 250 L80 250 L80 210 L120 210 L120 250 L220 250 L220 180 L250 170 L280 180 L280 250 L400 250 L400 220 L450 220 L450 250 L560 250 L560 150 L590 140 L620 150 L620 250 L740 250 L740 210 L790 210 L790 250 L900 250 L900 190 L940 180 L980 190 L980 250 L1100 250 L1100 225 L1140 225 L1140 250 L1200 250 L1200 320 Z"
                />
                {/* soft neon road receding toward the skyline — static depth */}
                <path d="M530 320 L600 252 L604 252 L560 320 Z" fill="#22d3ee" opacity="0.18" />
                <path d="M670 320 L604 252 L608 252 L700 320 Z" fill="#22d3ee" opacity="0.18" />
                <path d="M598 320 L602 262 L606 262 L614 320 Z" fill="#22d3ee" opacity="0.10" />
                <rect x="0" y="250" width="1200" height="2.5" fill="#22d3ee" opacity="0.14" />
              </g>
            )}
          </svg>
        </>
      )}

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
