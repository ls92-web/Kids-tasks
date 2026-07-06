"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { ThemeProvider } from "@/components/ThemeProvider";
import { WorldBackground } from "@/components/WorldBackground";
import { MagicLoader } from "@/components/MagicLoader";
import { Icon } from "@/components/Icon";
import { Profile } from "@/lib/game";

const NAV = [
  { href: "/admin", icon: "home", label: "Overview" },
  { href: "/admin/insights", icon: "sparkle", label: "Insights" },
  { href: "/admin/children", icon: "users", label: "Heroes" },
  { href: "/admin/tasks", icon: "sword", label: "Quests" },
  { href: "/admin/rewards", icon: "gift", label: "Rewards" },
  { href: "/admin/review", icon: "eye", label: "Review" },
  { href: "/admin/challenges", icon: "lightning", label: "Challenges" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return router.replace("/login");
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();
      if (!p) return router.replace("/login");
      if (p.role !== "parent") return router.replace("/app");
      setProfile(p as Profile);
    });
  }, [router]);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!profile) {
    return <MagicLoader full label="Loading your guild..." />;
  }

  return (
    <ThemeProvider initialProfile={profile}>
      <div className="relative min-h-screen">
        <WorldBackground />
        <div className="relative z-10 mx-auto flex w-[min(97%,1200px)] flex-col gap-5 py-5 lg:flex-row">
          {/* sidebar */}
          <aside className="panel h-fit shrink-0 p-3 lg:sticky lg:top-5 lg:w-56">
            <div className="mb-3 px-2 pt-1">
              <p className="text-display text-glow text-lg font-black text-[var(--accent-2)]">
                Guild Master
              </p>
              <p className="truncate text-xs text-[var(--text-dim)]">{profile.nickname}</p>
            </div>
            <nav className="flex gap-1 overflow-x-auto lg:flex-col">
              {NAV.map((item) => {
                const active =
                  item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href} className="relative shrink-0">
                    <motion.div
                      whileHover={{ x: 3 }}
                      className={`relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold ${
                        active ? "text-white" : "text-[var(--text-dim)] hover:text-[var(--text)]"
                      }`}
                    >
                      {active && (
                        <motion.div
                          layoutId="admin-nav"
                          className="absolute inset-0 rounded-xl"
                          style={{
                            background: "linear-gradient(160deg, var(--accent), var(--accent-deep))",
                            boxShadow: "0 0 18px -6px var(--glow)",
                          }}
                          transition={{ type: "spring", stiffness: 400, damping: 32 }}
                        />
                      )}
                      <Icon name={item.icon} size={17} className="relative" />
                      <span className="text-display relative">{item.label}</span>
                    </motion.div>
                  </Link>
                );
              })}
              <button
                onClick={logout}
                className="mt-1 flex shrink-0 cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold text-[var(--text-dim)] hover:text-[var(--danger)]"
              >
                <Icon name="logout" size={17} />
                <span className="text-display">Sign out</span>
              </button>
            </nav>
          </aside>

          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </ThemeProvider>
  );
}
