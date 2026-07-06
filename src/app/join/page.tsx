"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { ThemeProvider } from "@/components/ThemeProvider";
import { WorldBackground } from "@/components/WorldBackground";
import { GameButton } from "@/components/GameButton";
import { Companion } from "@/components/Companion";
import { Icon } from "@/components/Icon";
import { PETS, ELEMENTS, COMPANION_UNLOCKS, unlockHint } from "@/lib/game";

/* A hero joins the family adventure with the Family Code their parent shares.
   Three tiny steps, then straight into the world:
     code → hero name + PIN → choose your first companion */

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
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const starters = PETS.filter((p) => COMPANION_UNLOCKS[p.id]?.kind === "starter");
  const locked = PETS.filter((p) => COMPANION_UNLOCKS[p.id]?.kind !== "starter");

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
                {error && <p className="text-center text-sm font-bold text-[var(--danger)]">{error}</p>}
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
                {error && <p className="text-center text-sm font-bold text-[var(--danger)]">{error}</p>}
                <GameButton
                  type="submit"
                  className="w-full text-lg"
                  disabled={username.trim().length < 3 || pin.length < 4}
                >
                  Next <Icon name="arrowRight" size={16} className="ml-1 inline" />
                </GameButton>
              </motion.form>
            )}

            {step === "companion" && (
              <motion.div
                key="companion"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                className="flex flex-col gap-4"
              >
                <p className="text-center text-sm text-[var(--text-dim)]">
                  Choose your <b className="text-[var(--accent-2)]">first companion</b> — your
                  partner for the whole adventure
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {starters.map((p) => {
                    const chosen = species === p.id;
                    const el = ELEMENTS[p.element];
                    return (
                      <motion.button
                        key={p.id}
                        whileHover={{ y: -4 }}
                        whileTap={{ scale: 0.94 }}
                        onClick={() => setSpecies(p.id)}
                        className={`flex cursor-pointer flex-col items-center rounded-2xl bg-black/25 p-3 transition-shadow ${
                          chosen ? "ring-2 ring-[var(--accent)]" : ""
                        }`}
                        style={chosen ? { boxShadow: `0 0 24px -6px ${el.color}` } : {}}
                      >
                        <Companion species={p.id} level={1} size={84} float={chosen} />
                        <span className="text-display mt-1 text-sm font-black">{p.name}</span>
                        <span className="text-[10px] font-bold" style={{ color: el.color }}>
                          {el.label}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>

                {/* the rest of the roster sleeps, waiting to be earned */}
                <div className="rounded-xl bg-black/20 p-3">
                  <p className="text-display mb-2 text-center text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                    More companions await on your journey
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {locked.map((p) => (
                      <div
                        key={p.id}
                        className="grid h-11 w-11 place-items-center rounded-full bg-black/40"
                        title={unlockHint(COMPANION_UNLOCKS[p.id])}
                      >
                        <div className="opacity-30 grayscale">
                          <Companion species={p.id} level={1} size={36} float={false} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {error && <p className="text-center text-sm font-bold text-[var(--danger)]">{error}</p>}
                <GameButton onClick={join} disabled={!species || busy} className="w-full text-lg">
                  {busy ? "Opening the gate..." : "Begin the Adventure"}
                </GameButton>
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
