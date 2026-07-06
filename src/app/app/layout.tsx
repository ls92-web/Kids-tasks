"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ThemeProvider } from "@/components/ThemeProvider";
import { WorldBackground } from "@/components/WorldBackground";
import { ParticleField } from "@/components/ParticleField";
import { HUD } from "@/components/HUD";
import { ChildNav } from "@/components/ChildNav";
import { MagicLoader } from "@/components/MagicLoader";
import { Profile } from "@/lib/game";

export default function ChildLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace("/login");
        return;
      }
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();
      if (!p) {
        router.replace("/login");
        return;
      }
      if (p.role === "parent") {
        router.replace("/admin");
        return;
      }
      setProfile(p as Profile);
      setReady(true);
    });
  }, [router]);

  if (!ready || !profile) {
    return <MagicLoader full label="Entering your world..." />;
  }

  return (
    <ThemeProvider initialProfile={profile}>
      <div className="relative min-h-screen">
        <WorldBackground />
        <ParticleField />
        <div className="relative z-10 pb-28">
          <HUD />
          <main className="mx-auto mt-5 w-[min(96%,900px)]">{children}</main>
        </div>
        <ChildNav />
      </div>
    </ThemeProvider>
  );
}
