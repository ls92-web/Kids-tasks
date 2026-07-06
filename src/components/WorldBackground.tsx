"use client";

import { useWorld } from "./ThemeProvider";

/* Layered, slowly-moving scenery per theme. Pure SVG + CSS — no assets. */
export function WorldBackground() {
  const { theme } = useWorld();
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {/* sky gradient */}
      <div
        className="absolute inset-0 transition-colors duration-700"
        style={{
          background:
            "radial-gradient(120% 90% at 50% -10%, var(--bg-2) 0%, var(--bg-1) 45%, var(--bg-0) 100%)",
        }}
      />
      {theme.id === "ninja" && <NinjaScene />}
      {theme.id === "samurai" && <SamuraiScene />}
      {theme.id === "speed" && <SpeedScene />}
      {/* vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 70% at 50% 45%, transparent 55%, rgba(0,0,0,0.45) 100%)",
        }}
      />
    </div>
  );
}

function NinjaScene() {
  return (
    <>
      {/* moon */}
      <div
        className="fx-light absolute right-[10%] top-[8%] h-40 w-40 rounded-full animate-pulse-glow"
        style={{
          background: "radial-gradient(circle, #f4f8ff 0%, #cfe0ff 55%, transparent 72%)",
          boxShadow: "0 0 90px 30px rgba(180,205,255,0.35)",
        }}
      />
      {/* drifting mist */}
      <div
        className="fx-heavy absolute inset-x-0 bottom-[18%] h-48 opacity-40"
        style={{
          background:
            "radial-gradient(60% 100% at 30% 50%, rgba(150,180,255,0.25), transparent 70%), radial-gradient(50% 100% at 75% 60%, rgba(150,180,255,0.18), transparent 70%)",
          animation: "drift-x 26s ease-in-out infinite alternate",
        }}
      />
      {/* rooftops silhouette */}
      <svg
        className="absolute bottom-0 left-0 w-full"
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
        style={{ height: "38vh" }}
      >
        <path
          d="M0 320 L0 210 L60 210 L90 150 L120 165 L150 150 L180 210 L260 210 L260 170 Q300 120 340 170 L340 210 L420 210 L470 120 Q520 60 570 120 L620 210 L700 210 L700 180 L760 130 L820 180 L820 210 L900 210 L950 140 L1000 165 L1050 140 L1100 210 L1200 210 L1230 160 Q1270 110 1310 160 L1340 210 L1440 210 L1440 320 Z"
          fill="#050915"
        />
        <path
          d="M0 320 L0 260 L1440 250 L1440 320 Z"
          fill="#03060f"
        />
      </svg>
      {/* lanterns */}
      {[
        { left: "16%", top: "58%", d: "0s" },
        { left: "44%", top: "50%", d: "1.4s" },
        { left: "72%", top: "60%", d: "0.7s" },
        { left: "88%", top: "52%", d: "2s" },
      ].map((l, i) => (
        <div
          key={i}
          className="fx-light absolute animate-floaty"
          style={{ left: l.left, top: l.top, animationDelay: l.d }}
        >
          <div
            className="h-7 w-5 rounded-[45%]"
            style={{
              background: "radial-gradient(circle at 50% 40%, #ffd9a0, #e8833a 70%)",
              boxShadow: "0 0 22px 6px rgba(255,170,80,0.5)",
            }}
          />
        </div>
      ))}
    </>
  );
}

function SamuraiScene() {
  return (
    <>
      {/* warm sun */}
      <div
        className="fx-light absolute left-[12%] top-[10%] h-44 w-44 rounded-full animate-pulse-glow"
        style={{
          background: "radial-gradient(circle, #ffe9c4 0%, #ffc46b 55%, transparent 75%)",
          boxShadow: "0 0 100px 40px rgba(255,180,90,0.3)",
        }}
      />
      {/* mountains */}
      <svg
        className="absolute bottom-0 left-0 w-full"
        viewBox="0 0 1440 360"
        preserveAspectRatio="none"
        style={{ height: "44vh" }}
      >
        <path
          d="M0 360 L0 220 Q180 90 360 220 Q470 140 600 230 L1440 230 L1440 360 Z"
          fill="#241107"
          opacity="0.9"
        />
        <path
          d="M400 360 L400 250 Q640 80 880 250 Q1040 150 1200 260 L1440 250 L1440 360 L0 360 Z"
          fill="#170a04"
        />
      </svg>
      {/* torii gate */}
      <svg
        className="fx-light absolute bottom-[8vh] right-[12%]"
        width="150"
        height="140"
        viewBox="0 0 150 140"
      >
        <g fill="#7a2410">
          <rect x="18" y="30" width="12" height="110" rx="3" />
          <rect x="120" y="30" width="12" height="110" rx="3" />
          <rect x="8" y="36" width="134" height="10" rx="4" />
          <path d="M0 18 Q75 2 150 18 L150 30 Q75 16 0 30 Z" />
        </g>
      </svg>
      {/* hanging banners */}
      {["22%", "52%"].map((left, i) => (
        <div
          key={i}
          className="fx-heavy absolute top-0"
          style={{ left, animation: "drift-x 18s ease-in-out infinite alternate", animationDelay: `${i * 2}s` }}
        >
          <div
            className="h-40 w-10 rounded-b-lg opacity-70"
            style={{
              background: "linear-gradient(180deg, rgba(240,161,50,0.85), rgba(240,161,50,0.25))",
              boxShadow: "0 0 24px rgba(240,161,50,0.25)",
            }}
          />
        </div>
      ))}
    </>
  );
}

function SpeedScene() {
  return (
    <>
      {/* energy rings */}
      {[
        { size: 340, left: "8%", top: "16%", dur: "14s" },
        { size: 220, left: "70%", top: "10%", dur: "10s" },
        { size: 160, left: "48%", top: "34%", dur: "8s" },
      ].map((r, i) => (
        <div
          key={i}
          className="fx-light absolute rounded-full"
          style={{
            width: r.size,
            height: r.size,
            left: r.left,
            top: r.top,
            border: "3px solid rgba(35,213,255,0.35)",
            boxShadow:
              "0 0 40px rgba(35,213,255,0.25), inset 0 0 40px rgba(35,213,255,0.15)",
            animation: `spin-slow ${r.dur} linear infinite`,
            borderTopColor: "rgba(255,224,102,0.8)",
          }}
        />
      ))}
      {/* looping track */}
      <svg
        className="absolute bottom-0 left-0 w-full"
        viewBox="0 0 1440 300"
        preserveAspectRatio="none"
        style={{ height: "36vh" }}
      >
        <defs>
          <linearGradient id="track" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0a2a5e" />
            <stop offset="50%" stopColor="#0e3d7e" />
            <stop offset="100%" stopColor="#0a2a5e" />
          </linearGradient>
        </defs>
        <path
          d="M0 300 L0 200 Q360 120 720 190 Q1080 260 1440 160 L1440 300 Z"
          fill="url(#track)"
        />
        <path
          d="M0 214 Q360 134 720 204 Q1080 274 1440 174"
          fill="none"
          stroke="rgba(35,213,255,0.8)"
          strokeWidth="4"
          strokeDasharray="30 22"
          style={{ filter: "drop-shadow(0 0 8px rgba(35,213,255,0.8))" }}
        />
      </svg>
      {/* floating crystals */}
      {[
        { left: "20%", top: "44%", d: "0s" },
        { left: "58%", top: "52%", d: "1.2s" },
        { left: "84%", top: "40%", d: "0.5s" },
      ].map((c, i) => (
        <svg
          key={i}
          className="fx-light absolute animate-floaty"
          style={{ left: c.left, top: c.top, animationDelay: c.d }}
          width="34"
          height="48"
          viewBox="0 0 34 48"
        >
          <path
            d="M17 0 L34 16 L17 48 L0 16 Z"
            fill="rgba(125,243,255,0.85)"
            style={{ filter: "drop-shadow(0 0 12px rgba(35,213,255,0.9))" }}
          />
        </svg>
      ))}
    </>
  );
}
