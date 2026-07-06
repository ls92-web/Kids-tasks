"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Icon } from "./Icon";
import { DIFFICULTY, Task } from "@/lib/game";
import { useWorld } from "./ThemeProvider";

const TYPE_ICONS: Record<string, string> = {
  chore: "home",
  homework: "scroll",
  reading: "book",
  habit: "flame",
  other: "sparkle",
};

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
    <Link href={`/app/quest/${task.id}`} className="block">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.06, type: "spring", stiffness: 120, damping: 16 }}
        whileHover={{ y: -5, scale: 1.015 }}
        whileTap={{ scale: 0.975 }}
        className={`panel relative overflow-hidden p-3.5 transition-shadow hover:panel-glow ${
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
            <Icon
              name={TYPE_ICONS[task.task_type] ?? "sparkle"}
              size={26}
              className={done ? "text-[var(--text-dim)]" : "text-[var(--accent-2)]"}
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
              +{task.xp_reward} <span className="text-[9px] opacity-80">XP</span>
            </span>
            <span className="text-display flex items-center gap-1 rounded-lg bg-black/25 px-2 py-0.5 text-[13px] font-black text-[var(--gold)]">
              +{task.coin_reward}
              <span
                className="grid h-3.5 w-3.5 place-items-center rounded-full text-[8px] font-black text-[#4d3600]"
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
