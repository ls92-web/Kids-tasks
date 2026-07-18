"use client";

import { useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useWorld } from "@/components/ThemeProvider";
import { Icon } from "@/components/Icon";
import { GameButton } from "@/components/GameButton";
import { VerifyOverlay } from "@/components/VerifyOverlay";
import { MagicLoader } from "@/components/MagicLoader";
import { Callout } from "@/components/Callout";
import { enter } from "@/lib/motion";
import { DIFFICULTY, Task } from "@/lib/game";

export default function QuestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { theme, profile } = useWorld();
  const [task, setTask] = useState<Task | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "bad"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("tasks")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }) => setTask(data as Task));
  }, [id]);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setMessage(null);
  }

  // Confirmation method (null on both = legacy: photo + AI pre-screen + parent)
  const evidence = task?.evidence ?? "photo";
  const verifier = task?.verifier ?? "ai_parent";
  const aiInvolved = verifier === "ai" || verifier === "ai_parent";

  /* No-evidence quests (parent verification): the hero taps "I did it!" and
     the quest goes straight to the parent review queue. Voice quests use the
     same path until the voice recorder ships (slice 4). */
  async function submitWord() {
    if (!task || !profile) return;
    setMessage(null);
    const supabase = createClient();
    try {
      const { error: subErr } = await supabase.from("submissions").insert({
        task_id: task.id,
        child_id: profile.id,
        family_id: profile.family_id,
        image_path: null,
        status: "needs_review",
      });
      if (subErr) throw subErr;
      await supabase.from("tasks").update({ status: "needs_review" }).eq("id", task.id);
      setTask({ ...task, status: "needs_review" });
      setMessage({
        tone: "info",
        text: "Sent straight to your grown-up. Great work!",
      });
    } catch (e) {
      setMessage({ tone: "bad", text: "Something interrupted the magic. Please try again." });
      console.error(e);
    }
  }

  async function submitProof() {
    if (!file || !task || !profile) return;
    if (aiInvolved) setVerifying(true);
    setMessage(null);
    const supabase = createClient();
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${profile.id}/${task.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("proofs").upload(path, file);
      if (upErr) throw upErr;

      const { data: sub, error: subErr } = await supabase
        .from("submissions")
        .insert({
          task_id: task.id,
          child_id: profile.id,
          family_id: profile.family_id,
          image_path: path,
          // parent-only photo quests skip the AI and go straight to review
          ...(aiInvolved ? {} : { status: "needs_review" }),
        })
        .select()
        .single();
      if (subErr) throw subErr;

      if (!aiInvolved) {
        await supabase.from("tasks").update({ status: "needs_review" }).eq("id", task.id);
        setTask({ ...task, status: "needs_review" });
        setMessage({
          tone: "info",
          text: "Your photo flew straight to your grown-up. Great work!",
        });
        return;
      }

      await supabase.from("tasks").update({ status: "submitted" }).eq("id", task.id);

      const { data: result, error: fnErr } = await supabase.functions.invoke(
        "verify-submission",
        { body: { submission_id: sub.id } }
      );
      if (fnErr) throw fnErr;

      // minimum ceremony time so the scan feels real
      await new Promise((r) => setTimeout(r, 2400));
      setVerifying(false);

      // The AI only recommends — a parent always makes the final call, so the
      // outcome here is either "try again" or "sent to the council".
      if (result.outcome === "try_again") {
        setTask({ ...task, status: "active" });
        setMessage({
          tone: "bad",
          text: result.feedback || "Hmm, that photo did not quite match. Try again!",
        });
        setFile(null);
        setPreviewUrl(null);
      } else {
        setTask({ ...task, status: "needs_review" });
        setMessage({
          tone: "info",
          text:
            result.feedback ||
            "Your proof was sent to the council. A grown-up will check it soon!",
        });
      }
    } catch (e) {
      setVerifying(false);
      setMessage({
        tone: "bad",
        text: "Something interrupted the magic. Please try again.",
      });
      console.error(e);
    }
  }

  if (!task) {
    return <MagicLoader label="Unrolling your quest…" />;
  }

  const diff = DIFFICULTY[task.difficulty] ?? DIFFICULTY.easy;
  const canSubmit = task.status === "active" || task.status === "rejected";
  const waiting = task.status === "submitted" || task.status === "needs_review";

  return (
    <div className="flex flex-col gap-6">
      <button
        onClick={() => router.push("/app")}
        className="text-display flex w-fit cursor-pointer items-center gap-1.5 text-sm font-bold text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
      >
        <Icon name="arrowLeft" size={16} /> {theme.questWord} Board
      </button>

      <motion.div {...enter} className="panel panel-glow relative overflow-hidden p-6">
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: diff.color, boxShadow: `0 0 16px ${diff.color}` }}
        />
        <div className="flex items-center gap-2">
          <span
            className="text-display rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider"
            style={{ color: diff.color, background: "rgba(0,0,0,0.3)" }}
          >
            {diff.label}
          </span>
          <span className="flex gap-0.5">
            {Array.from({ length: diff.stars }).map((_, i) => (
              <Icon art key={i} name="star" size={13} filled className="text-[var(--gold)]" />
            ))}
          </span>
        </div>
        <h1 className="text-display mt-2 text-3xl font-black">{task.title}</h1>
        {task.description && (
          <p className="mt-2 text-[15px] text-[var(--text-dim)]">{task.description}</p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact icon="clock" label="Time" value={`${task.est_minutes} min`} />
          <Fact
            icon="flame"
            label="Finish by"
            value={
              task.deadline
                ? new Date(task.deadline).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })
                : "Anytime"
            }
          />
          <Fact icon="coin" label={theme.coinName} value={`+${task.coin_reward}`} gold />
          <Fact icon="lightning" label="XP" value={`+${task.xp_reward}`} accent />
        </div>
      </motion.div>

      {message && (
        <Callout tone={message.tone === "bad" ? "error" : "info"}>{message.text}</Callout>
      )}

      {waiting && !message && (
        <div className="panel p-5 text-center">
          <Icon name="eye" size={28} art className="mx-auto" />
          <p className="text-display mt-2 font-bold">
            {task.status === "submitted"
              ? "The scan is underway…"
              : "The council of grown-ups is reviewing your proof."}
          </p>
        </div>
      )}

      {task.status === "completed" && (
        <div className="panel p-6 text-center">
          <Icon name="trophy" size={44} art className="mx-auto" />
          <p className="text-display mt-2 text-xl font-black text-[var(--success)]">
            {theme.questWord} conquered
          </p>
        </div>
      )}

      {canSubmit && evidence === "photo" && (
        <motion.div
          {...enter}
          transition={{ ...enter.transition, delay: 0.08 }}
          className="panel p-6"
        >
          <h2 className="text-display mb-3 flex items-center gap-2 text-lg font-black">
            <Icon name="camera" size={22} art />
            Show us what you did!
          </h2>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={pick}
          />

          {previewUrl ? (
            <div className="flex flex-col items-center gap-4">
              <div
                className="w-[min(80vw,320px)] overflow-hidden rounded-2xl"
                style={{ boxShadow: "0 0 0 2px var(--surface-border), 0 0 40px -8px var(--glow)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="your proof" className="block w-full" />
              </div>
              <div className="flex gap-3">
                <GameButton variant="ghost" onClick={() => fileRef.current?.click()}>
                  New photo
                </GameButton>
                <GameButton variant="gold" onClick={submitProof}>
                  {aiInvolved ? `Send to the ${theme.verifyTitle}` : "Send to your grown-up"}
                </GameButton>
              </div>
            </div>
          ) : (
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => fileRef.current?.click()}
              className="grid w-full cursor-pointer place-items-center gap-2 rounded-2xl border-2 border-dashed border-[var(--surface-border)] bg-black/25 py-10 transition-colors hover:border-[var(--accent)]"
            >
              <Icon name="camera" size={34} art />
              <span className="text-display font-bold text-[var(--text-dim)]">
                Snap or choose a photo
              </span>
            </motion.button>
          )}
        </motion.div>
      )}

      {canSubmit && evidence !== "photo" && (
        <motion.div
          {...enter}
          transition={{ ...enter.transition, delay: 0.08 }}
          className="panel p-6 text-center"
        >
          <h2 className="text-display mb-1 flex items-center justify-center gap-2 text-lg font-black">
            <Icon name="check" size={22} art />
            Done with this {theme.questWord.toLowerCase()}?
          </h2>
          <p className="mx-auto max-w-sm text-sm text-[var(--text-dim)]">
            {evidence === "voice"
              ? "Tell your grown-up all about it — voice recording is coming soon!"
              : "No photo needed — your word goes straight to your grown-up."}
          </p>
          <GameButton variant="gold" className="mt-4" onClick={submitWord}>
            I did it!
          </GameButton>
        </motion.div>
      )}

      <VerifyOverlay imageUrl={previewUrl} active={verifying} />
    </div>
  );
}

function Fact({
  icon,
  label,
  value,
  gold,
  accent,
}: {
  icon: string;
  label: string;
  value: string;
  gold?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl bg-black/25 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
        <Icon art name={icon} size={12} /> {label}
      </div>
      <div
        className="text-display mt-0.5 text-lg font-black"
        style={{ color: gold ? "var(--gold)" : accent ? "var(--accent-2)" : "var(--text)" }}
      >
        {value}
      </div>
    </div>
  );
}
