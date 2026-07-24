"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorld } from "@/components/ThemeProvider";
import { Icon } from "@/components/Icon";
import { Input, TextArea, Select, SectionCard, EmptyNote, AdminButton, pingAdminRefresh } from "@/components/admin/ui";
import { IconPicker } from "@/components/admin/IconPicker";
import { REWARD_ICONS } from "@/components/RewardCard";
import { Reward } from "@/lib/game";
import { REWARD_LIBRARY, REWARD_CATEGORIES } from "@/lib/rewardLibrary";

interface Wish {
  id: string;
  child_id: string;
  name: string;
  description: string;
  status: string;
  image_path?: string | null;
  signedUrl?: string;
  profiles?: { nickname: string };
}

/* One purchase by one hero — pending until marked granted on Review. */
interface Purchase {
  id: string;
  reward_name: string;
  coins_spent: number;
  status: string;
  created_at: string;
  profiles?: { nickname: string };
}

const ICON_OPTIONS = [
  { id: "gift", label: "Parent Reward" },
  { id: "clothing", label: "Avatar Clothing" },
  { id: "weapon", label: "Weapon (fantasy)" },
  { id: "pet", label: "Pet" },
  { id: "petacc", label: "Pet Accessory" },
  { id: "decor", label: "Room Decor" },
  { id: "book", label: "Book" },
  { id: "icecream", label: "Sweet Treat" },
  { id: "dinner", label: "Special Dinner" },
  { id: "movie", label: "Movie" },
  { id: "screen", label: "Screen Time" },
  { id: "toy", label: "Toy" },
  { id: "ball", label: "Sports" },
  { id: "trip", label: "Experience / Trip" },
  { id: "outdoor", label: "Outdoor Activity" },
  { id: "electronics", label: "Electronics" },
  { id: "mystery", label: "Mystery Box" },
  { id: "ticket", label: "Event Ticket" },
  { id: "voucher", label: "Voucher" },
  { id: "treasure", label: "Treasure Box" },
  { id: "magicchest", label: "Magic Chest" },
  { id: "crystal", label: "Magic Crystal" },
  { id: "key", label: "Golden Key" },
  { id: "dream", label: "Dream Reward" },
];

export default function RewardsAdmin() {
  const { profile } = useWorld();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    icon: "gift",
    coin_cost: "100",
    quantity: "",
  });
  const [libRewardId, setLibRewardId] = useState("");
  // official category metadata, persisted with the reward (null for custom)
  const [libRewardCategory, setLibRewardCategory] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // outcome of the last create attempt — a silent failure looked exactly like
  // success (form cleared, nothing in the store), so the parent must SEE both
  const [createMsg, setCreateMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const supabase = createClient();
    const [{ data: r }, { data: w }, { data: p }] = await Promise.all([
      supabase
        .from("rewards")
        .select("*")
        .eq("family_id", profile.family_id)
        .order("coin_cost"),
      supabase
        .from("reward_requests")
        .select("*, profiles!reward_requests_child_id_fkey(nickname)")
        .eq("status", "pending"),
      // every purchase, newest first — who claimed what, and whether it's
      // been made real yet
      supabase
        .from("redemptions")
        .select("id, reward_name, coins_spent, status, created_at, profiles!redemptions_child_id_fkey(nickname)")
        .eq("family_id", profile.family_id)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setRewards((r as Reward[]) ?? []);
    setPurchases((p as unknown as Purchase[]) ?? []);
    // sign any attached wish photos so the parent can view them
    const wishesWithUrls = await Promise.all(
      ((w as Wish[]) ?? []).map(async (wish) => {
        if (!wish.image_path) return wish;
        const { data: signed } = await supabase.storage
          .from("proofs")
          .createSignedUrl(wish.image_path, 3600);
        return { ...wish, signedUrl: signed?.signedUrl };
      })
    );
    setWishes(wishesWithUrls);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  // ---- pick an Official Library reward from the dropdown ---------------------
  // Auto-fills name, description, cost and the matching official icon — every
  // field stays editable, and custom rewards work exactly as before. The Dream
  // Reward (RW039) leaves the cost blank for the parent to choose.
  function pickRewardLibrary(id: string) {
    setLibRewardId(id);
    if (!id) {
      setLibRewardCategory(null);
      return; // "Custom reward" — leave whatever the parent has typed
    }
    const r = REWARD_LIBRARY.find((x) => x.id === id);
    if (!r) return;
    setLibRewardCategory(r.category);
    setForm((f) => ({
      ...f,
      name: r.name,
      description: r.description,
      icon: r.icon,
      coin_cost: r.cost === null ? "" : String(r.cost),
    }));
  }

  async function createReward(prefill?: { name: string; description: string }) {
    if (!profile) return;
    const name = prefill?.name ?? form.name;
    if (name.trim().length < 2) return;
    setBusy(true);
    setCreateMsg(null);
    const supabase = createClient();
    let error: { message: string } | null = null;
    try {
      ({ error } = await supabase.from("rewards").insert({
        family_id: profile.family_id,
        name: name.trim(),
        description: (prefill?.description ?? form.description).trim(),
        icon: form.icon,
        coin_cost: parseInt(form.coin_cost, 10) || 100,
        quantity: form.quantity ? parseInt(form.quantity, 10) : null,
        category: prefill ? null : libRewardCategory,
      }));
    } catch (e) {
      // fetch itself can throw (Safari: "Load failed") before any response
      error = { message: e instanceof Error ? e.message : String(e) };
    }
    setBusy(false);
    if (error) {
      const network = /load failed|failed to fetch|network/i.test(error.message);
      setCreateMsg({
        ok: false,
        text: network
          ? "Couldn't reach the server — check your connection and press Add again."
          : `Couldn't add the reward: ${error.message}`,
      });
      return; // keep everything the parent typed so one tap retries
    }
    setCreateMsg({ ok: true, text: `“${name.trim()}” is now in the reward store.` });
    setForm((f) => ({ ...f, name: "", description: "", quantity: "" }));
    setLibRewardId("");
    setLibRewardCategory(null);
    load();
  }

  async function toggleReward(r: Reward) {
    const supabase = createClient();
    await supabase.from("rewards").update({ available: !r.available }).eq("id", r.id);
    load();
  }

  async function removeReward(id: string) {
    const supabase = createClient();
    await supabase.from("rewards").delete().eq("id", id);
    load();
  }

  async function resolveWish(w: Wish, approved: boolean) {
    // clear the wish from the list at once; approving prefills the form below
    setWishes((list) => list.filter((x) => x.id !== w.id));
    if (approved) {
      setForm((f) => ({ ...f, name: w.name, description: w.description }));
    }
    const supabase = createClient();
    await supabase
      .from("reward_requests")
      .update({ status: approved ? "approved" : "rejected" })
      .eq("id", w.id);
    pingAdminRefresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-display text-2xl font-black">Rewards</h1>

      {wishes.length > 0 && (
        <SectionCard title="Wishes from your heroes" subtitle="Approve to prefill the create form below">
          <div className="flex flex-col gap-2">
            {wishes.map((w) => (
              <div key={w.id} className="flex items-center gap-3 rounded-xl bg-black/25 px-4 py-3">
                {w.signedUrl ? (
                  <a
                    href={w.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative block h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-[var(--surface-border)]"
                    aria-label={`View the picture ${w.profiles?.nickname ?? "your hero"} attached`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={w.signedUrl} alt="" className="h-full w-full object-cover" />
                    <span className="absolute inset-0 grid place-items-center bg-black/0 text-white opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                      <Icon name="eye" size={16} />
                    </span>
                  </a>
                ) : (
                  <Icon name="wish" size={20} art muted className="shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-display truncate text-sm font-bold">{w.name}</p>
                  <p className="truncate text-xs text-[var(--text-dim)]">
                    {w.profiles?.nickname ?? "A hero"} — {w.description || "no reason given"}
                  </p>
                </div>
                <AdminButton size="sm" onClick={() => resolveWish(w, true)}>
                  <Icon art muted name="check" size={14} /> Approve
                </AdminButton>
                <AdminButton variant="ghost" size="sm" onClick={() => resolveWish(w, false)}>
                  Decline
                </AdminButton>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard title="Create a reward">
        <div className="mb-3">
          <Select
            label="Start from the Official Library (optional)"
            value={libRewardId}
            onChange={(e) => pickRewardLibrary(e.target.value)}
          >
            <option value="">Custom reward — write your own</option>
            {REWARD_CATEGORIES.map((cat) => (
              <optgroup key={cat} label={cat}>
                {REWARD_LIBRARY.filter((r) => r.category === cat).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.cost !== null ? ` — ${r.cost}c` : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
          <p className="mt-1 text-[11px] text-[var(--text-dim)]">
            Picks a reward and fills the name, description, cost and card art — you can edit everything below.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Movie Night"
          />
          <div className="sm:col-span-2">
            <IconPicker
              label="Card art"
              options={ICON_OPTIONS.map((o) => ({ ...o, art: REWARD_ICONS[o.id] ?? "gift" }))}
              value={form.icon}
              onChange={(icon) => setForm((f) => ({ ...f, icon }))}
            />
          </div>
          <div className="sm:col-span-2">
            <TextArea
              label="Description"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Pick any movie and stay up late watching it together"
            />
          </div>
          <Input
            label="Coin cost"
            value={form.coin_cost}
            onChange={(e) => setForm((f) => ({ ...f, coin_cost: e.target.value }))}
          />
          <Input
            label="Quantity (blank = unlimited)"
            value={form.quantity}
            onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
            placeholder="3"
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <AdminButton
            onClick={() => createReward()}
            disabled={busy || form.name.trim().length < 2 || !form.coin_cost.trim()}
          >
            {busy ? "Adding\u2026" : "Add reward"}
          </AdminButton>
          {createMsg && (
            <p
              role="status"
              className="text-sm font-semibold"
              style={{ color: createMsg.ok ? "var(--success)" : "var(--danger)" }}
            >
              {createMsg.text}
            </p>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Available rewards">
        {rewards.length === 0 ? (
          <EmptyNote>The vault is empty — add your first treasure above.</EmptyNote>
        ) : (
          <div className="flex flex-col gap-2">
            {rewards.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl bg-black/25 px-4 py-3">
                <Icon name={REWARD_ICONS[r.icon] ?? "wrapped-gift"} size={20} art muted className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-display truncate text-sm font-bold">
                    {r.name}{" "}
                    <span className="text-[var(--gold)]">— {r.coin_cost}c</span>
                  </p>
                  <p className="text-xs text-[var(--text-dim)]">
                    {r.quantity === null ? "unlimited" : `${r.quantity} left`}
                  </p>
                </div>
                <button
                  onClick={() => toggleReward(r)}
                  aria-pressed={r.available}
                  aria-label={`${r.name}: ${r.available ? "visible to heroes" : "hidden"} — tap to toggle`}
                  className={`text-display min-h-[32px] shrink-0 cursor-pointer rounded-md px-2.5 py-1 text-[10px] font-bold uppercase ${
                    r.available ? "text-[var(--success)]" : "text-[var(--text-dim)]"
                  }`}
                  style={{ background: "rgba(0,0,0,0.3)" }}
                >
                  {r.available ? "Live" : "Hidden"}
                </button>
                <button
                  onClick={() => removeReward(r.id)}
                  className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg text-[var(--text-dim)] transition-colors hover:bg-black/25 hover:text-[var(--danger)]"
                  aria-label={`Delete reward: ${r.name}`}
                >
                  <Icon name="x" size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Purchased rewards"
        subtitle="Everything your heroes have claimed with their coins — grant pending ones from the Review page"
      >
        {purchases.length === 0 ? (
          <EmptyNote>No treasures claimed yet.</EmptyNote>
        ) : (
          <div className="flex flex-col gap-2">
            {purchases.map((p) => {
              const granted = p.status === "granted";
              return (
                <div key={p.id} className="flex items-center gap-3 rounded-xl bg-black/25 px-4 py-3">
                  <Icon
                    name={granted ? "check" : "wrapped-gift"}
                    size={24}
                    art
                    muted
                    className="shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-display truncate text-sm font-bold">{p.reward_name}</p>
                    <p className="text-xs text-[var(--text-dim)]">
                      {p.profiles?.nickname ?? "A hero"} — {p.coins_spent} coins —{" "}
                      {new Date(p.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className="text-display shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase"
                    style={{
                      color: granted ? "var(--success)" : "var(--gold)",
                      background: "rgba(0,0,0,0.3)",
                    }}
                  >
                    {granted ? "Granted" : "To grant"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
