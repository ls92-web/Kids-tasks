"use client";

import { motion } from "framer-motion";
import { Icon } from "./Icon";
import { Reward, rewardRarity } from "@/lib/game";
import { enter, stagger } from "@/lib/motion";
import { useWorld } from "./ThemeProvider";

export const REWARD_ICONS: Record<string, string> = {
  gift: "gift",
  movie: "eye",
  icecream: "sparkle",
  screen: "lightning",
  toy: "star",
  trip: "map",
  ball: "sword",
  dinner: "flame",
  mystery: "chest",
  book: "book",
  clothing: "shield",
  weapon: "sword",
  pet: "star",
  petacc: "sparkle",
  decor: "home",
  experience: "map",
  outdoor: "flame",
  electronics: "lightning",
  parent: "users",
  animation: "sparkle",
};

/* Collectible reward card: rarity frame, floating art, shimmer,
   glowing claim button. */
export function RewardCard({
  reward,
  coins,
  onBuy,
  index = 0,
}: {
  reward: Reward;
  coins: number;
  onBuy: (r: Reward) => void;
  index?: number;
}) {
  const { theme } = useWorld();
  const rarity = rewardRarity(reward.coin_cost);
  const affordable = coins >= reward.coin_cost;
  const soldOut = reward.quantity !== null && reward.quantity <= 0;
  const expired = reward.expires_at ? new Date(reward.expires_at) < new Date() : false;
  const buyable = affordable && !soldOut && !expired && reward.available;

  return (
    <motion.div
      initial={enter.initial}
      animate={enter.animate}
      transition={{ ...enter.transition, delay: stagger(index) }}
      whileHover={{ y: -4 }}
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
            className="drop-shadow-[0_0_14px_var(--glow)]"
            filled={false}
          />
        </motion.div>
        {/* rarity chip */}
        <span
          className="text-display absolute left-2 top-2 rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
          style={{ color: rarity.color, background: "rgba(0,0,0,0.45)", boxShadow: `0 0 10px ${rarity.color}44` }}
        >
          {rarity.label}
        </span>
        {reward.quantity !== null && (
          <span className="text-display absolute right-2 top-2 rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-bold text-[var(--text-dim)]">
            {soldOut ? "SOLD OUT" : `${reward.quantity} left`}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        <h3 className="text-display text-base font-bold leading-tight">{reward.name}</h3>
        {reward.description && (
          <p className="mt-1 line-clamp-2 text-xs text-[var(--text-dim)]">{reward.description}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-display flex items-center gap-1.5 text-lg font-black text-[var(--gold)]">
            <span
              className="grid h-5 w-5 place-items-center rounded-full text-[10px] text-[#4d3600]"
              style={{ background: "radial-gradient(circle at 35% 30%, #fff3c4, var(--gold) 60%, #c99a1f)" }}
            >
              C
            </span>
            {reward.coin_cost}
          </span>
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
            {soldOut ? "Gone" : expired ? "Expired" : affordable ? "Claim" : "Locked"}
          </motion.button>
        </div>
        {!affordable && !soldOut && !expired && (
          <p className="mt-2 text-center text-[11px] font-semibold text-[var(--text-dim)]">
            {reward.coin_cost - coins} more {theme.coinName.toLowerCase()} to go
          </p>
        )}
      </div>
    </motion.div>
  );
}
