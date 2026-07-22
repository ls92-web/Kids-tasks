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
import { syncSeenTours } from "@/lib/tour";

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
      // heroes awaiting (or refused) approval can't enter the world yet
      if (p.status && p.status !== "active") {
        await supabase.auth.signOut();
        router.replace("/login");
        return;
      }
      // seed the seen-tours cache BEFORE any screen can decide to show one
      syncSeenTours(p as Profile);
      setProfile(p as Profile);
      setCompanion((bond as CompanionBond) ?? null);
      setReady(true);
    });
  }, [router]);

  if (!ready || !profile) {
    return <MagicLoader full label="Entering your world…" />;
  }

  return (
    <ThemeProvider initialProfile={profile} initialCompanion={companion}>
      <div
        className="relative min-h-screen"
        // no right-click "Save Image As…" on the artwork inside the child's
        // world (long-press saving is already off via CSS touch-callout)
        onContextMenu={(e) => {
          const t = e.target as HTMLElement;
          if (t.closest("img, svg, picture, video")) e.preventDefault();
        }}
      >
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
