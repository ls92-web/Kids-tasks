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
import { REWARD_TIERS, tierForCost } from "@/lib/rewardLibrary";

/* A treasure the hero already claimed — pending until the parent makes it
   real, then granted. */
interface Redemption {
  id: string;
  reward_name: string;
  coins_spent: number;
  status: string;
  created_at: string;
}

/* Rewards group by SAVING TIER (Economy v1.1): the store reads as a ladder of
   goals — small treats first, dream goals last — so the question a hero asks
   is "what am I saving for?", never "what can I buy today?". A reward's tier
   comes from its price band, so parents' custom rewards slot in naturally. */

export default function ShopPage() {
  const { theme, profile, setProfile } = useWorld();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [treasures, setTreasures] = useState<Redemption[]>([]);
  const [bought, setBought] = useState<Reward | null>(null);
  const [chestOpen, setChestOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [reqName, setReqName] = useState("");
  const [reqWhy, setReqWhy] = useState("");
  const [reqImage, setReqImage] = useState<File | null>(null);
  const [reqImageUrl, setReqImageUrl] = useState<string | null>(null);
  const [reqSending, setReqSending] = useState(false);
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

  // the hero's own claimed treasures (RLS: children read only their own)
  useEffect(() => {
    if (!profile) return;
    const supabase = createClient();
    supabase
      .from("redemptions")
      .select("id, reward_name, coins_spent, status, created_at")
      .eq("child_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setTreasures((data as Redemption[]) ?? []));
  }, [profile]);

  // the store as a saving ladder: one section per tier, cheapest goals first
  const tiers = useMemo(
    () =>
      REWARD_TIERS.map((t) => ({
        tier: t,
        rewards: rewards.filter((r) => tierForCost(r.coin_cost).id === t.id),
      })).filter((g) => g.rewards.length > 0),
    [rewards]
  );

  // pin/unpin the ONE reward this hero is saving toward
  async function pinDream(r: Reward) {
    if (!profile) return;
    const next = profile.dream_reward_id === r.id ? null : r.id;
    setProfile({ ...profile, dream_reward_id: next } as Profile);
    sfx.chirp();
    const supabase = createClient();
    await supabase.from("profiles").update({ dream_reward_id: next }).eq("id", profile.id);
  }

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
    // the new treasure appears in "My Treasures" right away
    supabase
      .from("redemptions")
      .select("id, reward_name, coins_spent, status, created_at")
      .eq("child_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data: rd }) => setTreasures((rd as Redemption[]) ?? []));
    // chest ceremony
    setBought(r);
    setChestOpen(false);
    sfx.chest();
    setTimeout(() => {
      setChestOpen(true);
      sfx.coin();
    }, 950);
  }

  function pickReqImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError("");
    if (!f.type.startsWith("image/")) {
      setError("That file isn't a picture — try a photo.");
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      setError("That picture is too big (max 8 MB).");
      return;
    }
    if (reqImageUrl) URL.revokeObjectURL(reqImageUrl);
    setReqImage(f);
    setReqImageUrl(URL.createObjectURL(f));
  }

  function clearReqImage() {
    if (reqImageUrl) URL.revokeObjectURL(reqImageUrl);
    setReqImage(null);
    setReqImageUrl(null);
  }

  async function sendRequest() {
    if (!profile || reqName.trim().length < 2 || reqSending) return;
    setReqSending(true);
    setError("");
    const supabase = createClient();
    try {
      // an optional photo of the wish — uploaded to the child's own proofs
      // folder so parents can view it (same RLS as quest proofs)
      let imagePath: string | null = null;
      if (reqImage) {
        const ext = (reqImage.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${profile.id}/wish-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("proofs").upload(path, reqImage);
        if (upErr) throw upErr;
        imagePath = path;
      }
      const { error: insErr } = await supabase.from("reward_requests").insert({
        family_id: profile.family_id,
        child_id: profile.id,
        name: reqName.trim(),
        description: reqWhy.trim(),
        image_path: imagePath,
      });
      if (insErr) throw insErr;
    } catch {
      setError("We couldn't send your wish — please try again.");
      setReqSending(false);
      return;
    }
    sfx.complete();
    setReqSending(false);
    setReqSent(true);
    setReqName("");
    setReqWhy("");
    clearReqImage();
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
            Every {theme.coinName.toLowerCase().replace(/s$/, "")} you save brings a goal closer
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
          <Icon art name="wish" size={30} className="mr-1.5 inline" /> Wish for something
        </GameButton>
      </div>

      {error && <Callout tone="error">{error}</Callout>}

      {tiers.length === 0 ? (
        <div className="panel overflow-hidden text-center">
          {/* Welcome Hero — fills the card width, shown whole, text below */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/login-hero.png"
            alt=""
            className="block w-full"
          />
          <p className="text-display px-6 py-6 font-bold text-[var(--text-dim)]">
            The vault is being stocked. Check back soon!
          </p>
        </div>
      ) : (
        tiers.map(({ tier, rewards: tierRewards }) => (
          <section key={tier.id}>
            <div className="mb-3 flex flex-wrap items-baseline gap-2">
              <h2 className="text-display text-lg font-black">{tier.name}</h2>
              <span className="text-xs font-semibold text-[var(--text-dim)]">{tier.blurb}</span>
              <div className="h-px flex-1 self-center bg-gradient-to-r from-[var(--surface-border)] to-transparent" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tierRewards.map((r, i) => (
                <RewardCard
                  key={r.id}
                  reward={r}
                  coins={profile?.coins ?? 0}
                  onBuy={buy}
                  index={i}
                  pinned={profile?.dream_reward_id === r.id}
                  onPin={pinDream}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {/* the hero's claimed treasures — pride of ownership, and a clear
          "on its way" vs "received" state for each one */}
      {treasures.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Icon name="chest" size={22} art />
            <h2 className="text-display text-lg font-black">My Treasures</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-[var(--surface-border)] to-transparent" />
          </div>
          <div className="flex flex-col gap-2">
            {treasures.map((t) => {
              const granted = t.status === "granted";
              return (
                <div key={t.id} className="flex items-center gap-3 rounded-xl bg-black/25 px-4 py-3">
                  <Icon name={granted ? "check" : "wrapped-gift"} size={26} art className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-display truncate text-sm font-bold">{t.reward_name}</p>
                    <p className="text-xs text-[var(--text-dim)]">
                      {t.coins_spent} {theme.coinName.toLowerCase()} —{" "}
                      {new Date(t.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className="text-display shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase"
                    style={{
                      color: granted ? "var(--success)" : "var(--gold)",
                      background: "rgba(0,0,0,0.3)",
                    }}
                  >
                    {granted ? "Received!" : "On its way!"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/ui/icons/wish-reward.png"
                    alt=""
                    className="mx-auto mb-2 h-24 w-auto object-contain drop-shadow-[0_0_18px_var(--glow)]"
                  />
                  <h2 className="text-display text-center text-xl font-black">Make a Wish</h2>
                  <p className="mt-1 text-center text-sm text-[var(--text-dim)]">
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
                  {/* optional picture of the wish */}
                  {reqImageUrl ? (
                    <div className="relative mt-3 overflow-hidden rounded-xl border border-[var(--surface-border)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={reqImageUrl} alt="Your wish" className="max-h-48 w-full object-cover" />
                      <button
                        type="button"
                        onClick={clearReqImage}
                        aria-label="Remove picture"
                        className="absolute right-2 top-2 grid h-8 w-8 cursor-pointer place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
                      >
                        <Icon name="x" size={16} />
                      </button>
                    </div>
                  ) : (
                    <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--surface-border)] bg-black/20 px-4 py-3 text-sm font-bold text-[var(--text-dim)] transition-colors hover:bg-black/30 hover:text-[var(--text)]">
                      <Icon name="camera" size={18} art /> Add a picture{" "}
                      <span className="font-semibold opacity-70">(optional)</span>
                      <input type="file" accept="image/*" className="hidden" onChange={pickReqImage} />
                    </label>
                  )}
                  {error && (
                    <p className="mt-2 text-center text-xs font-semibold text-[var(--danger)]">{error}</p>
                  )}
                  <div className="mt-4 flex justify-end gap-3">
                    <GameButton variant="ghost" onClick={() => setRequestOpen(false)}>
                      Cancel
                    </GameButton>
                    <GameButton variant="gold" onClick={sendRequest} disabled={reqSending}>
                      {reqSending ? "Sending…" : "Send Wish"}
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

/* The official treasure chest: shakes shut, then crossfades to the glowing
   magic chest as it bursts open. Both frames are mounted so the reveal art is
   already loaded — no flash at the celebratory moment. */
function TreasureChest({ open }: { open: boolean }) {
  return (
    <div className={open ? "" : "animate-[chest-shake_0.9s_ease-in-out_infinite]"}>
      <div className="relative grid h-28 w-28 place-items-center">
        {/* light bursting from inside on open */}
        {open && (
          <div
            className="absolute inset-[-18%] animate-pulse-glow rounded-full"
            style={{ background: "radial-gradient(circle, rgba(255,230,140,0.6), transparent 68%)" }}
          />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ui/icons/treasure-chest.png"
          alt=""
          className="relative col-start-1 row-start-1 h-full w-full object-contain transition-opacity duration-300"
          style={{ opacity: open ? 0 : 1, filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.4))" }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ui/icons/magic-chest.png"
          alt=""
          className="relative col-start-1 row-start-1 h-full w-full object-contain transition-all duration-500"
          style={{
            opacity: open ? 1 : 0,
            transform: open ? "scale(1.1)" : "scale(0.9)",
            filter: "drop-shadow(0 0 16px rgba(255,215,106,0.85))",
          }}
        />
      </div>
    </div>
  );
}
