"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useWorld } from "@/components/ThemeProvider";
import { Portrait } from "@/components/Portrait";
import { Icon } from "@/components/Icon";
import { SectionCard, EmptyNote, AdminButton, pingAdminRefresh } from "@/components/admin/ui";
import { EASE_OUT } from "@/lib/motion";

interface PendingSubmission {
  id: string;
  task_id: string;
  image_path: string | null;
  ai_feedback: string | null;
  ai_verdict: {
    status?: string;
    reason?: string;
    confidence?: number;
    flags?: string[];
    model?: string;
  } | null;
  created_at: string;
  tasks: { id: string; title: string; task_type: string; coin_reward: number; xp_reward: number };
  profiles: { nickname: string; avatar: string; pet: string };
  signedUrl?: string;
}

interface PendingRedemption {
  id: string;
  reward_name: string;
  coins_spent: number;
  created_at: string;
  profiles: { nickname: string };
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function ReviewPage() {
  const { profile } = useWorld();
  const [subs, setSubs] = useState<PendingSubmission[]>([]);
  const [redemptions, setRedemptions] = useState<PendingRedemption[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const supabase = createClient();
    const [{ data: s }, { data: r }] = await Promise.all([
      supabase
        .from("submissions")
        .select(
          "id, task_id, image_path, ai_feedback, ai_verdict, created_at, tasks(id, title, task_type, coin_reward, xp_reward), profiles!submissions_child_id_fkey(nickname, avatar, pet)"
        )
        .eq("status", "needs_review")
        .order("created_at"),
      supabase
        .from("redemptions")
        .select("id, reward_name, coins_spent, created_at, profiles!redemptions_child_id_fkey(nickname)")
        .eq("status", "pending")
        .order("created_at"),
    ]);

    const withUrls = await Promise.all(
      ((s as unknown as PendingSubmission[]) ?? []).map(async (sub) => {
        if (!sub.image_path) return sub;
        const { data: signed } = await supabase.storage
          .from("proofs")
          .createSignedUrl(sub.image_path, 3600);
        return { ...sub, signedUrl: signed?.signedUrl };
      })
    );
    setSubs(withUrls);
    setRedemptions((r as unknown as PendingRedemption[]) ?? []);
  }, [profile]);

  useEffect(() => {
    load();
  }, [load]);

  /* Three outcomes:
     approve      → coins + XP awarded, task completed (parent authority)
     redo         → task reopens so the child can try again
     not_complete → submission rejected AND task closed (no redo) */
  async function decide(sub: PendingSubmission, action: "approve" | "redo" | "not_complete") {
    setBusy(sub.id);
    // clear the card immediately — the queue shrinks the instant you decide
    setSubs((list) => list.filter((x) => x.id !== sub.id));
    const supabase = createClient();
    if (action === "approve") {
      await supabase.rpc("award_submission", { p_submission_id: sub.id });
    } else if (action === "redo") {
      await supabase.rpc("reject_submission", {
        p_submission_id: sub.id,
        p_feedback: "Almost! Give it another go and send a new photo.",
      });
    } else {
      await supabase.rpc("reject_submission", {
        p_submission_id: sub.id,
        p_feedback: "This quest is closed for now — new adventures await!",
      });
      await supabase.from("tasks").update({ status: "rejected" }).eq("id", sub.task_id);
    }
    setBusy(null);
    pingAdminRefresh();
  }

  async function grant(r: PendingRedemption) {
    setRedemptions((list) => list.filter((x) => x.id !== r.id));
    const supabase = createClient();
    await supabase.from("redemptions").update({ status: "granted" }).eq("id", r.id);
    pingAdminRefresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2.5">
        <h1 className="text-display text-2xl font-black">Review Queue</h1>
        {subs.length > 0 && (
          <span
            className="text-display grid h-6 min-w-6 place-items-center rounded-full px-2 text-xs font-black text-white"
            style={{ background: "linear-gradient(160deg, var(--accent), var(--accent-deep))" }}
          >
            {subs.length}
          </span>
        )}
      </div>

      <SectionCard
        title="Proofs waiting for you"
        subtitle="The AI recommends — you decide. Nothing is awarded until you approve."
      >
        {subs.length === 0 ? (
          <EmptyNote>All caught up — nothing needs you right now.</EmptyNote>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <AnimatePresence initial={false} mode="popLayout">
            {subs.map((s) => {
              const v = s.ai_verdict;
              const confidence = typeof v?.confidence === "number" ? v.confidence : null;
              return (
                <motion.div
                  key={s.id}
                  layout
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25, ease: EASE_OUT }}
                  className="overflow-hidden rounded-xl bg-black/25"
                >
                  {s.signedUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.signedUrl} alt="proof" className="max-h-56 w-full object-cover" />
                  )}
                  <div className="p-4">
                    {/* child + task */}
                    <div className="flex items-center gap-2.5">
                      <Portrait species={s.profiles.pet} size={38} />
                      <div className="min-w-0 flex-1">
                        <p className="text-display truncate font-bold">{s.tasks.title}</p>
                        <p className="text-xs text-[var(--text-dim)]">
                          {s.profiles.nickname} — {s.tasks.task_type} — submitted {timeAgo(s.created_at)}
                        </p>
                      </div>
                      <span className="text-display shrink-0 rounded-lg bg-black/30 px-2.5 py-1 text-xs font-black text-[var(--gold)]">
                        +{s.tasks.coin_reward}c / +{s.tasks.xp_reward}xp
                      </span>
                    </div>

                    {/* AI panel */}
                    <div className="mt-3 rounded-lg bg-black/25 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="text-display flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-black uppercase tracking-wider"
                          style={{
                            color: v ? "var(--success)" : "var(--text-dim)",
                            background: "rgba(0,0,0,0.35)",
                          }}
                        >
                          <Icon art muted name={v ? "check" : s.image_path ? "eye" : "heart"} size={12} />
                          {v
                            ? "AI: looks acceptable"
                            : s.image_path
                              ? "AI: awaiting your judgment"
                              : "Hero's word — no photo for this quest"}
                        </span>
                        {confidence !== null && (
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-black/40">
                              <motion.div
                                className="h-full rounded-full"
                                style={{
                                  background:
                                    confidence >= 70
                                      ? "linear-gradient(90deg, var(--accent), var(--success))"
                                      : "linear-gradient(90deg, var(--danger), var(--gold))",
                                }}
                                initial={{ width: 0 }}
                                animate={{ width: `${confidence}%` }}
                                transition={{ duration: 0.7, delay: 0.2 }}
                              />
                            </div>
                            <span className="text-display text-xs font-black text-[var(--accent-2)]">
                              {confidence}%
                            </span>
                          </div>
                        )}
                      </div>
                      {(v?.reason || s.ai_feedback) && (
                        <p className="mt-2 text-xs leading-relaxed text-[var(--text-dim)]">
                          {v?.reason ?? s.ai_feedback}
                        </p>
                      )}
                      {v?.flags && v.flags.length > 0 && (
                        <p className="mt-1.5 text-[11px] font-bold text-[var(--gold)]">
                          Flags: {v.flags.join(", ")}
                        </p>
                      )}
                    </div>

                    {/* actions — Approve leads, the rest recede */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <AdminButton
                        className="flex-1"
                        disabled={busy === s.id}
                        onClick={() => decide(s, "approve")}
                      >
                        <Icon art muted name="check" size={16} /> Approve
                      </AdminButton>
                      <AdminButton
                        variant="subtle"
                        size="sm"
                        disabled={busy === s.id}
                        onClick={() => decide(s, "redo")}
                        title="Reopen so the child can try again"
                      >
                        <Icon name="refresh" size={14} /> Redo
                      </AdminButton>
                      <AdminButton
                        variant="danger"
                        size="sm"
                        disabled={busy === s.id}
                        onClick={() => decide(s, "not_complete")}
                        title="Close this quest without a reward"
                      >
                        <Icon art muted name="close" size={14} /> Not complete
                      </AdminButton>
                    </div>
                  </div>
                </motion.div>
              );
            })}
            </AnimatePresence>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Rewards to grant"
        subtitle="Coins already spent — mark granted once delivered in real life"
      >
        {redemptions.length === 0 ? (
          <EmptyNote>No claimed rewards waiting.</EmptyNote>
        ) : (
          <div className="flex flex-col gap-2">
            <AnimatePresence initial={false} mode="popLayout">
            {redemptions.map((r) => (
              <motion.div
                key={r.id}
                layout
                exit={{ opacity: 0, x: 24 }}
                transition={{ duration: 0.25, ease: EASE_OUT }}
                className="flex items-center gap-3 rounded-xl bg-black/25 px-4 py-3"
              >
                <Icon name="gift" size={34} art muted className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-display truncate text-sm font-bold">{r.reward_name}</p>
                  <p className="text-xs text-[var(--text-dim)]">
                    {r.profiles.nickname} — {r.coins_spent} coins — {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
                <AdminButton size="sm" onClick={() => grant(r)}>
                  <Icon art muted name="check" size={14} /> Mark granted
                </AdminButton>
              </motion.div>
            ))}
            </AnimatePresence>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
