"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Icon } from "./Icon";
import { DIFFICULTY, Task } from "@/lib/game";
import { iconArt } from "@/lib/assets";
import { enter, stagger } from "@/lib/motion";
import { sfx } from "@/lib/sound";
import { useWorld } from "./ThemeProvider";

/* task type → delivered rendered icon art (public/icons/<slug>.png) */
const TYPE_ART: Record<string, string> = {
  chore: "home",
  homework: "multiplication",
  reading: "book",
  prayer: "prayer",
  quran: "quraan",
  habit: "energy",
  other: "star",
};

/* a bed-making chore gets the glowing-bed icon */
function questArt(task: Task): string {
  if (task.task_type === "chore" && task.title.toLowerCase().includes("bed")) return "make-bed";
  return TYPE_ART[task.task_type] ?? "star";
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  active: { label: "Ready", color: "var(--accent-2)" },
  submitted: { label: "Scanning", color: "var(--gold)" },
  needs_review: { label: "With the Elders", color: "var(--gold)" },
  completed: { label: "Victory", color: "var(--success)" },
  rejected: { label: "Try Again", color: "var(--danger)" },
  expired: { label: "Missed", color: "var(--text-dim)" },
};

export function QuestCard({ task, index = 0 }: { task: Task; index?: number }) {
  const { theme } = useWorld();
  const diff = DIFFICULTY[task.difficulty] ?? DIFFICULTY.easy;
  const badge = STATUS_BADGE[task.status] ?? STATUS_BADGE.active;
  const done = task.status === "completed";
  const deadline = task.deadline ? new Date(task.deadline) : null;
  const overdue = deadline && deadline < new Date() && !done;

  return (
    <Link href={`/app/quest/${task.id}`} onClick={() => sfx.click()} className="block">
      <motion.div
        initial={enter.initial}
        animate={enter.animate}
        transition={{ ...enter.transition, delay: stagger(index) }}
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.98 }}
        style={{ transition: "box-shadow 0.25s" }}
        className={`panel relative overflow-hidden p-3.5 hover:panel-glow ${
          done ? "saturate-[0.85]" : ""
        }`}
      >
        {/* difficulty edge glow */}
        <div
          className="absolute inset-y-0 left-0 w-1.5"
          style={{ background: diff.color, boxShadow: `0 0 14px ${diff.color}` }}
        />

        <div className="flex items-center gap-3.5 pl-1.5">
          {/* quest emblem */}
          <div
            className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl"
            style={{
              background: `linear-gradient(160deg, var(--glow-soft), rgba(0,0,0,0.4)), radial-gradient(90% 90% at 30% 20%, var(--bg-2), var(--bg-0))`,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15), 0 4px 12px -4px rgba(0,0,0,0.6)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={iconArt(questArt(task))}
              alt=""
              className={`h-10 w-10 object-contain ${done ? "opacity-50 grayscale" : ""}`}
            />
            {done && (
              <div
                className="absolute -bottom-1.5 -right-1.5 grid h-6 w-6 place-items-center rounded-full"
                style={{
                  background: "radial-gradient(circle at 35% 30%, #a8ffdd, var(--success) 65%)",
                  boxShadow: "0 0 12px var(--success)",
                  animation: "pop-seal 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both",
                }}
              >
                <Icon name="check" size={13} className="text-[#0a3d2a]" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex items-center gap-2">
              <span
                className="text-display rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ color: badge.color, background: "rgba(0,0,0,0.3)" }}
              >
                {badge.label}
              </span>
              <span className="flex gap-0.5" title={diff.label}>
                {Array.from({ length: diff.stars }).map((_, i) => (
                  <Icon key={i} name="star" size={10} filled className="text-[var(--gold)]" />
                ))}
              </span>
              {overdue && (
                <span className="text-[10px] font-bold text-[var(--danger)]">due!</span>
              )}
            </div>
            <h3 className={`text-display truncate text-[17px] font-bold ${done ? "line-through decoration-2 decoration-[var(--success)]/60" : ""}`}>
              {task.title}
            </h3>
            {task.description && (
              <p className="mt-0.5 line-clamp-1 text-xs text-[var(--text-dim)]">
                {task.description}
              </p>
            )}
          </div>

          {/* rewards */}
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span
              className="text-display flex items-center gap-1 rounded-lg bg-black/25 px-2 py-0.5 text-[13px] font-black text-[var(--accent-2)]"
            >
              +{task.xp_reward} <span className="text-[10px] opacity-80">XP</span>
            </span>
            <span className="text-display flex items-center gap-1 rounded-lg bg-black/25 px-2 py-0.5 text-[13px] font-black text-[var(--gold)]">
              +{task.coin_reward}
              <span
                className="grid h-3.5 w-3.5 place-items-center rounded-full text-[10px] font-black text-[#4d3600]"
                style={{ background: "radial-gradient(circle at 35% 30%, #fff3c4, var(--gold) 60%, #c99a1f)" }}
              >
                C
              </span>
            </span>
            <span className="flex items-center gap-1 text-[10px] text-[var(--text-dim)]">
              <Icon name="clock" size={11} /> {task.est_minutes}m
            </span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
