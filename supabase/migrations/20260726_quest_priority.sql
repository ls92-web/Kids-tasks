-- ============================================================================
-- Main Quests: parent-marked priority on one-off quests
-- ----------------------------------------------------------------------------
-- The child's quest board groups into Daily Training (routine occurrences),
-- Main Quests (parent-marked priority one-offs), and Side Quests (the rest).
-- Priority is a plain flag the parent sets on the assign form — routines
-- never carry it (they always belong to Daily Training). No function or
-- policy changes: inserts already flow through the parents-manage-tasks RLS.
-- ============================================================================

alter table public.tasks add column if not exists priority boolean not null default false;
