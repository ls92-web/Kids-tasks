"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useWorld } from "@/components/ThemeProvider";
import { Portrait } from "@/components/Portrait";
import { XPBar } from "@/components/XPBar";
import { Icon } from "@/components/Icon";
import { EmptyNote } from "@/components/admin/ui";
import { Tour, useOnboardingTour } from "@/components/Tour";
import { TourStep } from "@/lib/tour";
import { Profile, levelFromXp, rankName } from "@/lib/game";

const PARENT_STEPS: TourStep[] = [
  {
    text: "Welcome to WonderNest. This is where your child's real-life adventures begin — you create quests, they complete them.",
  },
  {
    anchor: "attention",
    title: "What needs you",
    text: "At a glance: proofs to review, reward wishes, and rewards to grant.",
  },
  {
    anchor: "children",
    title: "Your heroes",
    text: "Each child's progress lives here. Invite more with your Family Code on the Heroes page.",
  },
  {
    anchor: "nav-quests",
    title: "Create a quest",
    text: "Assign your child's first real-life quest here — difficulty fills in fair coins, XP and time.",
  },
  {
    anchor: "nav-review",
    title: "Approvals",
    text: "When a hero submits a photo proof, you approve it here. Nothing is awarded until you do.",
  },
  { text: "Your family adventure is ready to begin." },
];

export default function AdminOverview() {
  const { profile } = useWorld();
  const parentTour = useOnboardingTour("parent", profile?.id);
  const [children, setChildren] = useState<Profile[]>([]);
  const [pendingReviews, setPendingReviews] = useState(0);
  const [pendingWishes, setPendingWishes] = useState(0);
  const [pendingRedemptions, setPendingRedemptions] = useState(0);

  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    (async () => {
      const [kids, reviews, wishes, redemptions] = await Promise.all([
        supabase.from("profiles").select("*").eq("family_id", profile.family_id).eq("role", "child"),
        supabase
          .from("submissions")
          .select("id", { count: "exact", head: true })
          .eq("status", "needs_review"),
        supabase
          .from("reward_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("redemptions")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
      ]);
      setChildren((kids.data as Profile[]) ?? []);
      setPendingReviews(reviews.count ?? 0);
      setPendingWishes(wishes.count ?? 0);
      setPendingRedemptions(redemptions.count ?? 0);
    })();
  }, [profile]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-display text-2xl font-black">Family Overview</h1>

      {/* attention needed */}
      <div data-tour="attention" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AttentionCard
          href="/admin/review"
          icon="camera"
          count={pendingReviews}
          label="Proofs to review"
        />
        <AttentionCard
          href="/admin/rewards"
          icon="sparkle"
          count={pendingWishes}
          label="Reward wishes"
        />
        <AttentionCard
          href="/admin/review"
          icon="gift"
          count={pendingRedemptions}
          label="Rewards to grant"
        />
      </div>

      {/* children */}
      {children.length === 0 ? (
        <EmptyNote>
          No heroes yet.{" "}
          <Link href="/admin/children" className="font-bold text-[var(--accent-2)] underline">
            Create your first hero
          </Link>{" "}
          to get started.
        </EmptyNote>
      ) : (
        <div data-tour="children" className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {children.map((c) => {
            const { level } = levelFromXp(c.xp);
            return (
              <div key={c.id} className="panel p-4">
                <div className="flex items-center gap-3">
                  <Portrait species={c.pet} size={52} />
                  <div className="min-w-0 flex-1">
                    <p className="text-display truncate font-bold">{c.nickname}</p>
                    <p className="text-xs font-semibold text-[var(--accent-2)]">
                      LV {level} — {rankName(c.theme, level)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-display text-lg font-black text-[var(--gold)]">{c.coins}</p>
                    <p className="text-[10px] font-bold uppercase text-[var(--text-dim)]">coins</p>
                  </div>
                </div>
                <div className="mt-3">
                  <XPBar xp={c.xp} compact />
                </div>
                <div className="mt-3 flex gap-4 text-xs font-semibold text-[var(--text-dim)]">
                  <span className="flex items-center gap-1">
                    <Icon name="check" size={13} /> {c.tasks_completed} done
                  </span>
                  <span className="flex items-center gap-1">
                    <Icon art muted name="flame" size={13} /> {c.streak_days}-day streak
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Tour steps={PARENT_STEPS} active={parentTour.active} onDone={parentTour.onDone} tone="parent" />
    </div>
  );
}

function AttentionCard({
  href,
  icon,
  count,
  label,
}: {
  href: string;
  icon: string;
  count: number;
  label: string;
}) {
  return (
    <Link href={href}>
      <div
        className={`panel flex items-center gap-3 p-4 transition-colors hover:bg-black/25 ${
          count > 0 ? "ring-1 ring-[var(--accent-2)]/40" : ""
        }`}
      >
        <div
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
          style={{ background: count > 0 ? "var(--glow-soft)" : "rgba(0,0,0,0.25)" }}
        >
          <Icon
            name={icon}
            size={26}
            art
            muted
            className={count > 0 ? "" : "opacity-45"}
          />
        </div>
        <div>
          <p className="text-display text-2xl font-black">{count}</p>
          <p className="text-xs font-bold text-[var(--text-dim)]">{label}</p>
        </div>
      </div>
    </Link>
  );
}
