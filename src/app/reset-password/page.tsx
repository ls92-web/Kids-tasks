"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { ThemeProvider } from "@/components/ThemeProvider";
import { GameButton } from "@/components/GameButton";
import { Callout } from "@/components/Callout";
import { enter } from "@/lib/motion";

/* Where the parent's password-reset email link lands. Opening the link signs
   them in with a recovery session (the browser client exchanges the code in
   the URL automatically); this page then lets them set a new password. */

export default function ResetPasswordPage() {
  return (
    <ThemeProvider initialProfile={null}>
      <ResetInner />
    </ThemeProvider>
  );
}

function ResetInner() {
  const [ready, setReady] = useState<"checking" | "ok" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // The recovery link signs the user in; give the code exchange a moment,
  // then check we have a real, server-verified session (getUser — a stale
  // local cookie for a deleted account must not pass).
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let attempts = 0;
    const check = async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (data.user) {
        setReady("ok");
      } else if (attempts++ < 6) {
        setTimeout(check, 500);
      } else {
        setReady("invalid");
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    if (busy) return;
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDone(true);
  }

  return (
    <div className="relative min-h-screen">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/splash.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(6,10,24,0.55) 0%, rgba(6,10,24,0.78) 52%, rgba(6,10,24,0.93) 100%)",
        }}
      />
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <motion.div {...enter} className="panel panel-glow w-full max-w-md p-8">
          <div className="mb-6 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/emblem.png" alt="WonderNest" className="mx-auto mb-3 h-auto w-14" />
            <h1 className="text-display text-glow text-2xl font-black">Set a new password</h1>
          </div>

          {ready === "checking" && (
            <p className="text-center text-sm font-semibold text-[var(--text-dim)]">
              Checking your reset link…
            </p>
          )}

          {ready === "invalid" && (
            <div className="flex flex-col gap-4">
              <Callout tone="error">
                This reset link has expired or was already used. Request a new one from the
                sign-in screen.
              </Callout>
              <Link href="/login" className="block">
                <GameButton className="w-full text-lg">Back to sign in</GameButton>
              </Link>
            </div>
          )}

          {ready === "ok" && !done && (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <label className="block">
                <span className="text-display mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]">
                  New password
                </span>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="At least 8 characters"
                  autoFocus
                  className="w-full rounded-xl border border-[var(--surface-border)] bg-black/30 px-4 py-3 font-semibold outline-none focus:[box-shadow:0_0_0_2px_var(--glow-soft)]"
                />
              </label>
              <label className="block">
                <span className="text-display mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]">
                  Confirm new password
                </span>
                <input
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  type="password"
                  placeholder="Type it again"
                  className="w-full rounded-xl border border-[var(--surface-border)] bg-black/30 px-4 py-3 font-semibold outline-none focus:[box-shadow:0_0_0_2px_var(--glow-soft)]"
                />
              </label>
              {error && <Callout tone="error">{error}</Callout>}
              <GameButton type="submit" disabled={busy} className="w-full text-lg">
                {busy ? "Saving…" : "Save new password"}
              </GameButton>
            </form>
          )}

          {ready === "ok" && done && (
            <div className="flex flex-col gap-4">
              <Callout tone="success">Your password is updated — welcome back!</Callout>
              <GameButton
                onClick={() => window.location.assign("/admin")}
                className="w-full text-lg"
              >
                Open Your Dashboard
              </GameButton>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
