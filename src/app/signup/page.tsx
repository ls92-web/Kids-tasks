"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { ThemeProvider } from "@/components/ThemeProvider";
import { WorldBackground } from "@/components/WorldBackground";
import { ParticleField } from "@/components/ParticleField";
import { GameButton } from "@/components/GameButton";

export default function SignupPage() {
  return (
    <ThemeProvider initialProfile={null}>
      <SignupInner />
    </ThemeProvider>
  );
}

function SignupInner() {
  const [familyName, setFamilyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
      setError(
        "Almost there — check your email to confirm your account, then sign in."
      );
      setBusy(false);
      return;
    }
    window.location.assign("/admin");
  }

  return (
    <div className="relative min-h-screen">
      <WorldBackground />
      <ParticleField />
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel panel-glow w-full max-w-md p-8"
        >
          <h1 className="text-display text-glow text-center text-3xl font-black text-[var(--accent-2)]">
            Found Your Guild
          </h1>
          <p className="mt-2 text-center text-sm text-[var(--text-dim)]">
            Create the parent account that runs the adventure
          </p>

          <form
            className="mt-7 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy) signUp();
            }}
          >
            <Field label="Family name" value={familyName} onChange={setFamilyName} placeholder="The Al-Salem Guild" />
            <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="you@example.com" />
            <Field label="Password" value={password} onChange={setPassword} type="password" placeholder="At least 6 characters" />
            {error && <p className="text-center text-sm font-bold text-[var(--danger)]">{error}</p>}
            <GameButton type="submit" disabled={busy} className="w-full text-lg">
              {busy ? "Raising the banners..." : "Begin the Legend"}
            </GameButton>
          </form>

          <p className="mt-5 text-center text-sm text-[var(--text-dim)]">
            Already have a guild?{" "}
            <Link href="/login" className="font-bold text-[var(--accent-2)] hover:underline">
              Sign in
            </Link>
          </p>
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
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
        className="w-full rounded-xl border border-[var(--surface-border)] bg-black/30 px-4 py-3 font-semibold text-[var(--text)] outline-none transition-shadow placeholder:text-[var(--text-dim)]/50 focus:[box-shadow:0_0_0_2px_var(--glow-soft),0_0_20px_-4px_var(--glow)]"
      />
    </label>
  );
}
