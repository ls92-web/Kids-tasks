# Questforge

A gamified family quest app: parents assign real-life tasks, kids complete them inside a
fantasy world where every chore is a mission, every proof photo goes through a magic scan,
and every win pays out coins, XP, ranks and real rewards.

Built with **Next.js 16** (App Router, Tailwind v4, Framer Motion) and **Supabase**
(Postgres + RLS, Auth, Storage, Edge Functions). AI proof verification runs through
**OpenRouter** (free models supported) inside a Supabase edge function — the API key never
touches the frontend.

## The three worlds

Every child picks a theme in Settings. It re-skins the entire app — backgrounds, particles,
fonts, colors, rank names, map locations, even the verification ceremony:

| Theme | Feel | Verification | Ranks end at |
|---|---|---|---|
| Shadow Ninja Village | moonlight, rooftops, cherry petals, lanterns | Magic Scan | Eternal Shadow |
| Legend of the Samurai | golden leaves, mountains, torii gates, banners | Scroll Decoding | Living Legend |
| Speed Realm | neon loops, rings, crystals, energy streaks | Crystal Analysis | Velocity Legend |

## Core game loop

Complete task → upload proof photo → AI reviews the evidence and recommends (redo, or
send to the parent) → **the parent approves** → coins + XP awarded → celebration with
coin burst and level-ups on the child's next visit → streaks, achievements, challenge
scores update → treasure vault gets closer. The AI never awards coins and never completes
tasks — the parent is always the final authority.

## Running locally

```bash
npm install
npm run dev
```

`.env.local` already points at the Supabase project (`ukqqzzlhirgapoalhjox`).

## One-time Supabase setup

1. **AI verification via OpenRouter (optional but recommended)** — the `verify-submission`
   edge function calls OpenRouter's OpenAI-compatible `chat/completions` endpoint. Add the
   secrets in **Supabase Dashboard → Edge Functions → Secrets** (or via CLI):

   | Secret | Value |
   |---|---|
   | `OPENROUTER_API_KEY` | your key from [openrouter.ai/keys](https://openrouter.ai/keys) |
   | `AI_PROVIDER` | `openrouter` |
   | `AI_MODEL` | `qwen/qwen2.5-vl-72b-instruct` (recommended — also the built-in default) |

   ```bash
   supabase secrets set OPENROUTER_API_KEY=sk-or-... AI_PROVIDER=openrouter \
     AI_MODEL=qwen/qwen2.5-vl-72b-instruct --project-ref ukqqzzlhirgapoalhjox
   ```

   **Recommended model: `qwen/qwen2.5-vl-72b-instruct`.** A vision-capable model that
   is strong at reading worksheets and handwriting and at judging photos of made beds,
   cleaned rooms, toy cleanup, reading, and chores. It is a paid model with very low
   per-image cost, so a small OpenRouter credit lasts a long time. This is the built-in
   default — the function uses it even when `AI_MODEL` is unset.

   **Vision-only fallback chain.** Proof checking requires image understanding, so the
   chain never contains a text-only model, and the generic `openrouter/free` router is
   not used. If the default model is unavailable, the function falls back to free vision
   models before giving up:

   1. `qwen/qwen2.5-vl-72b-instruct` (default / your `AI_MODEL`)
   2. `qwen/qwen2.5-vl-72b-instruct:free`
   3. `google/gemma-3-27b-it:free`
   4. `meta-llama/llama-3.2-90b-vision-instruct:free`

   `AI_MODEL` stays fully configurable: set one model or a comma-separated priority list
   to try first — the vision fallbacks always remain behind it.

   **The AI only recommends — it never decides.** There are no confidence thresholds in
   the code. The model weighs the actual evidence and returns one of two outcomes:
   `redo_requested` (only when it is highly confident the proof is clearly incorrect,
   incomplete, unrelated, fake, or too blurry — the task reopens with a warm try-again
   message) or `pending_parent_review` (everything else, including "looks complete").
   Whenever there is any uncertainty it prefers the parent. Coins are never awarded and
   tasks are never completed automatically — that happens only when the parent approves
   from the review queue, where the AI's one-to-two-sentence reasoning, confidence, and
   flags are shown alongside the photo.

   **The AI is only the first filter.** If every model in the chain is rate-limited,
   unavailable, or returns something unusable — or if `OPENROUTER_API_KEY` is simply not
   set — the submission routes to the parent review queue with a friendly notice to the
   child. Parent/admin review is always the final fallback, and no task becomes done and
   no coins are paid until the parent approves.

2. **Parent signup emails** — Supabase requires email confirmation by default. Either keep
   it (parents confirm via email, the app shows a notice) or disable it in
   Dashboard → Authentication → Sign In / Up → "Confirm email".

## Accounts

- **Parents** sign up with email + password at `/signup` and land in the Guild Master
  console (`/admin`): create heroes, assign quests, stock the treasure vault, review
  uncertain proofs, grant claimed treasures, run challenges, adjust coins/XP.
- **Children** are created by the parent (no email). They sign in with **hero name + PIN**
  and only ever see their own world (`/app`). Row-level security enforces this at the
  database, not just the UI.

A demo family exists for exploration: parent `parent.test@kidsquest.app` / `testpass1234`,
hero `shadowfox` / PIN `1234`.

## Architecture notes

- **Theme engine** — `data-theme` on `<html>` drives CSS variables (`src/app/globals.css`);
  theme copy/ranks/map names live in `src/lib/game.ts`; scenery in
  `src/components/WorldBackground.tsx`; canvas particles in `ParticleField.tsx`.
- **Game math** — levels, ranks and difficulty defaults in `src/lib/game.ts`. Awarding,
  streaks, achievements and challenge scoring happen atomically in the Postgres function
  `award_submission`; purchases in `purchase_reward`.
- **Edge functions** (source in `supabase/functions/`) — `create-child` (parent-only
  account creation) and `verify-submission` (downloads the proof from private storage,
  asks the OpenRouter model for a strict-JSON recommendation — `status`
  (`redo_requested` / `pending_parent_review`), informational `confidence`, `reason` for
  the parent, `childMessage` for the child, `flags` — then either reopens the task for
  another try or queues it for the parent, who alone awards coins via `award_submission`;
  only the compact verdict JSON is stored, never image descriptions or personal details).
- **Storage** — private `proofs` bucket (children write their own folder, parents read
  their family's), public `reward-images` bucket.
- **Animation intensity** — kids can set full / reduced / minimal in Settings
  (`data-anim` attribute gates the heavy effects).
