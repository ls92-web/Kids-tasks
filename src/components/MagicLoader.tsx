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
      <div className="relative h-28 w-28">
        {/* soft aura */}
        <div
          className="fx-light absolute inset-0 animate-pulse-glow rounded-full"
          style={{ background: "radial-gradient(circle, var(--glow-soft), transparent 70%)" }}
        />
        {/* rotating activity ring */}
        <motion.div
          className="absolute -inset-1 rounded-full"
          style={{ border: "2px dashed var(--surface-border)" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        />
        {/* official WonderNest loading illustration */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <motion.img
          src="/brand/loading.png"
          alt=""
          className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_0_18px_var(--glow)]"
          animate={{ y: [0, -6, 0], scale: [1, 1.04, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
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
    return (
      <div className="relative grid min-h-screen place-items-center overflow-hidden">
        {/* official WonderNest launch backdrop for the app's boot moment */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/launch-bg.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: "rgba(6,10,24,0.72)" }} />
        <div className="relative z-10">{core}</div>
      </div>
    );
  }
  return <div className="mt-16 grid place-items-center">{core}</div>;
}
