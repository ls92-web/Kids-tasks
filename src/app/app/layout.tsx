"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ThemeProvider } from "@/components/ThemeProvider";
import { WorldBackground } from "@/components/WorldBackground";
import { HUD } from "@/components/HUD";
import { ChildNav } from "@/components/ChildNav";
import { MagicLoader } from "@/components/MagicLoader";
import { Profile, CompanionBond } from "@/lib/game";

export default function ChildLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [companion, setCompanion] = useState<CompanionBond | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace("/login");
        return;
      }
      const [{ data: p }, { data: bond }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", data.user.id).single(),
        supabase
          .from("companions")
          .select("*")
          .eq("child_id", data.user.id)
          .eq("status", "active")
          .maybeSingle(),
      ]);
      if (!p) {
        router.replace("/login");
        return;
      }
      if (p.role === "parent") {
        router.replace("/admin");
        return;
      }
      setProfile(p as Profile);
      setCompanion((bond as CompanionBond) ?? null);
      setReady(true);
    });
  }, [router]);

  if (!ready || !profile) {
    return <MagicLoader full label="Entering your world..." />;
  }

  return (
    <ThemeProvider initialProfile={profile} initialCompanion={companion}>
      <div className="relative min-h-screen">
        <WorldBackground />
        <div className="relative z-10 pb-28">
          <HUD />
          <main className="mx-auto mt-5 w-[min(96%,900px)]">{children}</main>
        </div>
        <ChildNav />
      </div>
    </ThemeProvider>
  );
}
