"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useWorld } from "./ThemeProvider";

/* Themed verification ceremony shown while the AI inspects the proof.
   Ninja: magic scroll scan. Samurai: golden scroll decoding.
   Speed: crystal beam analysis. */
export function VerifyOverlay({
  imageUrl,
  active,
}: {
  imageUrl: string | null;
  active: boolean;
}) {
  const { theme } = useWorld();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!active) return;
    setStep(0);
    const iv = setInterval(() => setStep((s) => Math.min(s + 1, 2)), 2600);
    return () => clearInterval(iv);
  }, [active]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 grid place-items-center bg-black/75 backdrop-blur-md"
        >
          <div className="flex flex-col items-center px-6">
            <motion.h3
              initial={{ y: -14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-display text-glow mb-6 text-2xl font-black text-[var(--accent-2)]"
            >
              {theme.verifyTitle}
            </motion.h3>

            {/* the proof, being scanned */}
            <div
              className="relative w-[min(78vw,340px)] overflow-hidden rounded-2xl"
              style={{ boxShadow: "0 0 0 2px var(--surface-border), 0 0 50px -6px var(--glow)" }}
            >
              {imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="proof" className="block w-full" />
              )}
              {/* scan beam */}
              <div
                className="fx-light absolute left-0 h-[14%] w-full"
                style={{
                  background:
                    "linear-gradient(180deg, transparent, var(--glow) 50%, transparent)",
                  animation: "scanline 2.2s ease-in-out infinite",
                }}
              />
              {/* corner runes */}
              {["top-2 left-2", "top-2 right-2", "bottom-2 left-2", "bottom-2 right-2"].map(
                (pos) => (
                  <div
                    key={pos}
                    className={`absolute ${pos} h-5 w-5 animate-pulse-glow rounded-sm`}
                    style={{
                      border: "2px solid var(--accent-2)",
                      boxShadow: "0 0 12px var(--glow)",
                    }}
                  />
                )
              )}
            </div>

            {/* orbiting spark */}
            <div className="relative mt-8 h-10 w-40">
              <motion.div
                className="absolute left-1/2 top-1/2 h-3 w-3 rounded-full"
                style={{ background: "var(--accent-2)", boxShadow: "0 0 16px var(--glow)" }}
                animate={{
                  x: [-60, 60, -60],
                  scale: [1, 1.5, 1],
                }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>

            <AnimatePresence mode="wait">
              <motion.p
                key={step}
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -12, opacity: 0 }}
                className="text-display mt-2 text-center text-lg font-bold text-[var(--text)]"
              >
                {theme.verifySteps[step]}
              </motion.p>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
