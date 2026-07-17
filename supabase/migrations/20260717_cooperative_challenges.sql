-- ============================================================================
-- Cooperative challenges (approved design, Proposal 2)
-- ----------------------------------------------------------------------------
-- Cooperation is a presentation/completion MODE, not a new scoring pipeline:
-- award_submission still increments each participant's score exactly as
-- before; a cooperative challenge simply compares SUM(scores) to a shared
-- family goal instead of ranking children. Existing rows default to
-- competitive, so nothing changes for them.
-- ============================================================================

alter table public.challenges add column if not exists mode text not null default 'competitive'
  check (mode = any (array['competitive','cooperative']));
alter table public.challenges add column if not exists goal_target integer
  check (goal_target is null or goal_target > 0);
