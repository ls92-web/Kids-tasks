"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { ThemeProvider } from "@/components/ThemeProvider";
import { WorldBackground } from "@/components/WorldBackground";
import { GameButton } from "@/components/GameButton";
import { Callout } from "@/components/Callout";
import { Icon } from "@/components/Icon";
import { CRESTS } from "@/lib/game";

/* Founding a family: name it, choose its crest, create the parent account,
   then receive the Family Code heroes use to join. */

type Step = "family" | "crest" | "account" | "code";

export default function SignupPage() {
  return (
    <ThemeProvider initialProfile={null}>
      <SignupInner />
    </ThemeProvider>
  );
}

function SignupInner() {
  const [step, setStep] = useState<Step>("family");
  const [familyName, setFamilyName] = useState("");
  const [crest, setCrest] = useState<string>("shield");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [familyCode, setFamilyCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function signUp() {
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: "parent",
          family_name: familyName || "My Family",
          family_crest: crest,
          nickname: "Guild Master",
        },
      },
    });
    if (err) {
      setError(err.message);
      setBusy(false);
      return;
    }
    if (!data.session) {
      setError("Almost there — check your email to confirm your account, then sign in. Your Family Code will be waiting on your dashboard.");
      setBusy(false);
      return;
    }
    // fetch the freshly minted Family Code for the reveal
    const { data: prof } = await supabase
      .from("profiles").select("family_id").eq("id", data.user!.id).single();
    const { data: fam } = await supabase
      .from("families").select("code").eq("id", prof?.family_id).single();
    setFamilyCode(fam?.code ?? null);
    setBusy(false);
    setStep("code");
  }

  return (
    <div className="relative min-h-screen">
      <WorldBackground />
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel panel-glow w-full max-w-md p-8"
        >
          <h1 className="text-display text-glow text-center text-3xl font-black text-[var(--accent-2)]">
            {step === "code" ? "Your Family is Ready" : "Create Your Family"}
          </h1>
          {step !== "code" && (
            <div className="mx-auto mt-3 flex w-fit items-center gap-1.5">
              {(["family", "crest", "account"] as Step[]).map((s, i) => (
                <div
                  key={s}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: step === s ? 28 : 14,
                    background:
                      (["family", "crest", "account"] as Step[]).indexOf(step) >= i
                        ? "var(--accent)"
                        : "rgba(255,255,255,0.15)",
                  }}
                />
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === "family" && (
              <motion.form
                key="family"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                className="mt-6 flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  setStep("crest");
                }}
              >
                <p className="text-center text-sm text-[var(--text-dim)]">
                  Every adventure begins with a family name
                </p>
                <Field
                  label="Family name"
                  value={familyName}
                  onChange={setFamilyName}
                  placeholder="The Fox Family"
                  autoFocus
                />
                <GameButton type="submit" className="w-full text-lg">
                  Next <Icon name="arrowRight" size={16} className="ml-1 inline" />
                </GameButton>
              </motion.form>
            )}

            {step === "crest" && (
              <motion.div
                key="crest"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                className="mt-6 flex flex-col gap-4"
              >
                <p className="text-center text-sm text-[var(--text-dim)]">
                  Choose the crest of <b className="text-[var(--accent-2)]">{familyName || "your family"}</b>
                </p>
                <div className="grid grid-cols-4 gap-2.5">
                  {CRESTS.map((c) => {
                    const chosen = crest === c.id;
                    return (
                      <motion.button
                        key={c.id}
                        whileHover={{ y: -3 }}
                        whileTap={{ scale: 0.92 }}
                        onClick={() => setCrest(c.id)}
                        title={c.label}
                        className={`grid aspect-square cursor-pointer place-items-center rounded-2xl transition-all ${
                          chosen ? "ring-2 ring-[var(--accent)]" : "bg-black/25"
                        }`}
                        style={
                          chosen
                            ? {
                                background: "linear-gradient(160deg, var(--accent), var(--accent-deep))",
                                boxShadow: "0 0 20px -4px var(--glow)",
                              }
                            : {}
                        }
                      >
                        <Icon name={c.id} size={26} art className={`transition-[filter,opacity] ${chosen ? "" : "opacity-45 saturate-[0.7]"}`} />
                      </motion.button>
                    );
                  })}
                </div>
                <p className="text-display text-center text-xs font-bold text-[var(--accent-2)]">
                  {CRESTS.find((c) => c.id === crest)?.label}
                </p>
                <GameButton onClick={() => setStep("account")} className="w-full text-lg">
                  Next <Icon name="arrowRight" size={16} className="ml-1 inline" />
                </GameButton>
              </motion.div>
            )}

            {step === "account" && (
              <motion.form
                key="account"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                className="mt-6 flex flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!busy) signUp();
                }}
              >
                <p className="text-center text-sm text-[var(--text-dim)]">
                  Your parent account — calm dashboard, full control
                </p>
                <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="you@example.com" autoFocus />
                <Field label="Password" value={password} onChange={setPassword} type="password" placeholder="At least 6 characters" />
                {error && <Callout tone="error">{error}</Callout>}
                <GameButton type="submit" disabled={busy} className="w-full text-lg">
                  {busy ? "Raising the banners…" : "Create Family"}
                </GameButton>
              </motion.form>
            )}

            {step === "code" && (
              <motion.div
                key="code"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-6 flex flex-col items-center gap-4 text-center"
              >
                <div
                  className="grid h-16 w-16 place-items-center rounded-full"
                  style={{
                    background: "linear-gradient(160deg, var(--accent), var(--accent-deep))",
                    boxShadow: "0 0 30px -6px var(--glow)",
                  }}
                >
                  <Icon name={crest} size={30} art />
                </div>
                <p className="text-display text-lg font-black">{familyName || "My Family"}</p>
                <p className="text-sm text-[var(--text-dim)]">
                  Share this <b className="text-[var(--accent-2)]">Family Code</b> with your children —
                  they use it to join as heroes
                </p>
                <button
                  onClick={() => {
                    if (familyCode) navigator.clipboard?.writeText(familyCode);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                  className="text-display cursor-pointer rounded-2xl bg-black/30 px-8 py-4 text-3xl font-black tracking-[0.2em] text-[var(--gold)] transition-transform hover:scale-105"
                  style={{ boxShadow: "0 0 24px -8px var(--glow)" }}
                >
                  {familyCode ?? "QF-????"}
                </button>
                <p className="text-xs font-bold text-[var(--text-dim)]">
                  {copied ? "Copied!" : "Tap to copy — it also lives on your dashboard"}
                </p>
                <GameButton onClick={() => window.location.assign("/admin")} className="w-full text-lg">
                  Open Your Dashboard
                </GameButton>
              </motion.div>
            )}
          </AnimatePresence>

          {step !== "code" && (
            <p className="mt-5 text-center text-sm text-[var(--text-dim)]">
              Already have a family?{" "}
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

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
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
        autoFocus={autoFocus}
        className="w-full rounded-xl border border-[var(--surface-border)] bg-black/30 px-4 py-3 font-semibold text-[var(--text)] outline-none transition-shadow placeholder:text-[var(--text-dim)]/50 focus:[box-shadow:0_0_0_2px_var(--glow-soft),0_0_20px_-4px_var(--glow)]"
      />
    </label>
  );
}
