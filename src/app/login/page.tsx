"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { ThemeProvider } from "@/components/ThemeProvider";
import { GameButton } from "@/components/GameButton";
import { Callout } from "@/components/Callout";
import { Portrait } from "@/components/Portrait";
import { Icon } from "@/components/Icon";
import { sfx } from "@/lib/sound";
import { enter } from "@/lib/motion";
import { FAMILY_CODE_KEY } from "@/lib/game";

type Mode = "hero" | "parent";

/** An active hero on this device's remembered family — display data only
    (from the family_heroes lookup); entering still needs the hero's PIN. */
interface FamilyHero {
  username: string;
  nickname: string;
  pet: string;
}

export default function LoginPage() {
  return (
    <ThemeProvider initialProfile={null}>
      <LoginInner />
    </ThemeProvider>
  );
}

function LoginInner() {
  const [mode, setMode] = useState<Mode>("hero");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState(false); // pending-approval message
  const [busy, setBusy] = useState(false);

  // "Choose Your Hero": if this device remembers its family, show tappable
  // hero portraits instead of a typed name. Falls back to the classic form.
  const [heroes, setHeroes] = useState<FamilyHero[] | null>(null);
  const [chosen, setChosen] = useState<FamilyHero | null>(null);
  const [typeInstead, setTypeInstead] = useState(false);

  useEffect(() => {
    let storedCode: string | null = null;
    try {
      storedCode = localStorage.getItem(FAMILY_CODE_KEY);
    } catch {}
    if (!storedCode) return;
    const supabase = createClient();
    supabase.rpc("family_heroes", { p_code: storedCode }).then(({ data }) => {
      const res = data as { found: boolean; heroes?: FamilyHero[] } | null;
      if (res?.found && res.heroes && res.heroes.length > 0) setHeroes(res.heroes);
    });
  }, []);

  const pickerActive = mode === "hero" && !!heroes && !typeInstead;
  // shown under the typed form so a hero can hop back to the tap-to-pick list
  const showBackToHeroes = mode === "hero" && typeInstead && !!heroes;

  async function signIn(heroUsername?: string) {
    setBusy(true);
    setError("");
    setWaiting(false);
    const supabase = createClient();
    const name = heroUsername ?? username;
    const loginEmail =
      mode === "hero" ? `${name.toLowerCase().replace(/[^a-z0-9_-]/g, "")}@kidsquest.app` : email;
    const loginPassword = mode === "hero" ? pin : password;

    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    if (err || !data.user) {
      setError(
        mode === "hero"
          ? "That secret PIN is not right. Try again!"
          : err?.message ?? "Sign in failed"
      );
      setBusy(false);
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, status, family_id")
      .eq("id", data.user.id)
      .single();

    // heroes who joined with the Family Code wait for a parent's approval
    if (profile?.role === "child" && profile.status === "pending_approval") {
      await supabase.auth.signOut();
      setWaiting(true);
      setBusy(false);
      return;
    }
    if (profile?.role === "child" && profile.status === "rejected") {
      await supabase.auth.signOut();
      setError("This hero can't enter right now — talk to your grown-up.");
      setBusy(false);
      return;
    }

    // remember the family on this device so next time is just a tap
    if (profile?.role === "child" && profile.family_id) {
      const { data: fam } = await supabase
        .from("families")
        .select("code")
        .eq("id", profile.family_id)
        .single();
      if (fam?.code) {
        try {
          localStorage.setItem(FAMILY_CODE_KEY, fam.code);
        } catch {}
      }
    }
    // hard navigation so the auth cookies are seen by the server proxy
    window.location.assign(profile?.role === "parent" ? "/admin" : "/app");
  }

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
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <motion.div {...enter} className="panel panel-glow w-full max-w-md p-8">
          <div className="mb-2 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-stacked.png"
              alt="WonderNest"
              className="mx-auto w-44 max-w-[68%]"
            />
            <p className="mt-3 text-sm font-semibold text-[var(--text-dim)]">
              Every day is an adventure waiting to begin
            </p>
          </div>

          {/* mode switch */}
          <div className="mb-6 mt-6 flex rounded-2xl bg-black/30 p-1">
            {(["hero", "parent"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setError("");
                  setWaiting(false);
                }}
                className={`text-display relative flex-1 cursor-pointer rounded-xl py-2.5 text-sm font-bold transition-colors ${
                  mode === m ? "text-white" : "text-[var(--text-dim)]"
                }`}
              >
                {mode === m && (
                  <motion.div
                    layoutId="mode-pill"
                    className="absolute inset-0 rounded-xl"
                    style={{
                      background: "linear-gradient(160deg, var(--accent), var(--accent-deep))",
                      boxShadow: "0 0 18px -4px var(--glow)",
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative flex items-center justify-center gap-2">
                  <Icon art name={m === "hero" ? "sword" : "shield"} size={16} />
                  {m === "hero" ? "I'm a Hero" : "I'm a Parent"}
                </span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* ---- Choose Your Hero: tap your portrait, enter your PIN -------- */}
            {pickerActive && !chosen && (
              <motion.div
                key="picker"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col gap-4"
              >
                <p className="text-display text-center text-sm font-bold text-[var(--text-dim)]">
                  Choose your hero
                </p>
                <div className={`grid gap-3 ${heroes!.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                  {heroes!.map((h) => (
                    <motion.button
                      key={h.username}
                      whileHover={{ y: -3 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        sfx.click();
                        setError("");
                        setWaiting(false);
                        setChosen(h);
                      }}
                      className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl bg-black/25 p-4 transition-shadow hover:ring-2 hover:ring-[var(--accent)]"
                    >
                      <Portrait species={h.pet} size={64} />
                      <span className="text-display max-w-full truncate text-sm font-black">
                        {h.nickname}
                      </span>
                    </motion.button>
                  ))}
                </div>
                {waiting && (
                  <Callout tone="info">
                    Your hero is ready! Ask your grown-up to approve your adventure.
                  </Callout>
                )}
                {error && <Callout tone="error">{error}</Callout>}
                <button
                  onClick={() => {
                    sfx.click();
                    setTypeInstead(true);
                  }}
                  className="text-display cursor-pointer text-center text-xs font-bold text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
                >
                  My hero isn&apos;t here — type my hero name
                </button>
              </motion.div>
            )}

            {pickerActive && chosen && (
              <motion.form
                key="picker-pin"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!busy && pin.length >= 4) signIn(chosen.username);
                }}
              >
                <div className="flex flex-col items-center gap-2">
                  <Portrait species={chosen.pet} size={72} />
                  <p className="text-display text-lg font-black">{chosen.nickname}</p>
                </div>
                <Field
                  label="Enter your secret PIN"
                  value={pin}
                  onChange={setPin}
                  placeholder="Your secret code"
                  type="password"
                  inputMode="numeric"
                  autoFocus
                />
                {waiting && (
                  <Callout tone="info">
                    Your hero is ready! Ask your grown-up to approve your adventure.
                  </Callout>
                )}
                {error && <Callout tone="error">{error}</Callout>}
                <GameButton type="submit" disabled={busy || pin.length < 4} className="w-full text-lg">
                  {busy ? "Opening the gate…" : "Enter the World"}
                </GameButton>
                <button
                  type="button"
                  onClick={() => {
                    sfx.click();
                    setChosen(null);
                    setPin("");
                    setError("");
                    setWaiting(false);
                  }}
                  className="text-display cursor-pointer text-center text-xs font-bold text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
                >
                  Not you? Choose another hero
                </button>
              </motion.form>
            )}

            {/* ---- classic typed sign-in (parents; heroes on new devices) ----- */}
            {(mode === "parent" || !pickerActive) && (
              <motion.form
                key={mode}
                initial={{ opacity: 0, x: mode === "hero" ? -16 : 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: mode === "hero" ? 16 : -16 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!busy) signIn();
                }}
              >
                {mode === "hero" ? (
                  <>
                    <Field
                      label="Hero name"
                      value={username}
                      onChange={setUsername}
                      placeholder="shadowfox"
                      autoCapitalize="none"
                    />
                    <Field
                      label="Secret PIN"
                      value={pin}
                      onChange={setPin}
                      placeholder="Your secret code"
                      type="password"
                      inputMode="numeric"
                    />
                  </>
                ) : (
                  <>
                    <Field
                      label="Email"
                      value={email}
                      onChange={setEmail}
                      placeholder="you@example.com"
                      type="email"
                    />
                    <Field
                      label="Password"
                      value={password}
                      onChange={setPassword}
                      placeholder="Your password"
                      type="password"
                    />
                  </>
                )}

                {waiting && (
                  <Callout tone="info">
                    Your hero is ready! Ask your grown-up to approve your adventure.
                  </Callout>
                )}
                {error && <Callout tone="error">{error}</Callout>}

                <GameButton type="submit" disabled={busy} className="mt-1 w-full text-lg">
                  {busy ? "Opening the gate…" : "Enter the World"}
                </GameButton>
                {showBackToHeroes && (
                  <button
                    type="button"
                    onClick={() => {
                      sfx.click();
                      setTypeInstead(false);
                      setError("");
                      setWaiting(false);
                    }}
                    className="text-display cursor-pointer text-center text-xs font-bold text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
                  >
                    Back to my heroes
                  </button>
                )}
              </motion.form>
            )}
          </AnimatePresence>

          {mode === "hero" ? (
            <p className="mt-5 text-center text-sm text-[var(--text-dim)]">
              New hero?{" "}
              <Link href="/join" className="font-bold text-[var(--accent-2)] hover:underline">
                Join with your Family Code
              </Link>
            </p>
          ) : (
            <p className="mt-5 text-center text-sm text-[var(--text-dim)]">
              First time here?{" "}
              <Link href="/signup" className="font-bold text-[var(--accent-2)] hover:underline">
                Create your family
              </Link>
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  autoCapitalize,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: "numeric";
  autoCapitalize?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-display mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        inputMode={inputMode}
        autoCapitalize={autoCapitalize}
        autoFocus={autoFocus}
        className="w-full rounded-xl border border-[var(--surface-border)] bg-black/30 px-4 py-3 font-semibold text-[var(--text)] outline-none transition-shadow placeholder:text-[var(--text-dim)]/50 focus:[box-shadow:0_0_0_2px_var(--glow-soft),0_0_20px_-4px_var(--glow)]"
      />
    </label>
  );
}
