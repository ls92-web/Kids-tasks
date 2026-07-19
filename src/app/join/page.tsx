"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { ThemeProvider } from "@/components/ThemeProvider";
import { GameButton } from "@/components/GameButton";
import { Callout } from "@/components/Callout";
import { Companion } from "@/components/Companion";
import { Portrait } from "@/components/Portrait";
import { Icon } from "@/components/Icon";
import { sfx } from "@/lib/sound";
import { popSpring } from "@/lib/motion";
import { PETS, ELEMENTS, COMPANION_UNLOCKS, FAMILY_CODE_KEY } from "@/lib/game";

/* A hero is born. The Family Code opens the gate, then the child creates
   their own hero step by step:

     welcome → code → family found ✨ → hero name → companion → secret PIN
             → HERO REVEAL (cinematic) → waiting for parent approval

   The companion choice stays the emotional heart — a lifelong partner, not a
   settings picker. Heroes created here wait for a parent's approval before
   the world opens (status 'pending_approval', set server-side). */

type Step = "welcome" | "code" | "found" | "name" | "companion" | "pin" | "reveal" | "waiting";

export default function JoinPage() {
  return (
    <ThemeProvider initialProfile={null}>
      <JoinInner />
    </ThemeProvider>
  );
}

function JoinInner() {
  const [step, setStep] = useState<Step>("welcome");
  const [code, setCode] = useState("");
  const [family, setFamily] = useState<{ name: string; crest: string } | null>(null);
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

  // the input steps get progress dots; the story beats don't
  const DOT_STEPS: Step[] = ["code", "name", "companion", "pin"];

  async function checkCode() {
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { data, error: err } = await supabase.rpc("lookup_family_by_code", { p_code: code });
    setBusy(false);
    const found = data as { found: boolean; name?: string; crest?: string } | null;
    if (err || !found?.found) {
      setError("No family found with that code — check it with your grown-up.");
      return;
    }
    setFamily({ name: found.name ?? "Your family", crest: found.crest ?? "shield" });
    sfx.complete();
    setStep("found");
  }

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
      else if (/hero name/i.test(text)) setStep("name");
      return;
    }
    // remember the family on this device for the "Choose Your Hero" sign-in
    try {
      localStorage.setItem(FAMILY_CODE_KEY, code);
    } catch {}
    setBusy(false);
    sfx.ceremony();
    setStep("reveal");
  }

  const pet = species ? PETS.find((x) => x.id === species) : null;
  const el = pet ? ELEMENTS[pet.element] : null;

  return (
    <div className="relative min-h-screen">
      {/* official WonderNest hero art backdrop */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/splash.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(6,10,24,0.55) 0%, rgba(6,10,24,0.78) 52%, rgba(6,10,24,0.93) 100%)",
        }}
      />

      {/* the Hero Reveal takes the whole screen — everything else lives in the panel */}
      {step === "reveal" && pet && el && (
        <HeroReveal
          nickname={username}
          species={pet.id}
          petName={pet.name}
          petSpecies={pet.species}
          elementColor={el.color}
          onDone={() => setStep("waiting")}
        />
      )}

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel panel-glow w-full max-w-lg p-8"
        >
          {step !== "waiting" && (
            <div className="mb-6 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/emblem.png"
                alt="WonderNest"
                className="mx-auto mb-3 h-auto w-14"
              />
              <h1 className="text-display text-glow text-3xl font-black">
                {step === "welcome" ? "Welcome to WonderNest" : "Join the Adventure"}
              </h1>
              {DOT_STEPS.includes(step) && (
                <div className="mx-auto mt-3 flex w-fit items-center gap-1.5">
                  {DOT_STEPS.map((s, i) => (
                    <div
                      key={s}
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: step === s ? 28 : 14,
                        background:
                          DOT_STEPS.indexOf(step) >= i
                            ? "var(--accent)"
                            : "rgba(255,255,255,0.15)",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* ---- welcome ---------------------------------------------------- */}
            {step === "welcome" && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -16 }}
                className="flex flex-col items-center gap-5 text-center"
              >
                <p className="max-w-sm text-sm leading-relaxed text-[var(--text-dim)]">
                  A world of quests, treasures and companions is waiting for you.
                </p>
                {/* the three starters peeking in — a taste of what's coming */}
                <div className="flex items-end justify-center gap-1">
                  {starters.map((p, i) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 + i * 0.15, ...popSpring }}
                    >
                      <Companion species={p.id} level={1} size={i === 1 ? 96 : 76} float={false} interactive />
                    </motion.div>
                  ))}
                </div>
                <GameButton
                  onClick={() => {
                    sfx.click();
                    setStep("code");
                  }}
                  className="w-full text-lg"
                >
                  Join My Family <Icon name="arrowRight" size={16} className="ml-1 inline" />
                </GameButton>
              </motion.div>
            )}

            {/* ---- family code ------------------------------------------------ */}
            {step === "code" && (
              <motion.form
                key="code"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!busy && code.replace(/[^a-zA-Z0-9]/g, "").length >= 4) checkCode();
                }}
              >
                <p className="text-center text-sm text-[var(--text-dim)]">
                  Ask your grown-up for the <b className="text-[var(--accent-2)]">Family Code</b>
                </p>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="QF-7X92"
                  autoFocus
                  className="text-display w-full rounded-2xl border border-[var(--surface-border)] bg-black/30 px-4 py-4 text-center text-2xl font-black tracking-[0.25em] text-[var(--accent-2)] outline-none focus:[box-shadow:0_0_0_2px_var(--glow-soft)]"
                />
                {error && <Callout tone="error">{error}</Callout>}
                <GameButton
                  type="submit"
                  className="w-full text-lg"
                  disabled={busy || code.replace(/[^a-zA-Z0-9]/g, "").length < 4}
                >
                  {busy ? "Searching the realms…" : "Find My Family"}
                </GameButton>
              </motion.form>
            )}

            {/* ---- family found ✨ -------------------------------------------- */}
            {step === "found" && family && (
              <motion.div
                key="found"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, x: -16 }}
                transition={popSpring}
                className="flex flex-col items-center gap-4 text-center"
              >
                {/* the family crest, glowing — someone is waiting for you */}
                <motion.div
                  className="relative grid h-24 w-24 place-items-center rounded-full"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ ...popSpring, delay: 0.15 }}
                  style={{
                    background: "radial-gradient(circle at 35% 30%, var(--glow-soft), rgba(0,0,0,0.45))",
                    boxShadow: "0 0 34px -6px var(--glow)",
                  }}
                >
                  <div className="fx-light absolute inset-[-25%] animate-pulse-glow rounded-full"
                    style={{ background: "radial-gradient(circle, var(--glow-soft), transparent 70%)" }}
                  />
                  <Icon name={family.crest} size={52} art className="relative" />
                </motion.div>
                <div>
                  <p className="text-display text-glow text-2xl font-black">Family found! ✨</p>
                  <p className="text-display mt-1 text-lg font-bold text-[var(--accent-2)]">
                    {family.name}
                  </p>
                </div>
                <p className="max-w-xs text-sm text-[var(--text-dim)]">
                  Ready to create your WonderNest hero?
                </p>
                <GameButton
                  onClick={() => {
                    sfx.click();
                    setStep("name");
                  }}
                  className="w-full text-lg"
                >
                  Create My Hero <Icon name="arrowRight" size={16} className="ml-1 inline" />
                </GameButton>
              </motion.div>
            )}

            {/* ---- hero name -------------------------------------------------- */}
            {step === "name" && (
              <motion.form
                key="name"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (username.trim().length >= 3) {
                    setError("");
                    setStep("companion");
                  }
                }}
              >
                <p className="text-center text-sm text-[var(--text-dim)]">
                  Every legend starts with a <b className="text-[var(--accent-2)]">name</b>
                </p>
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
                {error && <Callout tone="error">{error}</Callout>}
                <GameButton type="submit" className="w-full text-lg" disabled={username.trim().length < 3}>
                  Next <Icon name="arrowRight" size={16} className="ml-1 inline" />
                </GameButton>
              </motion.form>
            )}

            {/* ---- companion -------------------------------------------------- */}
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
                  <b className="text-[var(--accent-2)]">One</b> will grow with you from Baby to Legend.
                </p>
                {starters.map((p, i) => {
                  const elc = ELEMENTS[p.element];
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
                      style={{ boxShadow: `0 0 22px -12px ${elc.color}` }}
                    >
                      <div className="shrink-0">
                        <Companion species={p.id} level={1} size={86} float={false} interactive />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-display text-lg font-black">{p.name}</span>
                          <span
                            className="text-display rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider"
                            style={{ color: elc.color, background: "rgba(0,0,0,0.35)" }}
                          >
                            {elc.label}
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

            {step === "companion" && confirming && pet && el && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3 text-center"
              >
                {/* the chosen one, front and center */}
                <div className="relative">
                  <div
                    className="fx-light absolute inset-[-20%] animate-pulse-glow rounded-full"
                    style={{ background: `radial-gradient(circle, ${el.color}44, transparent 70%)` }}
                  />
                  <div className="relative animate-floaty">
                    <Companion species={pet.id} level={1} size={150} float={false} selected />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Portrait species={pet.id} size={44} />
                  <div className="text-left">
                    <p className="text-display text-xl font-black leading-tight">{pet.name}</p>
                    <p className="text-xs text-[var(--text-dim)]">
                      {pet.species} —{" "}
                      <span className="font-bold" style={{ color: el.color }}>
                        {el.label}
                      </span>{" "}
                      — {pet.personality}
                    </p>
                  </div>
                </div>
                <p className="max-w-xs text-sm leading-relaxed text-[var(--text)]">{pet.blurb}</p>

                {/* this choice matters — say so */}
                <div className="w-full rounded-xl bg-black/30 px-4 py-3">
                  <p className="text-display flex items-center justify-center gap-1.5 text-xs font-bold text-[var(--gold)]">
                    <Icon art name="sparkle" size={13} filled />
                    You and your companion will complete this adventure together.
                    Choose carefully!
                  </p>
                </div>

                <GameButton
                  onClick={() => {
                    sfx.click();
                    setError("");
                    setStep("pin");
                  }}
                  className="w-full text-lg"
                >
                  I choose {pet.name}!
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
              </motion.div>
            )}

            {/* ---- secret PIN ------------------------------------------------- */}
            {step === "pin" && (
              <motion.form
                key="pin"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!busy && pin.length >= 4) join();
                }}
              >
                <p className="text-center text-sm text-[var(--text-dim)]">
                  One last thing — a <b className="text-[var(--accent-2)]">secret PIN</b> only you know
                </p>
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
                    autoFocus
                    className="w-full rounded-xl border border-[var(--surface-border)] bg-black/30 px-4 py-3 font-semibold outline-none focus:[box-shadow:0_0_0_2px_var(--glow-soft)]"
                  />
                </label>
                <p className="text-center text-xs text-[var(--text-dim)]">
                  You&apos;ll use it every time you enter the world — keep it secret!
                </p>
                {error && <Callout tone="error">{error}</Callout>}
                <GameButton type="submit" className="w-full text-lg" disabled={busy || pin.length < 4}>
                  {busy ? "Creating your hero…" : "Create My Hero"}
                </GameButton>
              </motion.form>
            )}

            {/* ---- waiting for approval --------------------------------------- */}
            {step === "waiting" && pet && (
              <motion.div
                key="waiting"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-4 text-center"
              >
                <div className="relative">
                  <Portrait species={pet.id} size={84} />
                  <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-[var(--gold)]/90 shadow-lg">
                    <Icon name="clock" size={16} className="text-[#3d2a00]" />
                  </span>
                </div>
                <div>
                  <h2 className="text-display text-glow text-2xl font-black">Your hero is ready!</h2>
                  <p className="text-display mt-1 text-sm font-bold text-[var(--accent-2)]">
                    {username} &amp; {pet.name}
                  </p>
                </div>
                <p className="max-w-sm text-sm leading-relaxed text-[var(--text-dim)]">
                  Ask your grown-up to approve your adventure on their WonderNest dashboard.
                  Once they do, tap your hero on the sign-in screen and enter your secret PIN.
                </p>
                <GameButton onClick={() => window.location.assign("/login")} className="w-full text-lg">
                  To the gate
                </GameButton>
              </motion.div>
            )}
          </AnimatePresence>

          {step !== "waiting" && step !== "reveal" && (
            <p className="mt-5 text-center text-sm text-[var(--text-dim)]">
              Already a hero?{" "}
              <Link href="/login" className="font-bold text-[var(--accent-2)] hover:underline">
                Sign in
              </Link>
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}

/* ---- The Hero Reveal — the biggest moment of onboarding --------------------
   darkness → magic gathers around the companion → burst of light → the hero
   card revealed under confetti: nickname, companion, Level 1 Baby form.
   Same cinematic language as the Legend Ceremony, compressed for a beginning
   rather than an ending. */
function HeroReveal({
  nickname,
  species,
  petName,
  petSpecies,
  elementColor,
  onDone,
}: {
  nickname: string;
  species: string;
  petName: string;
  petSpecies: string;
  elementColor: string;
  onDone: () => void;
}) {
  const [stage, setStage] = useState<"gather" | "burst" | "hero">("gather");

  // Freeze the world behind the cinematic
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const t1 = setTimeout(() => {
      setStage("burst");
      sfx.whoosh();
    }, 2400);
    const t2 = setTimeout(() => {
      setStage("hero");
      sfx.levelUp();
    }, 3500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Hero Reveal"
      className="fixed inset-0 z-[90] grid place-items-center overflow-hidden bg-black/95 p-4"
    >
      {/* swelling aura */}
      <motion.div
        className="pointer-events-none absolute h-[75vmin] w-[75vmin] rounded-full"
        style={{ background: `radial-gradient(circle, ${elementColor}66, transparent 65%)` }}
        animate={{
          scale: stage === "gather" ? [1, 1.3, 1.15, 1.5] : stage === "burst" ? 2.8 : 1.6,
          opacity: stage === "hero" ? 0.35 : 0.9,
        }}
        transition={{ duration: stage === "gather" ? 2.2 : 0.9, ease: "easeInOut" }}
      />

      {/* rising magic while it gathers */}
      {stage !== "hero" && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 16 }).map((_, i) => (
            <motion.span
              key={i}
              className="absolute block h-1.5 w-1.5 rounded-full"
              style={{
                left: `${16 + ((i * 53) % 68)}%`,
                bottom: "-2%",
                background: i % 3 === 0 ? "#fff" : elementColor,
                boxShadow: `0 0 8px ${elementColor}`,
              }}
              animate={{ y: [0, -560], opacity: [0, 1, 0] }}
              transition={{
                duration: 2.2 + (i % 4) * 0.5,
                delay: (i % 7) * 0.25,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
          ))}
        </div>
      )}

      {/* burst of light */}
      <AnimatePresence>
        {stage === "burst" && (
          <motion.div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(circle, #fff, ${elementColor}88 45%, transparent 75%)`,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.4, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, times: [0, 0.25, 0.5, 0.7, 1] }}
          />
        )}
      </AnimatePresence>

      {/* confetti once the hero stands revealed */}
      {stage === "hero" && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 28 }).map((_, i) => (
            <span
              key={i}
              className="absolute block h-2.5 w-1.5 rounded-sm"
              style={{
                left: `${(i * 37) % 100}%`,
                top: "-3%",
                background: [elementColor, "#ffd76a", "#fff", "var(--accent)"][i % 4],
                animation: `confetti-fall ${2.6 + (i % 5) * 0.5}s linear ${(i % 7) * 0.3}s both`,
              }}
            />
          ))}
        </div>
      )}

      <div className="relative z-10 w-full max-w-lg text-center">
        <AnimatePresence mode="wait">
          {stage !== "hero" && (
            <motion.div
              key="gathering"
              initial={{ opacity: 0, scale: 0.7, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.15 }}
              transition={{ duration: 1.0, ease: "easeOut" }}
              className="flex flex-col items-center gap-5"
            >
              <motion.div
                animate={{ scale: stage === "burst" ? [1, 1.12, 0.9, 1.2] : [1, 1.05, 1] }}
                transition={
                  stage === "burst"
                    ? { duration: 1.1 }
                    : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
                }
              >
                <Companion species={species} level={1} size={200} float={false} />
              </motion.div>
              <motion.p
                className="text-display text-xl font-black text-white"
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.6, repeat: Infinity }}
              >
                A hero is being born…
              </motion.p>
            </motion.div>
          )}

          {stage === "hero" && (
            <motion.div
              key="hero"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={popSpring}
              className="flex flex-col items-center gap-4"
            >
              <div className="animate-floaty">
                <Companion species={species} level={1} size={220} float={false} selected />
              </div>
              <h2
                className="text-display text-4xl font-black text-white"
                style={{ textShadow: `0 0 30px ${elementColor}` }}
              >
                {nickname}!
              </h2>
              <p className="text-sm font-semibold text-white/80">
                You and {petName} the {petSpecies} — a brand new legend begins.
              </p>
              <div className="text-display flex items-center gap-2 rounded-2xl bg-black/40 px-5 py-2.5 text-sm font-black">
                <Icon name="star" size={16} art />
                <span className="text-[var(--gold)]">LEVEL 1</span>
                <span className="text-white/60">·</span>
                <span className="text-[var(--accent-2)]">Baby Form</span>
              </div>
              <GameButton onClick={onDone} className="mt-2 text-lg">
                Onward!
              </GameButton>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
