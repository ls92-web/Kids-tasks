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

  // voice evidence — a little tape recorder for the hero
  const [recState, setRecState] = useState<"idle" | "recording" | "recorded">("idle");
  const [recSeconds, setRecSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [micError, setMicError] = useState(false);
  const [sending, setSending] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // release the microphone and timers if the hero navigates away
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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

  // ---- voice recorder (voice evidence is parent-verified; no AI on audio) ----
  function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  async function startRecording() {
    setMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setRecState("recorded");
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      recorderRef.current = rec;
      rec.start();
      setRecSeconds(0);
      setRecState("recording");
      timerRef.current = setInterval(() => {
        setRecSeconds((s) => {
          if (s + 1 >= 60) stopRecording(); // one minute is plenty of magic
          return s + 1;
        });
      }, 1000);
    } catch (e) {
      console.warn("microphone unavailable", e);
      setMicError(true);
    }
  }

  function discardRecording() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecState("idle");
    setRecSeconds(0);
  }

  async function submitVoice() {
    if (!audioBlob || !task || !profile || sending) return;
    setSending(true);
    setMessage(null);
    const supabase = createClient();
    try {
      const audioExt = audioBlob.type.includes("mp4") ? "m4a" : "webm";
      const path = `${profile.id}/${task.id}-${Date.now()}.${audioExt}`;
      const { error: upErr } = await supabase.storage
        .from("proofs")
        .upload(path, audioBlob, { contentType: audioBlob.type || "audio/webm" });
      if (upErr) throw upErr;
      const { error: subErr } = await supabase.from("submissions").insert({
        task_id: task.id,
        child_id: profile.id,
        family_id: profile.family_id,
        image_path: path,
        status: "needs_review",
      });
      if (subErr) throw subErr;
      await supabase.from("tasks").update({ status: "needs_review" }).eq("id", task.id);
      setTask({ ...task, status: "needs_review" });
      setMessage({ tone: "info", text: "Your voice message flew to your grown-up. Great work!" });
    } catch (e) {
      setMessage({ tone: "bad", text: "Something interrupted the magic. Please try again." });
      console.error(e);
    } finally {
      setSending(false);
    }
  }

  /* No-evidence quests ONLY (parent verification): the hero taps "I did it!"
     and the quest goes straight to the parent review queue. Photo and voice
     quests can never submit without their proof — the guard here plus a
     database trigger both enforce it. */
  async function submitWord() {
    if (evidence !== "none") return;
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

      // AI-only quests may auto-complete on a clear pass; the full ceremony
      // plays on the Adventure board (the fresh-victory celebration).
      if (result.outcome === "auto_approved") {
        setTask({ ...task, status: "completed" });
        setMessage({
          tone: "info",
          text:
            result.feedback ||
            `The ${theme.verifyTitle} approved it — rewards earned. Amazing work!`,
        });
        return;
      }

      // Otherwise the AI only recommends — a parent always makes the final
      // call, so the outcome here is either "try again" or "sent to the council".
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
              <Icon art key={i} name="star" size={16} filled className="text-[var(--gold)]" />
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
          <Fact icon="xp" label="XP" value={`+${task.xp_reward}`} accent />
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

      {canSubmit && evidence === "none" && (
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
            No photo needed — your word goes straight to your grown-up.
          </p>
          <GameButton variant="gold" className="mt-4" onClick={submitWord}>
            I did it!
          </GameButton>
        </motion.div>
      )}

      {canSubmit && evidence === "voice" && (
        <motion.div
          {...enter}
          transition={{ ...enter.transition, delay: 0.08 }}
          className="panel p-6 text-center"
        >
          <h2 className="text-display mb-1 flex items-center justify-center gap-2 text-lg font-black">
            <Icon name="mic" size={22} />
            Tell us all about it!
          </h2>
          <p className="mx-auto max-w-sm text-sm text-[var(--text-dim)]">
            Record a voice message for your grown-up — they love hearing it from you.
          </p>

          {micError && (
            <p className="mx-auto mt-3 max-w-sm rounded-lg bg-black/25 px-3 py-2 text-xs font-semibold text-[var(--gold)]">
              We couldn&apos;t reach your microphone. Check that it&apos;s plugged in and allowed,
              then try again — or ask your grown-up for help.
            </p>
          )}

          {recState === "idle" && (
            <GameButton
              variant="gold"
              className="mt-4"
              onClick={() => {
                setMicError(false);
                startRecording();
              }}
            >
              {micError ? "Try again" : "Start recording"}
            </GameButton>
          )}

          {recState === "recording" && (
            <div className="mt-4 flex flex-col items-center gap-3">
              <div className="flex items-center gap-2.5">
                <span className="h-3 w-3 animate-pulse rounded-full bg-[var(--danger)]" />
                <span className="text-display text-2xl font-black tabular-nums">
                  0:{String(recSeconds).padStart(2, "0")}
                </span>
              </div>
              <p className="text-xs text-[var(--text-dim)]">Listening… up to one minute</p>
              <GameButton onClick={stopRecording}>
                <Icon name="stop" size={16} className="mr-1 inline" /> Stop
              </GameButton>
            </div>
          )}

          {recState === "recorded" && audioUrl && (
            <div className="mt-4 flex flex-col items-center gap-4">
              <audio controls src={audioUrl} className="w-full max-w-sm" />
              <div className="flex gap-3">
                <GameButton variant="ghost" onClick={discardRecording} disabled={sending}>
                  Record again
                </GameButton>
                <GameButton variant="gold" onClick={submitVoice} disabled={sending}>
                  {sending ? "Sending…" : "Send to your grown-up"}
                </GameButton>
              </div>
            </div>
          )}
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
        <Icon art name={icon} size={16} /> {label}
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
