"use client";

import { motion } from "framer-motion";
import { Icon } from "./Icon";
import { Reward, rewardRarity } from "@/lib/game";
import { enter, stagger } from "@/lib/motion";

export const REWARD_ICONS: Record<string, string> = {
  gift: "wrapped-gift",
  movie: "golden-ticket",
  icecream: "potion",
  screen: "screen",
  toy: "star",
  trip: "map",
  ball: "sword",
  dinner: "flame",
  mystery: "mystery-box",
  book: "book",
  clothing: "shield",
  weapon: "sword",
  pet: "heart",
  petacc: "gem-pile",
  decor: "home",
  experience: "reward-voucher",
  outdoor: "flame",
  electronics: "lightning",
  parent: "wrapped-gift",
  animation: "sparkle",
};

/* Collectible reward card — a SAVING GOAL, not an impulse buy: rarity frame,
   floating art, a progress bar from the hero's coins toward the cost, and a
   claim button that only lights up once the goal is truly reached. */
export function RewardCard({
  reward,
  coins,
  onBuy,
  index = 0,
  pinned = false,
  onPin,
}: {
  reward: Reward;
  coins: number;
  onBuy: (r: Reward) => void;
  index?: number;
  /** This reward is the hero's pinned Dream Reward. */
  pinned?: boolean;
  /** Pin/unpin this reward as the hero's Dream Reward (star button). */
  onPin?: (r: Reward) => void;
}) {
  const rarity = rewardRarity(reward.coin_cost);
  const affordable = coins >= reward.coin_cost;
  const soldOut = reward.quantity !== null && reward.quantity <= 0;
  const buyable = affordable && !soldOut && reward.available;
  const pct = Math.max(0, Math.min(100, (coins / Math.max(1, reward.coin_cost)) * 100));

  return (
    <motion.div
      initial={enter.initial}
      animate={enter.animate}
      transition={{ ...enter.transition, delay: stagger(index) }}
      whileHover={{ y: -3 }}
      className="panel relative flex flex-col overflow-hidden p-0"
      style={{
        boxShadow: buyable
          ? `0 0 0 1.5px ${rarity.color}55, 0 0 28px -6px ${rarity.color}88, 0 18px 40px -18px rgba(0,0,0,0.65)`
          : `0 0 0 1.5px ${rarity.color}33, 0 18px 40px -18px rgba(0,0,0,0.65)`,
      }}
    >
      {/* art zone */}
      <div
        className="relative grid h-40 place-items-center overflow-hidden"
        style={{
          background: `radial-gradient(90% 120% at 50% 0%, ${rarity.color}30, transparent 60%), linear-gradient(160deg, var(--glow-soft), rgba(0,0,0,0.35)), radial-gradient(80% 100% at 50% 0%, var(--bg-2), var(--bg-0))`,
        }}
      >
        <motion.div
          animate={{ y: [0, -7, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <Icon
            name={REWARD_ICONS[reward.icon] ?? "gift"}
            size={72}
            art
            className="drop-shadow-[0_0_14px_var(--glow)]"
          />
        </motion.div>
        {/* rarity chip */}
        <span
          className="text-display absolute left-2 top-2 rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
          style={{ color: rarity.color, background: "rgba(0,0,0,0.45)", boxShadow: `0 0 10px ${rarity.color}44` }}
        >
          {rarity.label}
        </span>
        {reward.quantity !== null && (
          <span className="text-display absolute right-2 top-2 rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-bold text-[var(--text-dim)]">
            {soldOut ? "SOLD OUT" : `${reward.quantity} left`}
          </span>
        )}
        {/* pin as my Dream Reward — the goal I'm saving toward */}
        {onPin && (
          <button
            onClick={() => onPin(reward)}
            aria-pressed={pinned}
            aria-label={pinned ? "Unpin my dream reward" : "Make this my dream reward"}
            title={pinned ? "This is my dream reward" : "Make this my dream reward"}
            className="absolute bottom-2 right-2 grid h-9 w-9 cursor-pointer place-items-center rounded-full transition-all"
            style={{
              background: pinned ? "rgba(255,215,106,0.25)" : "rgba(0,0,0,0.45)",
              boxShadow: pinned ? "0 0 14px -2px rgba(255,215,106,0.8)" : "none",
            }}
          >
            <Icon
              name="star"
              size={20}
              art
              className={pinned ? "" : "opacity-40 grayscale"}
            />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        <h3 className="text-display text-base font-bold leading-tight">{reward.name}</h3>
        {reward.description && (
          <p className="mt-1 line-clamp-2 text-xs text-[var(--text-dim)]">{reward.description}</p>
        )}
        {/* the saving journey: my coins vs the goal, always visible */}
        <div className="mt-3">
          <div className="flex items-baseline justify-between text-xs font-bold">
            <span className="text-display flex items-center gap-1 text-[var(--gold)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ui/icons/coin.png" alt="" className="h-4 w-4 shrink-0 object-contain" />
              {Math.min(coins, reward.coin_cost)} / {reward.coin_cost}
            </span>
            <span
              className="text-display text-[11px]"
              style={{ color: affordable ? "var(--success)" : "var(--text-dim)" }}
            >
              {affordable ? "Saved up! \u2728" : `Only ${reward.coin_cost - coins} left!`}
            </span>
          </div>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-black/40">
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              style={{
                background: affordable
                  ? "linear-gradient(90deg, #ffe9a8, var(--gold))"
                  : `linear-gradient(90deg, var(--accent-deep), ${rarity.color})`,
                boxShadow: affordable ? "0 0 10px rgba(255,215,106,0.7)" : "none",
              }}
            />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-end">
          <motion.button
            whileHover={buyable ? { scale: 1.04 } : {}}
            whileTap={buyable ? { scale: 0.94 } : {}}
            disabled={!buyable}
            onClick={() => onBuy(reward)}
            className={`text-display inline-flex min-h-[40px] items-center rounded-xl px-5 py-2 text-sm font-black ${
              buyable ? "cursor-pointer text-[#3d2a00]" : "cursor-not-allowed bg-white/5 text-[var(--text-dim)]"
            }`}
            style={
              buyable
                ? {
                    background: "linear-gradient(160deg, #ffe9a8, var(--gold) 55%, #d9a72e)",
                    boxShadow: "0 0 18px -4px rgba(255,215,106,0.6)",
                  }
                : {}
            }
          >
            {soldOut ? "All gone" : affordable ? "It\u2019s ours!" : "Keep saving"}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
