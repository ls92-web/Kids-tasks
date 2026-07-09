"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ThemeProvider } from "@/components/ThemeProvider";
import { WorldBackground } from "@/components/WorldBackground";
import { AdminLoader, ADMIN_REFRESH } from "@/components/admin/ui";
import { Icon } from "@/components/Icon";
import { HelpPanel } from "@/components/HelpPanel";
import { PARENT_HELP, resetTours, PARENT_TOURS } from "@/lib/tour";
import { overlayFade, popSpring } from "@/lib/motion";
import { useEscape } from "@/lib/a11y";
import { motion, AnimatePresence } from "framer-motion";
import { Profile } from "@/lib/game";

const NAV = [
  { href: "/admin", icon: "home", label: "Overview", badge: "", tour: "" },
  { href: "/admin/review", icon: "eye", label: "Review", badge: "review", tour: "nav-review" },
  { href: "/admin/tasks", icon: "sword", label: "Quests", badge: "", tour: "nav-quests" },
  { href: "/admin/rewards", icon: "gift", label: "Rewards", badge: "wishes", tour: "nav-rewards" },
  { href: "/admin/children", icon: "heroes", label: "Heroes", badge: "", tour: "nav-heroes" },
  { href: "/admin/insights", icon: "insights", label: "Insights", badge: "", tour: "" },
  { href: "/admin/challenges", icon: "challenges", label: "Challenges", badge: "", tour: "" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [counts, setCounts] = useState<{ review: number; wishes: number }>({ review: 0, wishes: 0 });
  const [helpOpen, setHelpOpen] = useState(false);
  useEscape(helpOpen, () => setHelpOpen(false));

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

  // live "what needs me" badges — proofs + claimed rewards, and reward wishes
  const refreshCounts = useCallback(async () => {
    if (!profile) return;
    const supabase = createClient();
    const [reviews, redemptions, wishes] = await Promise.all([
      supabase.from("submissions").select("id", { count: "exact", head: true }).eq("status", "needs_review"),
      supabase.from("redemptions").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("reward_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);
    setCounts({
      review: (reviews.count ?? 0) + (redemptions.count ?? 0),
      wishes: wishes.count ?? 0,
    });
  }, [profile]);

  // recount on navigation and whenever a page resolves an item (ADMIN_REFRESH)
  useEffect(() => {
    refreshCounts();
    const onRefresh = () => refreshCounts();
    window.addEventListener(ADMIN_REFRESH, onRefresh);
    return () => window.removeEventListener(ADMIN_REFRESH, onRefresh);
  }, [refreshCounts, pathname]);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (!profile) {
    return (
      <div className="grid min-h-screen place-items-center">
        <AdminLoader label="Loading your dashboard…" />
      </div>
    );
  }

  return (
    <ThemeProvider initialProfile={profile}>
      <div className="relative min-h-screen">
        {/* parents get the calm gradient only — no game scenery */}
        <WorldBackground variant="plain" />
        <div className="relative z-10 mx-auto flex w-[min(97%,1200px)] flex-col gap-5 py-5 lg:flex-row">
          {/* sidebar */}
          <aside className="panel h-fit shrink-0 p-3 lg:sticky lg:top-5 lg:w-56">
            <div className="mb-3 px-2 pt-1">
              {/* official WonderNest navigation logo */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/logo-stacked.png"
                alt="WonderNest"
                className="mb-2 h-auto w-28"
              />
              <p className="text-display text-xs font-bold uppercase tracking-wide text-[var(--accent-2)]">
                Parent Dashboard
              </p>
              <p className="truncate text-xs text-[var(--text-dim)]">{profile.nickname}</p>
            </div>
            <nav className="flex gap-1 overflow-x-auto lg:flex-col">
              {NAV.map((item) => {
                const active =
                  item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
                const count = item.badge === "review" ? counts.review : item.badge === "wishes" ? counts.wishes : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-tour={item.tour || undefined}
                    aria-current={active ? "page" : undefined}
                    aria-label={count > 0 ? `${item.label} — ${count} waiting` : undefined}
                    className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                      active
                        ? "text-white"
                        : "text-[var(--text-dim)] hover:bg-black/25 hover:text-[var(--text)]"
                    }`}
                    style={
                      active
                        ? { background: "linear-gradient(160deg, var(--accent), var(--accent-deep))" }
                        : undefined
                    }
                  >
                    <Icon name={item.icon} size={20} art muted />
                    <span className="text-display flex-1">{item.label}</span>
                    {count > 0 && (
                      <span
                        aria-hidden
                        className={`text-display grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-black text-white ${
                          active ? "bg-white/25" : ""
                        }`}
                        style={
                          active
                            ? undefined
                            : { background: "linear-gradient(160deg, var(--accent), var(--accent-deep))" }
                        }
                      >
                        {count}
                      </span>
                    )}
                  </Link>
                );
              })}
              <button
                onClick={() => setHelpOpen(true)}
                className="mt-1 flex shrink-0 cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold text-[var(--text-dim)] transition-colors hover:bg-black/25 hover:text-[var(--text)]"
              >
                <Icon name="help" size={20} art muted />
                <span className="text-display">Help</span>
              </button>
              <button
                onClick={logout}
                className="flex shrink-0 cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold text-[var(--text-dim)] hover:text-[var(--danger)]"
              >
                <Icon name="exit" size={20} art muted />
                <span className="text-display">Sign out</span>
              </button>
            </nav>
          </aside>

          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>

      {/* Help — replay the tour or read any topic, from any admin screen */}
      <AnimatePresence>
        {helpOpen && (
          <motion.div
            {...overlayFade}
            role="dialog"
            aria-modal="true"
            aria-label="Help"
            onClick={() => setHelpOpen(false)}
            className="fixed inset-0 z-[70] grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={popSpring}
              onClick={(e) => e.stopPropagation()}
              className="panel panel-glow max-h-[85vh] w-full max-w-md overflow-y-auto p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-display text-lg font-black">Help &amp; guide</h2>
                <button
                  onClick={() => setHelpOpen(false)}
                  aria-label="Close"
                  className="grid h-8 w-8 place-items-center rounded-full bg-black/25 text-[var(--text-dim)] hover:text-[var(--text)]"
                >
                  <Icon name="x" size={15} />
                </button>
              </div>
              <HelpPanel
                topics={PARENT_HELP}
                replayLabel="Replay the dashboard tour"
                onReplay={() => {
                  if (profile) resetTours(profile.id, PARENT_TOURS);
                  setHelpOpen(false);
                  router.push("/admin");
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ThemeProvider>
  );
}
