<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# WonderNest Development Guide

WonderNest is a **family habit-building adventure** — not a task manager, not a
productivity app, not a digital pet. Parents feel calm and professional;
children feel magic (Nintendo/Pokémon quality). Every decision reinforces that
identity. **Final principle: choose whatever makes WonderNest simpler for
parents and more magical for children.**

## Source of truth (priority order)
1. WonderNest Design Bible v1.0 (product philosophy, UX, economy, architecture)
2. WonderNest Official Library v1.0 (quests, rewards, challenges, achievements)
3. Developer & Claude Implementation Guide v1.0 (this process)

Documentation lives in `~/Desktop/WonderNest V1.0/Documentation/`. When docs
and implementation differ, preserve current behavior unless the doc clearly
requires the change; log inconsistencies in that folder's `CORRECTIONS.md`
instead of silently picking a side.

## How we work
- Additive over replacement. Extend existing systems; never rebuild.
- Never redesign existing screens, progression, XP, economy, achievements, or
  UI without the owner's explicit approval.
- Small reviewable slices: gap analysis per doc section → owner approves items
  → implement only those → verify live → stop for review.
- Official content is centralized and data-driven — `src/lib/questLibrary.ts`,
  `src/lib/rewardLibrary.ts`, `achievement_defs` (DB). Never scatter
  hard-coded content values.
- Proven library UX: an optional "Start from the Official Library" dropdown
  pre-fills the existing form; every field stays editable; custom creation
  untouched.

## System invariants (do not break)
- **Quests**: one row in `tasks` per occurrence; completed history is never
  rewritten. `task_type` is the operational taxonomy; `pillar` is additive
  metadata.
- **Routines**: `quest_schedules` are templates; generated occurrences are
  ordinary quests with their own status/proof/review/coins/XP/history.
  Generation is idempotent (unique index + on-conflict-do-nothing); editing,
  pausing, or ending a routine never touches generated quests.
- **Companions**: grow ONLY through approved quest completion. Never hungry,
  sick, needing maintenance, or losing progress from inactivity.
- **Economy**: quest rewards come from difficulty (parent-editable);
  achievement/challenge payouts touch HERO XP/coins only — never companion XP,
  `quests_done`, streaks, or campaign progression.
- **Challenges**: overlays on normal quests, auto-scored from completions;
  bonus XP settles once, on natural expiry only.
- **Achievements**: unlock automatically server-side; earned once; never
  revoked; parents cannot award them manually.
- **Server rules stay centralized** in the security-definer functions:
  `award_submission`, `generate_due_quests`, `settle_challenges`,
  `check_achievements`, `purchase_reward`. RLS: parents manage only their
  family; children only their own data.

## AI rules
AI exists to reduce parent effort. AI MAY suggest/classify quests and
recommend categories, time/effort class, coins, XP, verification, routines,
rewards, challenges, and "Today's Adventure". AI must NEVER assign quests
automatically, spend coins, approve rewards, override parents, delete
completed history, or change game progression. Parents keep final, editable
control over every suggestion. `OPENROUTER_API_KEY` lives ONLY in Supabase
edge-function secrets — never in frontend code or env.

## Definition of done
Follows the Design Bible → uses the Official Library correctly → integrates
cleanly with existing systems → typecheck + build pass → verified live in the
preview → improves the experience without unnecessary complexity → committed
with an explanatory message.
