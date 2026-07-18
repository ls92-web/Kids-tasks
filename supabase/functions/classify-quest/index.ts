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

/* The AI Quest Assistant (Developer Guide v1.0): classifies a parent-written
   custom quest against the Official Quest Library and recommends every field.
   The AI only RECOMMENDS — the parent edits everything before assigning, and
   the economy numbers are computed deterministically server-side from the
   recommended Time x Effort (never by the model). */

// Official Quest Library v1.0 — name | pillar | category | task_type | time | effort | schedule | verification
const CATALOG = `Perform Prayer | faith | Faith | prayer | short | high | up-to-5-daily | Parent Confirmation
Read Quran | faith | Faith | quran | medium | high | daily | Parent Confirmation + voice record
Memorize Quran | faith | Faith | quran | medium | high | weekly | Parent Confirmation
Morning Adhkar | faith | Faith | habit | short | moderate | daily | Parent Confirmation + voice record
Evening Adhkar | faith | Faith | habit | short | moderate | daily | Parent Confirmation + voice record
Learn a New Dua | faith | Faith | habit | short | moderate | weekly | Parent Confirmation
Learn an Islamic Story | faith | Faith | habit | medium | moderate | weekly | Parent Confirmation
Practice Good Manners | faith | Faith | habit | medium | high | daily | Parent Observation
Attend Friday Prayer | faith | Faith | habit | medium | high | weekly | Parent Confirmation
Pray at the Mosque | faith | Faith | habit | medium | moderate | optional | Parent Confirmation
Practice Gratitude | faith | Faith | habit | short | moderate | daily | Parent Conversation
Give Charity | faith | Faith | habit | short | moderate | optional | Parent Confirmation
Complete Homework | learning | School | homework | long | high | school | Parent Confirmation + photo
Read a Book | learning | Reading | reading | medium | moderate | daily | Parent Confirmation + summary
Practice Mathematics | learning | School | homework | medium | high | school | Parent Confirmation
Practice Writing | learning | School | homework | medium | moderate | weekly | Parent Confirmation + photo
Practice Spelling | learning | School | homework | short | moderate | school | Parent Confirmation
Learn New Vocabulary | learning | Language | homework | short | moderate | weekly | Parent Confirmation
Practice English | learning | Language | homework | medium | high | weekly | Parent Confirmation
Science Activity | learning | STEM | other | medium | moderate | weekly | Photo or Parent
Educational Puzzle | learning | Learning | other | short | low | optional | Parent Confirmation
Creative Drawing | learning | Creativity | other | medium | moderate | weekly | Photo
Educational Project | learning | Project | other | epic | exceptional | optional | Photo + Parent
Make Bed | responsibility | Household | chore | short | moderate | daily | Parent Confirmation + photo
Organize Bedroom | responsibility | Household | chore | medium | high | weekly | Photo + Parent
Put Toys Away | responsibility | Household | chore | short | moderate | daily | Parent Confirmation + photo
Organize School Bag | responsibility | School | chore | short | moderate | school | Parent Confirmation
Fold Clothes | responsibility | Household | chore | medium | moderate | weekly | Parent Confirmation
Put Dirty Clothes in Laundry | responsibility | Household | chore | tiny | low | daily | Parent Confirmation
Help Set the Table | responsibility | Household | chore | short | moderate | daily | Parent Confirmation
Clear the Table | responsibility | Household | chore | short | moderate | daily | Parent Confirmation
Water Plants | responsibility | Household | chore | short | low | weekly | Parent Confirmation
Feed a Pet | responsibility | Animals | chore | short | moderate | daily | Parent Confirmation
Keep Personal Space Clean | responsibility | Household | chore | medium | high | weekly | Photo or Parent
Brush Teeth | wellbeing | Hygiene | habit | short | moderate | morning-evening | Parent Confirmation + photo
Take a Shower | wellbeing | Hygiene | habit | medium | moderate | daily | Parent Confirmation
Wash Hands | wellbeing | Hygiene | habit | tiny | low | daily | Parent Confirmation
Drink Water | wellbeing | Health | habit | tiny | low | daily | Parent Confirmation
Eat a Healthy Meal | wellbeing | Nutrition | habit | medium | moderate | daily | Parent Confirmation
Eat Fruits or Vegetables | wellbeing | Nutrition | habit | tiny | low | daily | Parent Confirmation
Exercise | wellbeing | Exercise | habit | medium | high | daily | Parent Confirmation
Sleep on Time | wellbeing | Health | habit | long | high | daily | Parent Confirmation
Stretching | wellbeing | Exercise | habit | short | moderate | daily | Parent Confirmation
Outdoor Play | wellbeing | Exercise | habit | long | moderate | daily | Parent Confirmation
Help a Parent | character | Character | habit | medium | high | daily | Parent Confirmation
Help a Sibling | character | Character | habit | medium | moderate | daily | Parent Confirmation
Say Thank You | character | Character | habit | tiny | low | daily | Parent Confirmation
Use Kind Words | character | Character | habit | medium | moderate | daily | Parent Confirmation
Apologize Sincerely | character | Character | habit | short | high | optional | Parent Confirmation
Share with Others | character | Character | habit | medium | moderate | weekly | Parent Confirmation
Tell the Truth | character | Character | habit | medium | high | daily | Parent Confirmation
Complete a Kind Act | character | Character | habit | medium | moderate | weekly | Parent Confirmation
Family Reading Time | family | Family | reading | long | moderate | weekly | Parent Confirmation
Family Board Game | family | Family | other | long | moderate | weekly | Parent Confirmation
Family Walk | family | Family | other | long | moderate | weekly | Parent Confirmation
Cook Together | family | Family | other | long | high | weekly | Parent Confirmation
Family Clean-Up | family | Family | chore | long | high | monthly | Parent Confirmation
Visit Grandparents | family | Family | other | long | moderate | monthly | Parent Confirmation
Call a Relative | family | Family | other | short | low | weekly | Parent Confirmation
Family Conversation Time | family | Family | other | medium | moderate | weekly | Parent Confirmation`;

const TASK_TYPES = ["chore", "homework", "reading", "prayer", "quran", "habit", "other"];
const PILLARS = ["faith", "learning", "responsibility", "wellbeing", "character", "family"];
const TIMES = ["tiny", "short", "medium", "long", "epic"];
const EFFORTS = ["low", "moderate", "high", "exceptional"];
const SCHEDULES = ["daily", "school", "weekly", "morning-evening", "up-to-5-daily", "monthly", "optional"];

// Deterministic economy: Time x Effort -> difficulty -> coins/XP/minutes.
// Mirrors profileDifficulty() + DIFF_DEFAULTS in the app.
const TIME_W: Record<string, number> = { tiny: 0, short: 1, medium: 2, long: 3, epic: 4 };
const EFFORT_W: Record<string, number> = { low: 0, moderate: 1, high: 2, exceptional: 3 };
const DIFF_DEFAULTS: Record<string, { coins: number; xp: number; minutes: number }> = {
  easy: { coins: 10, xp: 20, minutes: 10 },
  medium: { coins: 20, xp: 45, minutes: 20 },
  hard: { coins: 40, xp: 90, minutes: 40 },
  epic: { coins: 80, xp: 180, minutes: 60 },
};
function difficultyFor(time: string, effort: string): string {
  const s = (TIME_W[time] ?? 1) + (EFFORT_W[effort] ?? 1);
  if (s >= 7) return "epic";
  if (s >= 5) return "hard";
  if (s >= 3) return "medium";
  return "easy";
}

const SYSTEM_PROMPT = `You classify quests for WonderNest, a family habit-building adventure app for children aged 5-12. A parent typed a custom quest; match it to the closest Official Quest Profile and recommend how to configure it.

The Official Quest Library (name | pillar | category | task_type | time | effort | schedule | verification):
${CATALOG}

Respond with JSON ONLY — no markdown, no code fences. Exact schema:
{
  "match": "<the closest Official Quest name from the list above, or null if nothing is close>",
  "task_type": one of ${JSON.stringify(TASK_TYPES)},
  "pillar": one of ${JSON.stringify(PILLARS)} or null,
  "category": "<one or two words, e.g. Household, Hygiene, School>",
  "time_class": one of ${JSON.stringify(TIMES)},
  "effort_class": one of ${JSON.stringify(EFFORTS)},
  "schedule": one of ${JSON.stringify(SCHEDULES)},
  "verification": "<short recommendation, e.g. Parent Confirmation + photo>",
  "reason": "<one short sentence for the parent explaining the classification>"
}

Rules:
- Judge by meaning, not exact words (any language). e.g. "sort the laundry" is a Household chore like "Fold Clothes".
- If the quest closely matches an official profile, copy that profile's classification.
- schedule: "daily" for everyday habits, "school" for school-day work, "weekly" for weekly activities, "optional" for one-off quests.
- Never invent new categories of app behavior; only fill the schema.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // caller must be an authenticated parent — AI assists quest creation only
    const caller = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization")! } },
    });
    const { data: userData } = await caller.auth.getUser();
    if (!userData?.user) return json({ error: "not authenticated" }, 401);
    const { data: prof } = await admin
      .from("profiles").select("role").eq("id", userData.user.id).single();
    if (prof?.role !== "parent") return json({ error: "parents only" }, 403);

    const { title, description } = await req.json();
    if (!title || String(title).trim().length < 3) return json({ error: "title too short" }, 400);

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) return json({ error: "assistant unavailable" }, 503);

    const DEFAULT_MODEL = "qwen/qwen-2.5-72b-instruct";
    const FALLBACKS = [
      "qwen/qwen-2.5-72b-instruct:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "google/gemma-3-27b-it:free",
    ];
    const configured = (Deno.env.get("AI_CLASSIFY_MODEL") || DEFAULT_MODEL)
      .split(",").map((m) => m.trim()).filter(Boolean);
    const modelChain = [...new Set([...configured, ...FALLBACKS])];

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Quest title: ${String(title).slice(0, 200)}\nQuest description: ${String(description || "(none)").slice(0, 500)}\nReturn the JSON now.`,
      },
    ];

    async function tryModel(model: string) {
      try {
        const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://kidsquest.app",
            "X-Title": "WonderNest",
          },
          body: JSON.stringify({ model, temperature: 0.1, max_tokens: 400, messages }),
        });
        if (!resp.ok) {
          console.warn(`model ${model} failed: ${resp.status}`);
          return null;
        }
        const data = await resp.json();
        let content: string = data.choices?.[0]?.message?.content ?? "";
        content = content.trim().replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "");
        const start = content.indexOf("{");
        const end = content.lastIndexOf("}");
        if (start === -1 || end === -1) return null;
        const parsed = JSON.parse(content.slice(start, end + 1));
        if (!TASK_TYPES.includes(parsed.task_type)) return null;
        return parsed;
      } catch (e) {
        console.warn(`model ${model} threw: ${e}`);
        return null;
      }
    }

    let rec: Record<string, unknown> | null = null;
    let servedBy: string | null = null;
    for (const model of modelChain) {
      rec = await tryModel(model);
      if (rec) { servedBy = model; break; }
    }
    if (!rec) return json({ error: "assistant unavailable" }, 503);

    // sanitize + deterministic economy
    const time = TIMES.includes(rec.time_class as string) ? (rec.time_class as string) : "short";
    const effort = EFFORTS.includes(rec.effort_class as string) ? (rec.effort_class as string) : "moderate";
    const schedule = SCHEDULES.includes(rec.schedule as string) ? (rec.schedule as string) : "optional";
    const pillar = PILLARS.includes(rec.pillar as string) ? (rec.pillar as string) : null;
    const difficulty = difficultyFor(time, effort);
    const econ = DIFF_DEFAULTS[difficulty];

    return json({
      ok: true,
      recommendation: {
        match: typeof rec.match === "string" ? rec.match.slice(0, 80) : null,
        task_type: rec.task_type,
        pillar,
        category: String(rec.category ?? "").slice(0, 40),
        time_class: time,
        effort_class: effort,
        schedule,
        verification: String(rec.verification ?? "Parent Confirmation").slice(0, 80),
        difficulty,
        coins: econ.coins,
        xp: econ.xp,
        est_minutes: econ.minutes,
        reason: String(rec.reason ?? "").slice(0, 200),
        model: servedBy,
      },
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
