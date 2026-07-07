"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorld } from "@/components/ThemeProvider";
import { Portrait } from "@/components/Portrait";
import { GameButton } from "@/components/GameButton";
import { Input, Select, SectionCard, EmptyNote } from "@/components/admin/ui";
import { Icon } from "@/components/Icon";
import { PETS, CHARACTER_CLASSES, Profile, Family, levelFromXp } from "@/lib/game";

export default function ChildrenPage() {
  const { profile } = useWorld();
  const [family, setFamily] = useState<Family | null>(null);
  const [copied, setCopied] = useState(false);
  const [children, setChildren] = useState<Profile[]>([]);
  const [username, setUsername] = useState("");
  const [nickname, setNickname] = useState("");
  const [pin, setPin] = useState("");
  const [pet, setPet] = useState("dragon");
  const [charClass, setCharClass] = useState("shadow_warrior");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [adjust, setAdjust] = useState<Record<string, { coins: string; xp: string }>>({});

  const load = useCallback(async () => {
    if (!profile) return;
    const supabase = createClient();
    const [{ data }, { data: fam }] = await Promise.all([
      supabase
        .from("profiles")
        .select("*")
        .eq("family_id", profile.family_id)
        .eq("role", "child")
        .order("created_at"),
      supabase
        .from("families")
        .select("id, name, crest, code")
        .eq("id", profile.family_id)
        .single(),
    ]);
    setChildren((data as Profile[]) ?? []);
    setFamily((fam as Family) ?? null);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  async function createChild() {
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke("create-child", {
      body: { username, pin, nickname, pet, character_class: charClass },
    });
    setBusy(false);
    if (error) {
      let text = "Could not create the hero.";
      try {
        const body = await (error as { context?: Response }).context?.json();
        if (body?.error) text = body.error;
      } catch {}
      setMsg({ ok: false, text });
      return;
    }
    setMsg({ ok: true, text: `Hero "${data.username}" is ready to sign in with their name + PIN.` });
    setUsername("");
    setPin("");
    setNickname("");
    load();
  }

  async function applyAdjust(childId: string) {
    const a = adjust[childId];
    if (!a) return;
    const supabase = createClient();
    await supabase.rpc("adjust_child", {
      p_child_id: childId,
      p_coins: parseInt(a.coins || "0", 10) || 0,
      p_xp: parseInt(a.xp || "0", 10) || 0,
    });
    setAdjust((s) => ({ ...s, [childId]: { coins: "", xp: "" } }));
    load();
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-display text-2xl font-black">Heroes</h1>

      {/* the family code IS the invitation */}
      {family && (
        <SectionCard
          title="Invite a hero"
          subtitle="Your child opens the app, taps “Join with your Family Code”, and enters this code"
        >
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={() => {
                navigator.clipboard?.writeText(family.code);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="text-display cursor-pointer rounded-xl bg-black/30 px-6 py-3 text-2xl font-black tracking-[0.2em] text-[var(--gold)] transition-transform hover:scale-[1.03]"
              title="Copy"
            >
              {family.code}
            </button>
            <p className="text-sm text-[var(--text-dim)]">
              {copied ? (
                <span className="font-bold text-[var(--success)]">Copied!</span>
              ) : (
                <>
                  <Icon name="users" size={14} className="mr-1 inline" />
                  {family.name} — they pick their own hero name, PIN and first companion
                </>
              )}
            </p>
          </div>
        </SectionCard>
      )}

      <SectionCard
        title="Or create a hero yourself"
        subtitle="They sign in with hero name + secret PIN — no email needed"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Hero name (login)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="shadowfox"
          />
          <Input
            label="Secret PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="At least 4 digits"
          />
          <Input
            label="Nickname (shown in game)"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Lightning Sara"
          />
          <Select label="Character class" value={charClass} onChange={(e) => setCharClass(e.target.value)}>
            {CHARACTER_CLASSES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <p className="text-display mb-2 mt-4 text-xs font-bold uppercase tracking-wider text-[var(--text-dim)]">
          Companion
        </p>
        <div className="flex flex-wrap gap-2">
          {PETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPet(p.id)}
              title={p.species}
              className={`cursor-pointer rounded-full p-1 ${
                pet === p.id ? "ring-2 ring-[var(--accent)]" : ""
              }`}
            >
              <Portrait species={p.id} size={44} ring={pet === p.id} />
            </button>
          ))}
        </div>
        {msg && (
          <p
            className="mt-3 text-sm font-bold"
            style={{ color: msg.ok ? "var(--success)" : "var(--danger)" }}
          >
            {msg.text}
          </p>
        )}
        <div className="mt-4">
          <GameButton onClick={createChild} disabled={busy || username.length < 3 || pin.length < 4}>
            {busy ? "Creating\u2026" : "Create hero"}
          </GameButton>
        </div>
      </SectionCard>

      <SectionCard title="Your heroes" subtitle="Adjust coins or XP with + and - amounts">
        {children.length === 0 ? (
          <EmptyNote>No heroes yet — create one above.</EmptyNote>
        ) : (
          <div className="flex flex-col gap-3">
            {children.map((c) => {
              const { level } = levelFromXp(c.xp);
              const a = adjust[c.id] ?? { coins: "", xp: "" };
              return (
                <div key={c.id} className="rounded-xl bg-black/20 p-4">
                  <div className="flex items-center gap-3">
                    <Portrait species={c.pet} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="text-display font-bold">{c.nickname}</p>
                      <p className="text-xs text-[var(--text-dim)]">
                        @{c.username} — LV {level} — {c.coins} coins — {c.xp} XP
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <div className="w-28">
                      <Input
                        label="Coins +/-"
                        value={a.coins}
                        onChange={(e) =>
                          setAdjust((s) => ({ ...s, [c.id]: { ...a, coins: e.target.value } }))
                        }
                        placeholder="-20"
                      />
                    </div>
                    <div className="w-28">
                      <Input
                        label="XP +/-"
                        value={a.xp}
                        onChange={(e) =>
                          setAdjust((s) => ({ ...s, [c.id]: { ...a, xp: e.target.value } }))
                        }
                        placeholder="50"
                      />
                    </div>
                    <GameButton variant="ghost" className="!py-2.5 text-sm" onClick={() => applyAdjust(c.id)}>
                      Apply
                    </GameButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
