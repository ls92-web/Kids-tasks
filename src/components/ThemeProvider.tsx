"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { THEMES, ThemeConfig, ThemeId, Profile } from "@/lib/game";

interface ThemeCtx {
  theme: ThemeConfig;
  setTheme: (t: ThemeId) => void;
  profile: Profile | null;
  setProfile: (p: Profile) => void;
}

const Ctx = createContext<ThemeCtx>({
  theme: THEMES.ninja,
  setTheme: () => {},
  profile: null,
  setProfile: () => {},
});

export function useWorld() {
  return useContext(Ctx);
}

export function ThemeProvider({
  initialProfile,
  children,
}: {
  initialProfile: Profile | null;
  children: React.ReactNode;
}) {
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
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
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
