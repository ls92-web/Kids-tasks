"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorld } from "@/components/ThemeProvider";
import { Portrait } from "@/components/Portrait";
import { Companion } from "@/components/Companion";
import { Input, SectionCard, EmptyNote, AdminButton, pingAdminRefresh } from "@/components/admin/ui";
import { Callout } from "@/components/Callout";
import { Icon } from "@/components/Icon";
import { PETS, Profile, Family, levelFromXp } from "@/lib/game";

export default function ChildrenPage() {
  const { profile } = useWorld();
  const [family, setFamily] = useState<Family | null>(null);
  const [copied, setCopied] = useState(false);
  const [children, setChildren] = useState<Profile[]>([]);
  const [username, setUsername] = useState("");
  const [nickname, setNickname] = useState("");
  const [pin, setPin] = useState("");
  const [pet, setPet] = useState("dragon");
  const [charClass] = useState("shadow_warrior");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [reqMsg, setReqMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [adjust, setAdjust] = useState<Record<string, { coins: string; xp: string }>>({});
  // per-hero "Reset PIN": which hero's inline input is open + its value/result
  const [pinFor, setPinFor] = useState<string | null>(null);
  const [newPin, setNewPin] = useState("");
  const [pinMsg, setPinMsg] = useState<{ childId: string; ok: boolean; text: string } | null>(null);
  const [pinBusy, setPinBusy] = useState(false);

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

  // ---- join requests: heroes who joined with the Family Code -----------------
  // Rejecting asks for an inline second tap (no native dialogs in WonderNest).
  const [confirmRejectId, setConfirmRejectId] = useState<string | null>(null);
  async function decideRequest(child: Profile, approve: boolean) {
    if (!approve && confirmRejectId !== child.id) {
      setConfirmRejectId(child.id);
      return;
    }
    setConfirmRejectId(null);
    const supabase = createClient();
    const { error } = await supabase.rpc(approve ? "approve_child" : "reject_child", {
      p_child: child.id,
    });
    if (error) {
      setReqMsg({ ok: false, text: "Something went wrong — refresh and try again." });
      return;
    }
    setReqMsg(
      approve
        ? { ok: true, text: `${child.nickname} is in! They can now sign in and start their adventure.` }
        : { ok: true, text: `${child.nickname}'s request was declined.` }
    );
    load();
    pingAdminRefresh();
  }

  const pending = children.filter((c) => c.status === "pending_approval");
  const active = children.filter((c) => !c.status || c.status === "active");

  // ---- forgotten-PIN recovery: parent sets a new secret PIN -------------------
  // NOTE: Supabase enforces its minimum password length (6) on password
  // UPDATES, so reset PINs need 6+ characters even though original PINs
  // could be 4. Lowering the project's Auth minimum to 4 would relax this.
  async function resetPin(child: Profile) {
    if (pinBusy || newPin.length < 6) return;
    setPinBusy(true);
    setPinMsg(null);
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke("reset-child-pin", {
      body: { child_id: child.id, pin: newPin },
    });
    setPinBusy(false);
    if (error || data?.error) {
      let text = data?.error ?? "Could not reset the PIN — try again.";
      try {
        const body = await (error as { context?: Response })?.context?.json();
        if (body?.error) text = body.error;
      } catch {}
      setPinMsg({ childId: child.id, ok: false, text });
      return;
    }
    setPinMsg({
      childId: child.id,
      ok: true,
      text: `${child.nickname}'s new PIN is set — they can sign in with it now.`,
    });
    setNewPin("");
    setPinFor(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-display text-2xl font-black">Heroes</h1>

      {reqMsg && <Callout tone={reqMsg.ok ? "success" : "error"}>{reqMsg.text}</Callout>}

      {/* heroes created with the Family Code wait here for your blessing */}
      {pending.length > 0 && (
        <SectionCard
          title="Join Requests"
          subtitle="These heroes created their own adventurer with your Family Code — approve to let them in"
        >
          <div className="flex flex-col gap-2">
            {pending.map((c) => {
              const petMeta = PETS.find((p) => p.id === c.pet);
              return (
                <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-black/25 px-4 py-3">
                  <Portrait species={c.pet} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="text-display font-bold">{c.nickname}</p>
                    <p className="text-xs text-[var(--text-dim)]">
                      @{c.username} — chose {petMeta?.name ?? c.pet} the {petMeta?.species ?? "companion"}
                      {c.created_at && ` — asked ${new Date(c.created_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  {confirmRejectId === c.id ? (
                    <>
                      <span className="text-xs font-bold text-[var(--danger)]">
                        Turn away {c.nickname}? They won&apos;t be able to enter.
                      </span>
                      <AdminButton size="sm" variant="danger" onClick={() => decideRequest(c, false)}>
                        Yes, reject
                      </AdminButton>
                      <AdminButton size="sm" variant="ghost" onClick={() => setConfirmRejectId(null)}>
                        Cancel
                      </AdminButton>
                    </>
                  ) : (
                    <>
                      <AdminButton size="sm" onClick={() => decideRequest(c, true)}>
                        <Icon art muted name="check" size={14} /> Approve
                      </AdminButton>
                      <AdminButton size="sm" variant="danger" onClick={() => decideRequest(c, false)}>
                        <Icon art muted name="close" size={14} /> Reject
                      </AdminButton>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* the family code IS the invitation */}
      {family && (
        <SectionCard
          title="Invite a hero"
          subtitle="Your child opens the app, taps “Join My Family”, enters this code and creates their own hero — you approve it here"
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
                  <Icon art muted name="users" size={14} className="mr-1 inline" />
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
              className={`cursor-pointer rounded-full transition-transform ${
                pet === p.id ? "scale-105" : "opacity-70 hover:opacity-100"
              }`}
            >
              <Portrait species={p.id} size={44} ring={pet === p.id} />
            </button>
          ))}
        </div>

        {/* full-body Baby preview of the chosen companion — visual only */}
        <div className="mt-5 flex flex-col items-center">
          <p className="text-display mb-1 text-sm font-black text-[var(--accent-2)]">
            {PETS.find((p) => p.id === pet)?.name ?? "Companion"}
          </p>
          <div className="relative grid min-h-[196px] place-items-center sm:min-h-[236px]">
            {/* soft grounding shadow so the character feels planted */}
            <div className="pointer-events-none absolute bottom-3 h-3 w-24 rounded-[50%] bg-black/50 blur-md" />
            <div className="origin-bottom scale-[0.82] sm:scale-100">
              <Companion species={pet} level={1} size={220} float />
            </div>
          </div>
        </div>

        {msg && (
          <Callout tone={msg.ok ? "success" : "error"} className="mt-3">
            {msg.text}
          </Callout>
        )}
        <div className="mt-4">
          <AdminButton onClick={createChild} disabled={busy || username.length < 3 || pin.length < 4}>
            {busy ? "Creating\u2026" : "Create hero"}
          </AdminButton>
        </div>
      </SectionCard>

      <SectionCard title="Your heroes" subtitle="Adjust coins or XP with + and - amounts">
        {active.length === 0 ? (
          <EmptyNote>No heroes yet — share your Family Code or create one above.</EmptyNote>
        ) : (
          <div className="flex flex-col gap-3">
            {active.map((c) => {
              const { level } = levelFromXp(c.xp);
              const a = adjust[c.id] ?? { coins: "", xp: "" };
              return (
                <div key={c.id} className="rounded-xl bg-black/25 p-4">
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
                    <AdminButton variant="ghost" onClick={() => applyAdjust(c.id)}>
                      Apply
                    </AdminButton>
                    <AdminButton
                      variant="ghost"
                      onClick={() => {
                        setPinFor(pinFor === c.id ? null : c.id);
                        setNewPin("");
                        setPinMsg(null);
                      }}
                    >
                      Reset PIN
                    </AdminButton>
                  </div>
                  {pinFor === c.id && (
                    <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl bg-black/20 p-3">
                      <div className="w-44">
                        <Input
                          label={`New PIN for ${c.nickname}`}
                          value={newPin}
                          onChange={(e) => setNewPin(e.target.value)}
                          placeholder="At least 6 digits"
                          type="password"
                        />
                      </div>
                      <AdminButton onClick={() => resetPin(c)} disabled={pinBusy || newPin.length < 6}>
                        {pinBusy ? "Saving…" : "Set new PIN"}
                      </AdminButton>
                      <AdminButton
                        variant="ghost"
                        onClick={() => {
                          setPinFor(null);
                          setNewPin("");
                        }}
                      >
                        Cancel
                      </AdminButton>
                    </div>
                  )}
                  {pinMsg && pinMsg.childId === c.id && (
                    <Callout tone={pinMsg.ok ? "success" : "error"} className="mt-3">
                      {pinMsg.text}
                    </Callout>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
