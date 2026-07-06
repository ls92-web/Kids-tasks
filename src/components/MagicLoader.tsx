"use client";

import { motion } from "framer-motion";

/* A magical loading moment — a glowing core with orbiting stars and rising
   sparkles. Replaces every plain spinner so even waiting feels enchanted. */
export function MagicLoader({
  label,
  full = false,
}: {
  label?: string;
  full?: boolean;
}) {
  const core = (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-20 w-20">
        {/* soft aura */}
        <div
          className="fx-light absolute inset-0 animate-pulse-glow rounded-full"
          style={{ background: "radial-gradient(circle, var(--glow-soft), transparent 70%)" }}
        />
        {/* orbit ring */}
        <motion.div
          className="absolute inset-1 rounded-full"
          style={{ border: "2px dashed var(--surface-border)" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        />
        {/* glowing core gem */}
        <motion.div
          className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-2xl"
          style={{
            background: "linear-gradient(150deg, var(--accent-2), var(--accent-deep))",
            boxShadow: "0 0 26px -2px var(--glow)",
          }}
          animate={{ rotate: [0, 12, -12, 0], scale: [1, 1.12, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* orbiting stars */}
        {[0, 120, 240].map((deg, i) => (
          <motion.div
            key={deg}
            className="absolute left-1/2 top-1/2"
            animate={{ rotate: [deg, deg + 360] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "linear", delay: i * 0.2 }}
            style={{ transformOrigin: "0 0" }}
          >
            <div
              className="h-2.5 w-2.5 -translate-y-[34px] rounded-full"
              style={{ background: "var(--gold)", boxShadow: "0 0 10px var(--gold)" }}
            />
          </motion.div>
        ))}
      </div>
      {label && (
        <motion.p
          className="text-display shimmer-text text-sm font-bold"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {label}
        </motion.p>
      )}
    </div>
  );

  if (full) {
    return <div className="grid min-h-screen place-items-center bg-bg-0">{core}</div>;
  }
  return <div className="mt-16 grid place-items-center">{core}</div>;
}
