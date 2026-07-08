"use client";

/* Fantasy-inspired stroke icon set. No emojis anywhere. */

const paths: Record<string, React.ReactNode> = {
  coin: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9 9.5c0-1.4 1.3-2.2 3-2.2s3 .8 3 2.2c0 3-6 2-6 5 0 1.4 1.3 2.2 3 2.2s3-.8 3-2.2" strokeWidth="1.6" />
    </>
  ),
  star: <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" />,
  flame: <path d="M12 2c1 4-4 5.5-4 10a4 4 0 008 0c0-2-1-3-1-3s3 1.5 3 5a7 7 0 01-14 0C4 8 10 7 12 2z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  map: (
    <>
      <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
      <path d="M9 4v14M15 6v14" />
    </>
  ),
  chest: (
    <>
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M3 12h18M12 8v8M5 8V6a3 3 0 013-3h8a3 3 0 013 3v2" />
      <circle cx="12" cy="13.5" r="1.4" fill="currentColor" />
    </>
  ),
  home: <path d="M3 11l9-8 9 8v9a1.5 1.5 0 01-1.5 1.5H15v-7H9v7H4.5A1.5 1.5 0 013 20z" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8l1.2 2.6 2.8-.6 1 2.7 2.8.7-.5 2.8 2 2-2 2 .5 2.8-2.8.7-1 2.7-2.8-.6L12 21.2l-1.2-2.6-2.8.6-1-2.7-2.8-.7.5-2.8-2-2 2-2-.5-2.8 2.8-.7 1-2.7 2.8.6z" />
    </>
  ),
  shield: <path d="M12 2.5l8 3v6c0 5.2-3.4 8.7-8 10-4.6-1.3-8-4.8-8-10v-6z" />,
  scroll: (
    <>
      <path d="M6 4h12a2 2 0 012 2v1H8v12a2 2 0 11-4 0V6a2 2 0 012-2z" />
      <path d="M8 7h12v11a3 3 0 01-3 3H6" />
      <path d="M11 11h6M11 15h6" />
    </>
  ),
  check: <path d="M4.5 12.5l5 5 10-11" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  upload: (
    <>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </>
  ),
  gift: (
    <>
      <rect x="4" y="10" width="16" height="10" rx="1.5" />
      <path d="M12 10v10M4 14h16M12 10s-4 0-5.5-1.5a2.1 2.1 0 013-3C11 7 12 10 12 10zm0 0s4 0 5.5-1.5a2.1 2.1 0 00-3-3C13 7 12 10 12 10z" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v6a4 4 0 01-8 0z" />
      <path d="M8 5H4v2a4 4 0 004 4M16 5h4v2a4 4 0 01-4 4M12 14v4M8 21h8M10 18h4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" />
      <path d="M16 5.5a3.5 3.5 0 010 6.5M18 14.8c1.8.8 3 2.3 3.5 4.2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  sword: (
    <>
      <path d="M14.5 3.5L20 4l.5 5.5L8 22l-6-6z" transform="rotate(0)" />
      <path d="M4 15l5 5M14.5 3.5L20.5 9.5" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 018 0v3" />
    </>
  ),
  lightning: <path d="M13 2L4 14h6l-1 8 9-12h-6z" />,
  eye: (
    <>
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  refresh: <path d="M20 12a8 8 0 11-2.3-5.6M20 3v4h-4" />,
  book: (
    <>
      <path d="M4 5a2 2 0 012-2h13a1 1 0 011 1v16a1 1 0 01-1 1H6a2 2 0 01-2-2z" />
      <path d="M4 17.5A2.5 2.5 0 016.5 15H20M8 7h8" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </>
  ),
};

/* app icon name → delivered rendered-art slug (public/icons/<slug>.png).
   Opt in per call site with <Icon art …/>; unmapped names fall back to SVG. */
const ICON_ART: Record<string, string> = {
  coin: "coin", star: "star", flame: "fire", clock: "time", map: "treasure-map",
  chest: "chest", gift: "chest", home: "home", scroll: "scroll", camera: "camera",
  book: "book", sword: "sword", trophy: "trophy", lightning: "energy", sparkle: "magic",
  users: "family", lock: "lock", heart: "heart", shield: "hero-shield", gear: "settings",
};

export function Icon({
  name,
  size = 20,
  className = "",
  filled = false,
  art = false,
}: {
  name: keyof typeof paths | string;
  size?: number;
  className?: string;
  filled?: boolean;
  /** render the delivered rendered-art icon instead of the flat SVG */
  art?: boolean;
}) {
  if (art && ICON_ART[name]) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/icons/${ICON_ART[name]}.png`}
        alt=""
        width={size}
        height={size}
        className={`inline-block object-contain ${className}`}
      />
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {paths[name] ?? <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}
