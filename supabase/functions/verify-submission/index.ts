import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

interface Verdict {
  status: "approved" | "redo_requested" | "pending_parent_review";
  confidence: number; // 0-100, informational only — never used as a threshold
  reason: string;
  childMessage: string;
  flags: string[];
}

/* Two operating modes, chosen by the quest's verifier:
   - ai_parent / legacy: the AI only RECOMMENDS (2-way verdict) and the parent
     always makes the final call. Unchanged behavior.
   - ai (AI-only, parent chose to delegate): 3-way verdict — a clear pass
     auto-completes through award_submission, a clear fail asks for a retry,
     and ANY uncertainty still goes to the parent queue. */
const SHARED_RULES = `THE STANDARD IS A CHILD'S EFFORT, NOT ADULT PERFECTION:
- These are children roughly 5-12 years old doing their own real-life tasks. Judge the way a warm, encouraging parent would judge a child's genuine attempt.
- A made bed counts even if the blanket is wrinkled, corners are uneven, or a pillow sits crooked — pulled-up covers and pillows roughly in place IS a made bed for a child.
- Tidied rooms may still have a few things out of place; handwriting may be messy; results may be imperfect. Visible genuine effort at the task satisfies the task.
- Only treat a submission as unsatisfactory when the task clearly was NOT attempted (e.g. the bed is plainly unmade, the photo shows something unrelated) — never because the result falls short of an adult's standard.

Other rules:
- reason: written for the parent — say what you saw that supports your recommendation (e.g. "The visible worksheet shows all questions answered" or "The photo shows a bookshelf, not the bed described in the task"). Do not describe the image beyond task-relevant evidence and never identify any person.
- childMessage: max 2 short sentences, warm, kind and kid-friendly, no emojis. For a redo, use gentle "give it another try" energy — never scold. For parent review, tell them a grown-up will take a look soon.
- flags: short strings for anything a parent should know (e.g. "possibly_reused_photo", "image_unclear"), else [].`;

const REVIEW_PROMPT = `You review proof photos submitted by children in a family quest app (homework, room cleaning, toy cleanup, reading/writing, chores).

You make a RECOMMENDATION only. A parent always makes the final decision, awards the coins, and completes the task — never say the task is approved, finished, or rewarded.

Respond with JSON ONLY — no markdown, no code fences, no extra text. Exact schema:
{
  "status": "redo_requested" | "pending_parent_review",
  "confidence": 0-100,
  "reason": "one or two concise sentences explaining WHY you recommend this",
  "childMessage": "positive encouraging message for the child",
  "flags": []
}

How to choose the status — judge the actual evidence, not a score:
- "redo_requested": ONLY when you are highly confident the submission genuinely does not satisfy the task — clearly incorrect, clearly incomplete, unrelated to the task, apparently fake or reused, or too blurry to show anything relevant. If you can articulate exactly what is wrong, this is the right choice.
- "pending_parent_review": everything else — the proof looks acceptable, the task appears complete, or you are uncertain in ANY way. Uncertainty always goes to the parent, never to a redo.

${SHARED_RULES}`;

const AUTONOMOUS_PROMPT = `You verify proof photos submitted by children in a family quest app (homework, room cleaning, toy cleanup, reading/writing, chores). For THIS quest the parent has delegated verification to you: a clear pass completes the quest and awards the rewards.

Respond with JSON ONLY — no markdown, no code fences, no extra text. Exact schema:
{
  "status": "approved" | "redo_requested" | "pending_parent_review",
  "confidence": 0-100,
  "reason": "one or two concise sentences explaining WHY you chose this",
  "childMessage": "positive encouraging message for the child",
  "flags": []
}

How to choose the status — judge the actual evidence, not a score:
- "approved": ONLY when you are highly confident the photo genuinely shows the task complete — the evidence is clear, relevant, and convincing. This awards the child immediately, so when in ANY doubt do not choose it.
- "redo_requested": ONLY when you are highly confident the submission genuinely does not satisfy the task — clearly incorrect, clearly incomplete, unrelated to the task, apparently fake or reused, or too blurry to show anything relevant.
- "pending_parent_review": everything in between — plausible but not fully convincing, partially complete, or uncertain in any way. Uncertainty always goes to a parent, never to an approval or a redo.

${SHARED_RULES}
- For an approval, childMessage should celebrate the accomplishment.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Identify caller (child submitting proof)
    const caller = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
    });
    const { data: userData } = await caller.auth.getUser();
    if (!userData?.user) return json({ error: "not authenticated" }, 401);

    const { submission_id } = await req.json();
    const { data: sub } = await admin
      .from("submissions")
      .select("*, tasks(*)")
      .eq("id", submission_id)
      .single();
    if (!sub) return json({ error: "submission not found" }, 404);
    if (sub.child_id !== userData.user.id) return json({ error: "not your submission" }, 403);
    if (sub.status !== "pending") return json({ error: "already processed", status: sub.status }, 400);

    const task = sub.tasks;
    // AI-only quests (parent delegated verification): a clear pass auto-awards.
    const aiOnly = task.verifier === "ai";

    const needsReview = async (feedback: string, verdict: unknown = null) => {
      await admin.from("submissions").update({
        status: "needs_review", ai_feedback: feedback, ai_verdict: verdict,
      }).eq("id", submission_id);
      await admin.from("tasks").update({ status: "needs_review" }).eq("id", task.id);
      return json({ outcome: "needs_review", feedback });
    };

    // AI provider config — key lives ONLY in edge function secrets
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    const provider = (Deno.env.get("AI_PROVIDER") || "openrouter").toLowerCase();
    if (!apiKey || provider !== "openrouter") {
      return await needsReview("A grown-up will check your quest soon. Great job sending it in!");
    }

    // Default: Qwen 2.5 VL 72B — vision-capable, strong at reading worksheets
    // and handwriting and at judging room/bed/toy/chore photos.
    const DEFAULT_MODEL = "qwen/qwen2.5-vl-72b-instruct";
    // Vision-capable fallbacks if the default is unavailable — proof checking
    // requires image understanding, so the chain never contains a text-only model.
    const VISION_FALLBACKS = [
      "qwen/qwen2.5-vl-72b-instruct:free",
      "google/gemma-3-27b-it:free",
      "meta-llama/llama-3.2-90b-vision-instruct:free",
    ];
    // AI_MODEL may name one model or a comma-separated priority list; the vision
    // fallbacks are always appended (deduplicated).
    const configured = (Deno.env.get("AI_MODEL") || DEFAULT_MODEL)
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    const modelChain = [...new Set([...configured, ...VISION_FALLBACKS])];

    // Download the proof image and build a data URL
    const { data: file, error: dlErr } = await admin.storage.from("proofs").download(sub.image_path);
    if (dlErr || !file) {
      return await needsReview("We could not read your photo, so a grown-up will take a look!");
    }
    const buf = new Uint8Array(await file.arrayBuffer());
    let b64 = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      b64 += String.fromCharCode(...buf.subarray(i, i + chunk));
    }
    b64 = btoa(b64);
    const ext = sub.image_path.split(".").pop()?.toLowerCase();
    const mediaType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg";

    const isHomework = task.task_type === "homework";
    const userText = [
      `Task title: ${task.title}`,
      `Task description: ${task.description || "(none)"}`,
      `Task type: ${task.task_type}`,
      isHomework
        ? "This is homework: check whether the visible work appears completed. If questions look unanswered or the work looks incomplete, prefer pending_parent_review over redo_requested."
        : "Judge whether the photo reasonably shows this task was done (e.g. a made bed, a tidy room, a book being read).",
      "Return the JSON recommendation now.",
    ].join("\n");

    // OpenRouter's OpenAI-compatible multimodal format: the user message content
    // is an array of one text part and one image_url part (data URL).
    const messages = [
      { role: "system", content: aiOnly ? AUTONOMOUS_PROMPT : REVIEW_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: userText },
          { type: "image_url", image_url: { url: `data:${mediaType};base64,${b64}` } },
        ],
      },
    ];

    // Try each vision model in priority order; move on when a model is
    // unavailable, rate-limited, errors, or returns unusable output.
    async function tryModel(model: string): Promise<Verdict | null> {
      try {
        const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://kidsquest.app",
            "X-Title": "Questforge",
          },
          body: JSON.stringify({ model, temperature: 0.2, max_tokens: 600, messages }),
        });
        if (!resp.ok) {
          console.warn(`model ${model} failed: ${resp.status} ${await resp.text()}`);
          return null;
        }
        const data = await resp.json();
        let content: string = data.choices?.[0]?.message?.content ?? "";
        // strip code fences if the model added them despite instructions
        content = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
        const start = content.indexOf("{");
        const end = content.lastIndexOf("}");
        if (start === -1 || end === -1) return null;
        const parsed = JSON.parse(content.slice(start, end + 1));
        const allowed = aiOnly
          ? ["approved", "redo_requested", "pending_parent_review"]
          : ["redo_requested", "pending_parent_review"];
        if (!allowed.includes(parsed.status)) {
          return null;
        }
        return {
          status: parsed.status,
          confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)),
          reason: String(parsed.reason ?? "").slice(0, 400),
          childMessage: String(parsed.childMessage ?? "").slice(0, 300),
          flags: Array.isArray(parsed.flags) ? parsed.flags.map(String).slice(0, 8) : [],
        };
      } catch (e) {
        console.warn(`model ${model} threw: ${e}`);
        return null;
      }
    }

    let verdict: Verdict | null = null;
    let servedBy: string | null = null;
    for (const model of modelChain) {
      verdict = await tryModel(model);
      if (verdict) {
        servedBy = model;
        break;
      }
    }
    if (!verdict) {
      // No vision model available right now → final fallback: parent review
      return await needsReview("The magic scanner is resting, so a grown-up will check your quest!");
    }
    const storedVerdict = { ...verdict, model: servedBy };

    // AI-only quests: a clear pass completes the quest through the exact same
    // award_submission pipeline the parent uses — rewards, companion growth,
    // challenge scoring and achievements all flow identically. Anything less
    // than a clear pass never auto-awards.
    if (verdict.status === "approved" && aiOnly) {
      await admin.from("submissions").update({
        ai_verdict: storedVerdict, ai_confidence: verdict.confidence,
      }).eq("id", submission_id);
      const { data: award, error: awardErr } = await admin.rpc("award_submission", {
        p_submission_id: submission_id,
        p_feedback: verdict.childMessage,
      });
      if (awardErr) {
        console.warn(`auto-award failed: ${awardErr.message}`);
        return await needsReview(
          verdict.childMessage || "A grown-up will take a look at this one!",
          storedVerdict
        );
      }
      // Privacy: award_submission already cleared the DB pointer — delete the
      // actual Storage file using the path it hands back.
      const purgedPath = (award as { purged_path?: string } | null)?.purged_path;
      if (purgedPath) {
        const { error: rmErr } = await admin.storage.from("proofs").remove([purgedPath]);
        if (rmErr) console.warn(`media purge failed: ${rmErr.message}`);
      }
      return json({
        outcome: "auto_approved",
        feedback: verdict.childMessage,
        award,
        verdict,
      });
    }

    // No thresholds: the model's recommendation decides the route.
    // Below this point the AI never awards coins and never completes tasks —
    // only the parent does, from the review queue.
    if (verdict.status === "redo_requested") {
      await admin.from("submissions").update({
        status: "rejected", ai_verdict: storedVerdict, ai_feedback: verdict.childMessage, ai_confidence: verdict.confidence,
      }).eq("id", submission_id);
      await admin.from("tasks").update({ status: "active" }).eq("id", task.id);
      return json({ outcome: "try_again", feedback: verdict.childMessage, verdict });
    }

    // pending_parent_review — the parent is the final authority
    await admin.from("submissions").update({
      ai_confidence: verdict.confidence,
    }).eq("id", submission_id);
    return await needsReview(
      verdict.childMessage || "A grown-up will take a look at this one!",
      storedVerdict
    );
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
