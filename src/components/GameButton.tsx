"use client";

import { motion } from "framer-motion";
import { useRef, useState, useCallback } from "react";
import { sfx } from "@/lib/sound";

interface Spark {
  id: number;
  x: number;
  y: number;
  angle: number;
  dist: number;
  size: number;
}

/* Buttons never simply change color: they lift, glow, squash & stretch,
   and burst sparkles from the press point. */
export function GameButton({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  className = "",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "gold" | "danger";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  const [sparks, setSparks] = useState<Spark[]>([]);
  const idRef = useRef(0);

  const burst = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const fresh: Spark[] = Array.from({ length: 10 }, () => ({
      id: idRef.current++,
      x,
      y,
      angle: Math.random() * Math.PI * 2,
      dist: 24 + Math.random() * 36,
      size: 3 + Math.random() * 4,
    }));
    setSparks((s) => [...s, ...fresh]);
    setTimeout(
      () => setSparks((s) => s.filter((sp) => !fresh.includes(sp))),
      650
    );
  }, []);

  const styles: Record<string, string> = {
    primary:
      "text-white [background:linear-gradient(160deg,var(--accent),var(--accent-deep))] [box-shadow:0_0_24px_-4px_var(--glow),0_6px_16px_-6px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.25)]",
    gold:
      "text-[#3d2a00] [background:linear-gradient(160deg,#ffe9a8,var(--gold)_55%,#d9a72e)] [box-shadow:0_0_26px_-4px_rgba(255,215,106,0.55),0_6px_16px_-6px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.5)]",
    ghost:
      "text-[var(--text)] bg-white/5 border border-[var(--surface-border)] [box-shadow:inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-white/10",
    danger:
      "text-white [background:linear-gradient(160deg,#ff8ba6,var(--danger)_60%,#c2314f)] [box-shadow:0_0_22px_-6px_var(--danger),inset_0_1px_0_rgba(255,255,255,0.3)]",
  };

  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={(e) => {
        if (disabled) return;
        burst(e);
        sfx.click();
        onClick?.();
      }}
      whileHover={disabled ? {} : { y: -2, scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.94, scaleY: 0.88 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      className={`relative inline-flex min-h-[48px] select-none items-center justify-center gap-1.5 overflow-visible rounded-2xl px-6 py-3 font-extrabold tracking-wide text-display transition-opacity ${
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"
      } ${styles[variant]} ${className}`}
    >
      {children}
      {sparks.map((s) => (
        <motion.span
          key={s.id}
          initial={{ opacity: 1, x: s.x, y: s.y, scale: 1 }}
          animate={{
            opacity: 0,
            x: s.x + Math.cos(s.angle) * s.dist,
            y: s.y + Math.sin(s.angle) * s.dist,
            scale: 0.2,
          }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="pointer-events-none absolute left-0 top-0 rounded-full"
          style={{
            width: s.size,
            height: s.size,
            background: "var(--accent-2)",
            boxShadow: "0 0 8px var(--glow)",
          }}
        />
      ))}
    </motion.button>
  );
}
