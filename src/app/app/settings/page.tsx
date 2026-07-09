"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useWorld } from "@/components/ThemeProvider";
import { Companion } from "@/components/Companion";
import { GameButton } from "@/components/GameButton";
import { Icon } from "@/components/Icon";
import { sfx, soundsEnabled, setSoundsEnabled } from "@/lib/sound";
import { HelpPanel } from "@/components/HelpPanel";
import { CHILD_HELP, resetTours, CHILD_TOURS } from "@/lib/tour";
import {
  PETS,
  THEMES,
  ThemeId,
  Profile,
  companionLevel,
  petForm,
  petElement,
} from "@/lib/game";
import { WORLD_MAPS, FINALE_WORLDS } from "@/lib/worlds";
import { getCampaign } from "@/lib/campaign";

export default function SettingsPage() {
  const router = useRouter();
  const { profile, setProfile, companion } = useWorld();
  const [nickname, setNickname] = useState(profile?.nickname ?? "");
  const [saved, setSaved] = useState(false);
  const [sounds, setSounds] = useState(true);

  useEffect(() => {
    setSounds(soundsEnabled());
  }, []);

  if (!profile) return null;
  const cs = getCampaign(profile, companion);
  const cLevel = companion ? companionLevel(companion.xp) : 1;
  const petMeta = PETS.find((p) => p.id === profile.pet) ?? PETS[0];

  async function update(fields: Partial<Profile>) {
    if (!profile) return;
    const supabase = createClient();
    const next = { ...profile, ...fields } as Profile;
    setProfile(next);
    await supabase.from("profiles").update(fields).eq("id", profile.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="flex flex-col gap-6">
      <button
        onClick={() => {
          sfx.click();
          router.push("/app");
        }}
        className="text-display flex w-fit cursor-pointer items-center gap-1.5 text-sm font-bold text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
      >
        <Icon name="arrowLeft" size={16} /> Back to Adventure
      </button>
      <h1 className="text-display -mt-2 text-3xl font-black">Your Realm</h1>

      {/* chapters — worlds unlock in order as the adventure progresses */}
      <section className="panel p-5">
        <h2 className="text-display mb-1 text-lg font-black">Campaign worlds</h2>
        <p className="mb-3 text-xs text-[var(--text-dim)]">
          Your campaign&apos;s worlds unlock in order — complete each map to open the next
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(Object.keys(THEMES) as ThemeId[]).map((tid, i) => {
            const t = THEMES[tid];
            const active = profile.theme === tid;
            const unlocked = cs.worlds[i]?.state !== "locked";
            const previews: Record<ThemeId, string> = {
              ninja: "linear-gradient(160deg, #0c1430, #101c3f 60%, #1c2c5c)",
              samurai: "linear-gradient(160deg, #2c160c, #3d2012 60%, #5c3018)",
              speed: "linear-gradient(160deg, #0a2a5e, #0e3d7e 60%, #1258a8)",
            };
            return (
              <motion.button
                key={tid}
                whileHover={unlocked ? { y: -3 } : {}}
                whileTap={unlocked ? { scale: 0.96 } : {}}
                onClick={() => unlocked && update({ theme: tid })}
                disabled={!unlocked}
                className={`relative overflow-hidden rounded-2xl p-4 text-left transition-shadow ${
                  active ? "ring-2 ring-[var(--accent)]" : ""
                } ${unlocked ? "cursor-pointer" : "cursor-not-allowed"}`}
                style={{
                  background: previews[tid],
                  boxShadow: active ? "0 0 26px -4px var(--glow)" : "0 8px 20px -10px rgba(0,0,0,0.7)",
                  filter: unlocked ? "none" : "grayscale(0.7) brightness(0.6)",
                }}
              >
                <p className="text-display text-[10px] font-black uppercase tracking-wider text-white/60">
                  Chapter {i + 1}
                </p>
                <p className="text-display text-base font-black text-white">{t.name}</p>
                <p className="mt-0.5 text-xs text-white/70">
                  {unlocked
                    ? t.tagline
                    : `Complete ${WORLD_MAPS[(Object.keys(THEMES) as ThemeId[])[i - 1]]?.name ?? "the previous world"} to unlock`}
                </p>
                {active && (
                  <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-white/20">
                    <Icon name="check" size={14} className="text-white" />
                  </span>
                )}
                {!unlocked && (
                  <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-black/50">
                    <Icon name="lock" size={14} art />
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* identity */}
      <section className="panel p-5">
        <h2 className="text-display mb-3 text-lg font-black">Your hero name</h2>
        <label className="block">
          <span className="text-display mb-1.5 block text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]">
            Nickname
          </span>
          <div className="flex gap-2">
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="flex-1 rounded-xl border border-[var(--surface-border)] bg-black/30 px-4 py-3 font-semibold outline-none focus:[box-shadow:0_0_0_2px_var(--glow-soft)]"
            />
            <GameButton
              onClick={() => nickname.trim() && update({ nickname: nickname.trim() })}
              className="text-sm"
            >
              Save
            </GameButton>
          </div>
        </label>
      </section>

      {/* companion bond — a lifelong partner, not a picker */}
      <section className="panel p-5">
        <h2 className="text-display mb-1 text-lg font-black">Your companion</h2>
        <div className="flex items-center gap-4">
          <Companion species={profile.pet} level={cLevel} size={72} element={petMeta.element} />
          <div className="min-w-0 flex-1">
            <p className="text-display font-black">
              {petMeta.name}{" "}
              <span className="text-xs font-bold" style={{ color: petElement(profile.pet).color }}>
                LV {cLevel} — {petForm(cLevel).name} Form
              </span>
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-dim)]">
              {petMeta.name}
              {" is on their campaign with you — three shared worlds, then "}
              <b style={{ color: FINALE_WORLDS[profile.pet]?.accent ?? "var(--gold)" }}>
                {FINALE_WORLDS[profile.pet]?.name ?? "their own finale world"}
              </b>
              {". Completing it makes them a "}
              <b className="text-[var(--gold)]">Legend</b>
              {" — only then can a new campaign begin. Visit the Hero Hall to see your collection."}
            </p>
          </div>
        </div>
      </section>

      {/* animation intensity */}
      <section className="panel p-5">
        <h2 className="text-display mb-1 text-lg font-black">Magic intensity</h2>
        <p className="mb-3 text-xs text-[var(--text-dim)]">
          Turn effects down if the world feels too busy
        </p>
        <div className="flex gap-2">
          {(["full", "reduced", "minimal"] as const).map((v) => (
            <button
              key={v}
              aria-pressed={profile.animation_intensity === v}
              onClick={() => update({ animation_intensity: v })}
              className={`text-display flex-1 cursor-pointer rounded-xl px-3 py-2.5 text-sm font-bold capitalize transition-all ${
                profile.animation_intensity === v
                  ? "text-white"
                  : "bg-black/25 text-[var(--text-dim)] hover:bg-black/40"
              }`}
              style={
                profile.animation_intensity === v
                  ? {
                      background: "linear-gradient(160deg, var(--accent), var(--accent-deep))",
                      boxShadow: "0 0 16px -4px var(--glow)",
                    }
                  : {}
              }
            >
              {v}
            </button>
          ))}
        </div>
      </section>

      {/* sounds */}
      <section className="panel p-5">
        <h2 className="text-display mb-1 text-lg font-black">Sounds</h2>
        <p className="mb-3 text-xs text-[var(--text-dim)]">
          Coins, chests, fanfares — magic you can hear
        </p>
        <div className="flex gap-2">
          {[
            { v: true, label: "Sounds on" },
            { v: false, label: "Sounds off" },
          ].map((o) => (
            <button
              key={String(o.v)}
              aria-pressed={sounds === o.v}
              onClick={() => {
                setSounds(o.v);
                setSoundsEnabled(o.v);
                if (o.v) sfx.coin();
              }}
              className={`text-display flex-1 cursor-pointer rounded-xl px-3 py-2.5 text-sm font-bold transition-all ${
                sounds === o.v ? "text-white" : "bg-black/25 text-[var(--text-dim)] hover:bg-black/40"
              }`}
              style={
                sounds === o.v
                  ? {
                      background: "linear-gradient(160deg, var(--accent), var(--accent-deep))",
                      boxShadow: "0 0 16px -4px var(--glow)",
                    }
                  : {}
              }
            >
              {o.label}
            </button>
          ))}
        </div>
      </section>

      {/* adventure guide — let your companion show you around again */}
      <section className="panel p-5">
        <h2 className="text-display mb-1 text-lg font-black">Adventure Guide</h2>
        <p className="mb-3 text-xs text-[var(--text-dim)]">
          Let your companion guide you through everything again
        </p>
        <HelpPanel
          topics={CHILD_HELP}
          replayLabel="Adventure with my companion again"
          accent="var(--accent-2)"
          onReplay={() => {
            resetTours(profile.id, CHILD_TOURS);
            router.push("/app");
          }}
        />
      </section>

      {saved && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2"
        >
          <div className="panel panel-glow flex items-center gap-2 px-5 py-2.5">
            <Icon art name="check" size={16} className="text-[var(--success)]" />
            <span className="text-display text-sm font-bold">Saved</span>
          </div>
        </motion.div>
      )}

      <GameButton variant="ghost" onClick={logout} className="mx-auto w-fit text-sm">
        <Icon name="exit" size={15} art className="mr-1.5 inline" /> Leave the world
      </GameButton>
    </div>
  );
}
