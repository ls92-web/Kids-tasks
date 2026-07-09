"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useWorld } from "@/components/ThemeProvider";
import { RewardCard } from "@/components/RewardCard";
import { GameButton } from "@/components/GameButton";
import { Callout } from "@/components/Callout";
import { Icon } from "@/components/Icon";
import { sfx } from "@/lib/sound";
import { overlayFade, popSpring } from "@/lib/motion";
import { useEscape } from "@/lib/a11y";
import { CompanionCoach, useCoachBeat } from "@/components/CompanionCoach";
import { CoachStep } from "@/lib/tour";
import { Reward, Profile } from "@/lib/game";

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "treats", label: "Treats" },
  { id: "fun", label: "Fun" },
  { id: "toys", label: "Toys" },
  { id: "pets", label: "Pets" },
  { id: "adventures", label: "Adventures" },
];

const CATEGORY_OF: Record<string, string> = {
  icecream: "treats",
  dinner: "treats",
  movie: "fun",
  screen: "fun",
  electronics: "fun",
  animation: "fun",
  book: "fun",
  toy: "toys",
  ball: "toys",
  clothing: "toys",
  weapon: "toys",
  decor: "toys",
  pet: "pets",
  petacc: "pets",
  trip: "adventures",
  experience: "adventures",
  outdoor: "adventures",
  parent: "adventures",
  gift: "adventures",
  mystery: "adventures",
};

export default function ShopPage() {
  const { theme, profile, setProfile } = useWorld();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [category, setCategory] = useState("all");
  const [bought, setBought] = useState<Reward | null>(null);
  const [chestOpen, setChestOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [reqName, setReqName] = useState("");
  const [reqWhy, setReqWhy] = useState("");
  const [reqSent, setReqSent] = useState(false);
  const [error, setError] = useState("");

  // Escape closes whichever overlay is up (the chest only once it's open)
  useEscape(!!bought && chestOpen, () => setBought(null));
  useEscape(requestOpen, () => setRequestOpen(false));

  // first visit to the vault — the companion, delighted, not a tooltip
  const shopBeat = useCoachBeat("coach_shop", profile?.id, !bought && !requestOpen);
  const shopSteps: CoachStep[] = [
    { anchor: "shop-intro", text: "Wow — look at all these treasures!" },
    { anchor: "shop-intro", text: "Our coins can make one of these real." },
  ];

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("rewards")
      .select("*")
      .eq("available", true)
      .order("coin_cost")
      .then(({ data }) => setRewards((data as Reward[]) ?? []));
  }, []);

  const visible = useMemo(
    () =>
      category === "all"
        ? rewards
        : rewards.filter((r) => (CATEGORY_OF[r.icon] ?? "special") === category),
    [rewards, category]
  );

  async function buy(r: Reward) {
    if (!profile) return;
    setError("");
    const supabase = createClient();
    const { data, error: err } = await supabase.rpc("purchase_reward", { p_reward_id: r.id });
    if (err) {
      sfx.sad();
      setError(err.message.includes("not enough") ? "Not enough coins yet — more quests!" : err.message);
      return;
    }
    setProfile({ ...profile, coins: data.coins_left } as Profile);
    setRewards((rs) =>
      rs.map((x) => (x.id === r.id && x.quantity !== null ? { ...x, quantity: x.quantity - 1 } : x))
    );
    // chest ceremony
    setBought(r);
    setChestOpen(false);
    sfx.chest();
    setTimeout(() => {
      setChestOpen(true);
      sfx.coin();
    }, 950);
  }

  async function sendRequest() {
    if (!profile || reqName.trim().length < 2) return;
    const supabase = createClient();
    await supabase.from("reward_requests").insert({
      family_id: profile.family_id,
      child_id: profile.id,
      name: reqName.trim(),
      description: reqWhy.trim(),
    });
    sfx.complete();
    setReqSent(true);
    setReqName("");
    setReqWhy("");
    setTimeout(() => {
      setReqSent(false);
      setRequestOpen(false);
    }, 2200);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div data-tour="shop-intro">
          <h1 className="text-display text-3xl font-black">Treasure Vault</h1>
          <p className="mt-1 text-sm text-[var(--text-dim)]">
            Spend your {theme.coinName.toLowerCase()} on real rewards
          </p>
        </div>
        <GameButton
          variant="ghost"
          onClick={() => {
            sfx.click();
            setRequestOpen(true);
          }}
          className="text-sm"
        >
          <Icon art name="wish" size={15} className="mr-1 inline" /> Wish for something
        </GameButton>
      </div>

      {/* category shelf */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            aria-pressed={category === c.id}
            onClick={() => {
              sfx.click();
              setCategory(c.id);
            }}
            className={`text-display shrink-0 cursor-pointer rounded-xl px-4 py-2 text-sm font-bold transition-all ${
              category === c.id ? "text-white" : "bg-black/25 text-[var(--text-dim)] hover:bg-black/40"
            }`}
            style={
              category === c.id
                ? {
                    background: "linear-gradient(160deg, var(--accent), var(--accent-deep))",
                    boxShadow: "0 0 16px -4px var(--glow)",
                  }
                : {}
            }
          >
            {c.label}
          </button>
        ))}
      </div>

      {error && <Callout tone="error">{error}</Callout>}

      {visible.length === 0 ? (
        <div className="panel overflow-hidden text-center">
          {/* Welcome Hero — fills the card width, shown whole, text below */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/login-hero.png"
            alt=""
            className="block w-full"
          />
          <p className="text-display px-6 py-6 font-bold text-[var(--text-dim)]">
            {rewards.length === 0
              ? "The vault is being stocked. Check back soon!"
              : "Nothing on this shelf yet — try another one."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((r, i) => (
            <RewardCard key={r.id} reward={r} coins={profile?.coins ?? 0} onBuy={buy} index={i} />
          ))}
        </div>
      )}

      {/* chest-opening purchase ceremony */}
      <AnimatePresence>
        {bought && (
          <motion.div
            {...overlayFade}
            role="dialog"
            aria-modal="true"
            aria-label="Look what we found"
            className="fixed inset-0 z-50 grid place-items-center bg-black/75 backdrop-blur-sm"
            onClick={() => chestOpen && setBought(null)}
          >
            {/* burst */}
            {chestOpen && (
              <motion.div
                initial={{ scale: 0, opacity: 0.9 }}
                animate={{ scale: 7, opacity: 0 }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className="absolute h-32 w-32 rounded-full"
                style={{ border: "3px solid var(--gold)", boxShadow: "0 0 50px rgba(255,215,106,0.8)" }}
              />
            )}
            {chestOpen &&
              Array.from({ length: 14 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ x: 0, y: 40, opacity: 0 }}
                  animate={{
                    x: (Math.random() - 0.5) * 360,
                    y: [40, -(80 + Math.random() * 220), 400],
                    opacity: [0, 1, 0],
                    rotate: Math.random() * 540,
                  }}
                  transition={{ duration: 1.5, delay: i * 0.04, ease: "easeOut" }}
                  className="absolute"
                  style={{
                    width: 18,
                    height: 18,
                    backgroundImage: "url(/ui/icons/coin.png)",
                    backgroundSize: "contain",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center",
                    filter: "drop-shadow(0 0 8px rgba(255,215,106,0.7))",
                  }}
                />
              ))}

            <motion.div
              initial={{ scale: 0.7, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              transition={popSpring}
              className="panel panel-glow relative mx-4 flex max-w-sm flex-col items-center p-8 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <TreasureChest open={chestOpen} />
              <AnimatePresence mode="wait">
                {chestOpen ? (
                  <motion.div
                    key="revealed"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4"
                  >
                    <h2 className="text-display text-glow text-2xl font-black text-[var(--gold)]">
                      Look What We Found!
                    </h2>
                    <p className="text-display mt-1 text-lg font-bold">{bought.name}</p>
                    <p className="mt-2 text-sm text-[var(--text-dim)]">
                      Your grown-up will make it real. Yay!
                    </p>
                    <GameButton className="mt-5" onClick={() => setBought(null)}>
                      Hooray!
                    </GameButton>
                  </motion.div>
                ) : (
                  <motion.p
                    key="opening"
                    exit={{ opacity: 0 }}
                    className="text-display mt-4 text-lg font-bold text-[var(--text-dim)]"
                  >
                    Opening the chest…
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* custom reward request */}
      <AnimatePresence>
        {requestOpen && (
          <motion.div
            {...overlayFade}
            role="dialog"
            aria-modal="true"
            aria-label="Make a wish"
            className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
            onClick={() => setRequestOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={popSpring}
              className="panel panel-glow w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {reqSent ? (
                <div className="py-6 text-center">
                  <Icon name="check" size={40} art className="mx-auto" />
                  <p className="text-display mt-3 text-lg font-black">Wish sent to your parent</p>
                </div>
              ) : (
                <>
                  <h2 className="text-display text-xl font-black">Make a Wish</h2>
                  <p className="mt-1 text-sm text-[var(--text-dim)]">
                    Ask for a treasure you would love to see in the vault
                  </p>
                  <input
                    value={reqName}
                    onChange={(e) => setReqName(e.target.value)}
                    placeholder="What treasure?"
                    className="mt-4 w-full rounded-xl border border-[var(--surface-border)] bg-black/30 px-4 py-3 font-semibold outline-none focus:[box-shadow:0_0_0_2px_var(--glow-soft)]"
                  />
                  <textarea
                    value={reqWhy}
                    onChange={(e) => setReqWhy(e.target.value)}
                    placeholder="Why do you want it?"
                    rows={3}
                    className="mt-3 w-full rounded-xl border border-[var(--surface-border)] bg-black/30 px-4 py-3 font-semibold outline-none focus:[box-shadow:0_0_0_2px_var(--glow-soft)]"
                  />
                  <div className="mt-4 flex justify-end gap-3">
                    <GameButton variant="ghost" onClick={() => setRequestOpen(false)}>
                      Cancel
                    </GameButton>
                    <GameButton variant="gold" onClick={sendRequest}>
                      Send Wish
                    </GameButton>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {profile && (
        <CompanionCoach
          steps={shopSteps}
          active={shopBeat.active}
          onDone={shopBeat.onDone}
          species={profile.pet}
        />
      )}
    </div>
  );
}

/* A proper treasure chest: shakes shut, then the lid swings open with light */
function TreasureChest({ open }: { open: boolean }) {
  return (
    <div className={open ? "" : "animate-[chest-shake_0.9s_ease-in-out_infinite]"}>
      <svg width="120" height="104" viewBox="0 0 120 104">
        <defs>
          <linearGradient id="chest-wood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a86b32" />
            <stop offset="100%" stopColor="#6e3f16" />
          </linearGradient>
          <linearGradient id="chest-lid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c58343" />
            <stop offset="100%" stopColor="#8a531f" />
          </linearGradient>
          <radialGradient id="chest-light" cx="50%" cy="100%" r="80%">
            <stop offset="0%" stopColor="rgba(255,230,140,0.95)" />
            <stop offset="100%" stopColor="rgba(255,230,140,0)" />
          </radialGradient>
        </defs>

        {/* light from inside */}
        {open && <ellipse cx="60" cy="52" rx="46" ry="30" fill="url(#chest-light)" />}

        {/* body */}
        <rect x="18" y="52" width="84" height="42" rx="6" fill="url(#chest-wood)" />
        <rect x="18" y="52" width="84" height="8" fill="rgba(0,0,0,0.25)" />
        <rect x="26" y="52" width="5" height="42" fill="rgba(0,0,0,0.18)" />
        <rect x="89" y="52" width="5" height="42" fill="rgba(0,0,0,0.18)" />

        {/* lid — swings open */}
        <g
          style={{
            transform: open ? "rotate(-38deg)" : "rotate(0deg)",
            transformOrigin: "18px 52px",
            transition: "transform 0.55s cubic-bezier(0.34, 1.4, 0.64, 1)",
          }}
        >
          <path d="M18 52 Q18 24 60 24 Q102 24 102 52 Z" fill="url(#chest-lid)" />
          <path d="M18 52 Q18 24 60 24 Q102 24 102 52 L 102 46 Q102 30 60 30 Q18 30 18 46 Z" fill="rgba(255,255,255,0.12)" />
          <rect x="54" y="24" width="12" height="28" rx="3" fill="#ffd76a" opacity="0.9" />
        </g>

        {/* clasp */}
        <rect x="52" y="50" width="16" height="18" rx="4" fill="#ffd76a" />
        <circle cx="60" cy="59" r="3.4" fill="#8a531f" />

        {/* gold band */}
        <rect x="18" y="70" width="84" height="6" fill="#ffd76a" opacity="0.85" />
      </svg>
    </div>
  );
}
