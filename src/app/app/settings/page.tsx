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
import { CHILD_HELP } from "@/lib/tour";
import {
  PETS,
  THEMES,
  ThemeId,
  Profile,
  companionLevel,
  petForm,
  petElement,
} from "@/lib/game";
import { FINALE_WORLDS } from "@/lib/worlds";
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cs.worlds.map((w) => {
            const i = w.index;
            const tid = (Object.keys(THEMES) as ThemeId[])[i]; // undefined on the finale
            const isFinale = w.isFinale;
            const active = !isFinale && profile.theme === tid;
            const unlocked = w.state !== "locked";
            // only the three shared worlds are theme choices; the finale is the
            // companion's own climax — displayed, never a theme switch
            const canSwitch = !isFinale && unlocked;
            const previews: Record<string, string> = {
              ninja: "linear-gradient(160deg, #0c1430, #101c3f 60%, #1c2c5c)",
              samurai: "linear-gradient(160deg, #2c160c, #3d2012 60%, #5c3018)",
              speed: "linear-gradient(160deg, #0a2a5e, #0e3d7e 60%, #1258a8)",
              finale: "linear-gradient(160deg, #3a2a0c, #5a3d10 55%, #7a5416)",
            };
            return (
              <motion.button
                key={w.index}
                whileHover={canSwitch ? { y: -3 } : {}}
                whileTap={canSwitch ? { scale: 0.96 } : {}}
                onClick={() => canSwitch && tid && update({ theme: tid })}
                disabled={!canSwitch}
                className={`relative overflow-hidden rounded-2xl p-4 text-left transition-shadow ${
                  active ? "ring-2 ring-[var(--accent)]" : ""
                } ${isFinale && unlocked ? "ring-1 ring-[var(--gold)]/50" : ""} ${
                  canSwitch ? "cursor-pointer" : "cursor-default"
                }`}
                style={{
                  background: isFinale ? previews.finale : previews[tid],
                  boxShadow: active
                    ? "0 0 26px -4px var(--glow)"
                    : isFinale && unlocked
                      ? "0 0 26px -6px rgba(255,215,106,0.5)"
                      : "0 8px 20px -10px rgba(0,0,0,0.7)",
                  filter: unlocked ? "none" : "grayscale(0.7) brightness(0.6)",
                }}
              >
                {/* the world's own painted map, dimmed to a thrilling backdrop */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={w.world.map}
                  alt=""
                  aria-hidden
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                  style={{ opacity: unlocked ? 0.42 : 0.3 }}
                />
                {/* scrim so the label stays crisp over the art */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{ background: "linear-gradient(180deg, rgba(6,10,24,0.32) 0%, rgba(6,10,24,0.82) 100%)" }}
                />
                <div className="relative">
                  <p className="text-display text-[10px] font-black uppercase tracking-wider text-white/60">
                    {isFinale ? `Chapter ${i + 1} · Finale` : `Chapter ${i + 1}`}
                  </p>
                  <p className="text-display text-base font-black text-white [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]">
                    {w.world.name}
                  </p>
                  <p className="mt-0.5 text-xs text-white/80 [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]">
                    {unlocked
                      ? isFinale
                        ? cs.finaleWorld?.finale.blurb ?? "The final trial of your bond."
                        : THEMES[tid].tagline
                      : `Complete ${cs.worlds[i - 1]?.world.name ?? "the previous world"} to unlock`}
                  </p>
                </div>
                {active && (
                  <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-white/20">
                    <Icon name="check" size={14} className="text-white" />
                  </span>
                )}
                {isFinale && unlocked && !active && (
                  <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-[var(--gold)]/25">
                    <Icon name={cs.finaleWorld?.finale.icon ?? "trophy"} size={14} art />
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

      {/* adventure guide — read about anything again */}
      <section className="panel p-5">
        <h2 className="text-display mb-1 text-lg font-black">Adventure Guide</h2>
        <p className="mb-3 text-xs text-[var(--text-dim)]">
          Learn more about anything in your adventure
        </p>
        <HelpPanel topics={CHILD_HELP} accent="var(--accent-2)" />
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
