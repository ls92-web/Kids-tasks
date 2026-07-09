"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { ThemeProvider } from "@/components/ThemeProvider";
import { GameButton } from "@/components/GameButton";
import { Callout } from "@/components/Callout";
import { Icon } from "@/components/Icon";
import { enter } from "@/lib/motion";

type Mode = "hero" | "parent";

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
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    setError("");
    const supabase = createClient();
    const loginEmail =
      mode === "hero"
        ? `${username.toLowerCase().replace(/[^a-z0-9_-]/g, "")}@kidsquest.app`
        : email;
    const loginPassword = mode === "hero" ? pin : password;

    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    if (err || !data.user) {
      setError(
        mode === "hero"
          ? "That hero name or PIN is not right. Try again!"
          : err?.message ?? "Sign in failed"
      );
      setBusy(false);
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();
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

              {error && <Callout tone="error">{error}</Callout>}

              <GameButton type="submit" disabled={busy} className="mt-1 w-full text-lg">
                {busy ? "Opening the gate…" : "Enter the World"}
              </GameButton>
            </motion.form>
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: "numeric";
  autoCapitalize?: string;
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
        className="w-full rounded-xl border border-[var(--surface-border)] bg-black/30 px-4 py-3 font-semibold text-[var(--text)] outline-none transition-shadow placeholder:text-[var(--text-dim)]/50 focus:[box-shadow:0_0_0_2px_var(--glow-soft),0_0_20px_-4px_var(--glow)]"
      />
    </label>
  );
}
