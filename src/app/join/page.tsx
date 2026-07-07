"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { ThemeProvider } from "@/components/ThemeProvider";
import { WorldBackground } from "@/components/WorldBackground";
import { GameButton } from "@/components/GameButton";
import { Callout } from "@/components/Callout";
import { Companion } from "@/components/Companion";
import { Portrait } from "@/components/Portrait";
import { Icon } from "@/components/Icon";
import { sfx } from "@/lib/sound";
import { PETS, ELEMENTS, COMPANION_UNLOCKS } from "@/lib/game";

/* A hero joins the family adventure with the Family Code their parent shares.
   Three tiny steps, then straight into the world:
     code → hero name + PIN → meet the three starters and bond with ONE.

   The companion choice is the emotional heart of onboarding — a lifelong
   partner, not a settings picker. Only the starters appear here; the other
   nine sleep in the Hero Hall until they're earned. */

type Step = "code" | "identity" | "companion";

export default function JoinPage() {
  return (
    <ThemeProvider initialProfile={null}>
      <JoinInner />
    </ThemeProvider>
  );
}

function JoinInner() {
  const [step, setStep] = useState<Step>("code");
  const [code, setCode] = useState("");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [species, setSpecies] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const STARTER_ORDER = ["dragon", "ninja", "turtle"];
  const starters = PETS.filter((p) => COMPANION_UNLOCKS[p.id]?.kind === "starter").sort(
    (a, b) => STARTER_ORDER.indexOf(a.id) - STARTER_ORDER.indexOf(b.id)
  );

  async function join() {
    if (!species) return;
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { data, error: err } = await supabase.functions.invoke("join-family", {
      body: { family_code: code, username, pin, nickname: username, pet: species },
    });
    if (err || data?.error) {
      let text = data?.error ?? "Something went wrong — try again.";
      try {
        const body = await (err as { context?: Response })?.context?.json();
        if (body?.error) text = body.error;
      } catch {}
      setError(text);
      setBusy(false);
      // code or name problems belong to earlier steps
      if (/family code|family found/i.test(text)) setStep("code");
      else if (/hero name|PIN/i.test(text)) setStep("identity");
      return;
    }
    // sign straight in — the adventure starts now
    const email = `${username.toLowerCase().replace(/[^a-z0-9_-]/g, "")}@kidsquest.app`;
    const { error: signErr } = await supabase.auth.signInWithPassword({ email, password: pin });
    if (signErr) {
      // account exists; let them sign in normally
      window.location.assign("/login");
      return;
    }
    window.location.assign("/app");
  }

  return (
    <div className="relative min-h-screen">
      <WorldBackground />
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel panel-glow w-full max-w-lg p-8"
        >
          <div className="mb-6 text-center">
            <h1 className="text-display text-glow text-3xl font-black">Join the Adventure</h1>
            <div className="mx-auto mt-3 flex w-fit items-center gap-1.5">
              {(["code", "identity", "companion"] as Step[]).map((s, i) => (
                <div
                  key={s}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: step === s ? 28 : 14,
                    background:
                      (["code", "identity", "companion"] as Step[]).indexOf(step) >= i
                        ? "var(--accent)"
                        : "rgba(255,255,255,0.15)",
                  }}
                />
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {step === "code" && (
              <motion.form
                key="code"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (code.replace(/[^a-zA-Z0-9]/g, "").length >= 4) {
                    setError("");
                    setStep("identity");
                  }
                }}
              >
                <p className="text-center text-sm text-[var(--text-dim)]">
                  Ask your parent for the <b className="text-[var(--accent-2)]">Family Code</b>
                </p>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="QF-7X92"
                  autoFocus
                  className="text-display w-full rounded-2xl border border-[var(--surface-border)] bg-black/30 px-4 py-4 text-center text-2xl font-black tracking-[0.25em] text-[var(--accent-2)] outline-none focus:[box-shadow:0_0_0_2px_var(--glow-soft)]"
                />
                {error && <Callout tone="error">{error}</Callout>}
                <GameButton type="submit" className="w-full text-lg" disabled={code.replace(/[^a-zA-Z0-9]/g, "").length < 4}>
                  Next <Icon name="arrowRight" size={16} className="ml-1 inline" />
                </GameButton>
              </motion.form>
            )}

            {step === "identity" && (
              <motion.form
                key="identity"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (username.trim().length >= 3 && pin.length >= 4) {
                    setError("");
                    setStep("companion");
                  }
                }}
              >
                <label className="block">
                  <span className="text-display mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]">
                    Choose your hero name
                  </span>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="shadowfox"
                    autoCapitalize="none"
                    autoFocus
                    className="w-full rounded-xl border border-[var(--surface-border)] bg-black/30 px-4 py-3 font-semibold outline-none focus:[box-shadow:0_0_0_2px_var(--glow-soft)]"
                  />
                </label>
                <label className="block">
                  <span className="text-display mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]">
                    Create your secret PIN
                  </span>
                  <input
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="At least 4 digits"
                    type="password"
                    inputMode="numeric"
                    className="w-full rounded-xl border border-[var(--surface-border)] bg-black/30 px-4 py-3 font-semibold outline-none focus:[box-shadow:0_0_0_2px_var(--glow-soft)]"
                  />
                </label>
                {error && <Callout tone="error">{error}</Callout>}
                <GameButton
                  type="submit"
                  className="w-full text-lg"
                  disabled={username.trim().length < 3 || pin.length < 4}
                >
                  Next <Icon name="arrowRight" size={16} className="ml-1 inline" />
                </GameButton>
              </motion.form>
            )}

            {step === "companion" && !confirming && (
              <motion.div
                key="companion"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                className="flex flex-col gap-3"
              >
                <p className="text-center text-sm text-[var(--text-dim)]">
                  Three companions have come to meet you.
                  <br />
                  <b className="text-[var(--accent-2)]">One</b> will share your whole adventure.
                </p>
                {starters.map((p, i) => {
                  const el = ELEMENTS[p.element];
                  return (
                    <motion.button
                      key={p.id}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 + i * 0.12 }}
                      whileHover={{ y: -3, scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        sfx.click();
                        setSpecies(p.id);
                        setConfirming(true);
                      }}
                      className="flex cursor-pointer items-center gap-4 rounded-2xl bg-black/25 p-4 text-left transition-shadow hover:ring-2 hover:ring-[var(--accent)]"
                      style={{ boxShadow: `0 0 22px -12px ${el.color}` }}
                    >
                      <div className="shrink-0">
                        <Companion species={p.id} level={1} size={86} float={false} interactive />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-display text-lg font-black">{p.name}</span>
                          <span
                            className="text-display rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider"
                            style={{ color: el.color, background: "rgba(0,0,0,0.35)" }}
                          >
                            {el.label}
                          </span>
                          <span className="text-display rounded-md bg-black/35 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[var(--accent-2)]">
                            {p.personality}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-[var(--text-dim)]">{p.species}</p>
                        <p className="mt-1 text-xs leading-snug text-[var(--text)]">{p.blurb}</p>
                      </div>
                      <Icon name="arrowRight" size={16} className="shrink-0 text-[var(--text-dim)]" />
                    </motion.button>
                  );
                })}
                {error && <Callout tone="error">{error}</Callout>}
              </motion.div>
            )}

            {step === "companion" && confirming && species && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3 text-center"
              >
                {(() => {
                  const p = PETS.find((x) => x.id === species)!;
                  const el = ELEMENTS[p.element];
                  return (
                    <>
                      {/* the chosen one, front and center */}
                      <div className="relative">
                        <div
                          className="fx-light absolute inset-[-20%] animate-pulse-glow rounded-full"
                          style={{ background: `radial-gradient(circle, ${el.color}44, transparent 70%)` }}
                        />
                        <div className="relative animate-floaty">
                          <Companion species={p.id} level={1} size={150} float={false} selected />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Portrait species={p.id} size={44} />
                        <div className="text-left">
                          <p className="text-display text-xl font-black leading-tight">{p.name}</p>
                          <p className="text-xs text-[var(--text-dim)]">
                            {p.species} —{" "}
                            <span className="font-bold" style={{ color: el.color }}>
                              {el.label}
                            </span>{" "}
                            — {p.personality}
                          </p>
                        </div>
                      </div>
                      <p className="max-w-xs text-sm leading-relaxed text-[var(--text)]">{p.blurb}</p>

                      {/* this choice matters — say so */}
                      <div className="w-full rounded-xl bg-black/30 px-4 py-3">
                        <p className="text-display flex items-center justify-center gap-1.5 text-xs font-bold text-[var(--gold)]">
                          <Icon name="sparkle" size={13} filled />
                          Your companion will travel with you until it becomes Legendary.
                          Choose carefully!
                        </p>
                      </div>

                      {error && (
                        <Callout tone="error">{error}</Callout>
                      )}
                      <GameButton onClick={join} disabled={busy} className="w-full text-lg">
                        {busy ? "Opening the gate…" : `I choose ${p.name}!`}
                      </GameButton>
                      <button
                        onClick={() => {
                          sfx.click();
                          setConfirming(false);
                          setSpecies(null);
                        }}
                        className="text-display cursor-pointer text-sm font-bold text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
                      >
                        Let me meet them again
                      </button>
                    </>
                  );
                })()}
              </motion.div>
            )}
          </AnimatePresence>

          <p className="mt-5 text-center text-sm text-[var(--text-dim)]">
            Already a hero?{" "}
            <Link href="/login" className="font-bold text-[var(--accent-2)] hover:underline">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
