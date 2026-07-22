"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MotionConfig } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { THEMES, ThemeConfig, ThemeId, Profile, CompanionBond } from "@/lib/game";

interface ThemeCtx {
  theme: ThemeConfig;
  setTheme: (t: ThemeId) => void;
  profile: Profile | null;
  setProfile: (p: Profile) => void;
  /** The child's active companion bond (null for parents / pre-login). */
  companion: CompanionBond | null;
  setCompanion: (c: CompanionBond | null) => void;
}

const Ctx = createContext<ThemeCtx>({
  theme: THEMES.ninja,
  setTheme: () => {},
  profile: null,
  setProfile: () => {},
  companion: null,
  setCompanion: () => {},
});

export function useWorld() {
  return useContext(Ctx);
}

/** Coerce any stored theme value to a known ThemeId — a child whose
    profile.theme is missing or unrecognised (e.g. a finale world) must never
    crash the app; it just falls back to the default world. */
const asThemeId = (t: string | null | undefined): ThemeId =>
  t && THEMES[t as ThemeId] ? (t as ThemeId) : "ninja";

export function ThemeProvider({
  initialProfile,
  initialCompanion = null,
  children,
}: {
  initialProfile: Profile | null;
  initialCompanion?: CompanionBond | null;
  children: React.ReactNode;
}) {
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [companion, setCompanion] = useState<CompanionBond | null>(initialCompanion);
  const [themeId, setThemeId] = useState<ThemeId>(asThemeId(initialProfile?.theme));

  // Keep the world's truth fresh. The context used to be a one-shot snapshot
  // from login, so XP/coins/level awarded WHILE the app was open (a parent
  // approving a quest) never reached the HUD or the hero card until a full
  // reload — screens doing their own fetches then disagreed with the header.
  // Now the profile (+ active bond) re-syncs from the database on every tab
  // change, whenever the app comes back to the foreground, and once a minute
  // while it stays open. Reads are two single-row queries.
  const pathname = usePathname();
  const syncMeta = useRef({ id: initialProfile?.id, role: initialProfile?.role, last: 0 });
  syncMeta.current.id = profile?.id;
  syncMeta.current.role = profile?.role;

  useEffect(() => {
    let gone = false;

    async function sync(minGapMs: number) {
      const meta = syncMeta.current;
      if (!meta.id || Date.now() - meta.last < minGapMs) return;
      meta.last = Date.now();
      try {
        const supabase = createClient();
        const [{ data: p }, bondRes] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", meta.id).single(),
          meta.role === "child"
            ? supabase
                .from("companions")
                .select("*")
                .eq("child_id", meta.id)
                .eq("status", "active")
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        if (gone || !p) return;
        setProfile((prev) => (JSON.stringify(prev) === JSON.stringify(p) ? prev : (p as Profile)));
        setThemeId(asThemeId((p as Profile).theme));
        if (meta.role === "child") {
          const b = (bondRes.data as CompanionBond | null) ?? null;
          setCompanion((prev) => (JSON.stringify(prev) === JSON.stringify(b) ? prev : b));
        }
      } catch {
        // offline or flaky network — the next wake-up tries again
      }
    }

    sync(8_000); // tab/route change (throttled)
    const onWake = () => {
      if (document.visibilityState === "visible") sync(2_000);
    };
    window.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    const tick = setInterval(() => {
      if (document.visibilityState === "visible") sync(45_000);
    }, 60_000);
    return () => {
      gone = true;
      window.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      clearInterval(tick);
    };
  }, [pathname]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeId;
  }, [themeId]);

  useEffect(() => {
    document.documentElement.dataset.anim = profile?.animation_intensity ?? "full";
  }, [profile?.animation_intensity]);

  return (
    <Ctx.Provider
      value={{
        theme: THEMES[themeId] ?? THEMES.ninja,
        setTheme: (t) => setThemeId(asThemeId(t)),
        profile,
        setProfile: (p) => {
          setProfile(p);
          setThemeId(asThemeId(p.theme));
        },
        companion,
        setCompanion,
      }}
    >
      {/* respect the OS reduced-motion preference in every Framer animation */}
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </Ctx.Provider>
  );
}
