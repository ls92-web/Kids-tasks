"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
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
  const [themeId, setThemeId] = useState<ThemeId>(initialProfile?.theme ?? "ninja");

  useEffect(() => {
    document.documentElement.dataset.theme = themeId;
  }, [themeId]);

  useEffect(() => {
    document.documentElement.dataset.anim = profile?.animation_intensity ?? "full";
  }, [profile?.animation_intensity]);

  return (
    <Ctx.Provider
      value={{
        theme: THEMES[themeId],
        setTheme: setThemeId,
        profile,
        setProfile: (p) => {
          setProfile(p);
          setThemeId(p.theme);
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
