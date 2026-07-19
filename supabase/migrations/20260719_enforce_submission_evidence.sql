-- ============================================================================
-- Enforce evidence at the source of truth: a submission for a quest that
-- requires photo or voice evidence MUST carry a proof file. Legacy quests
-- (evidence null) have always been photo quests, so they require one too.
-- Only evidence='none' quests may submit the hero's word (null image_path).
-- The UI already gates this; the trigger guarantees it against any client.
-- ============================================================================

create or replace function public.enforce_submission_evidence()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ev text;
begin
  select coalesce(evidence, 'photo') into ev from public.tasks where id = new.task_id;
  if ev in ('photo', 'voice') and (new.image_path is null or new.image_path = '') then
    raise exception 'this quest requires % proof', ev;
  end if;
  return new;
end;
$$;

drop trigger if exists submissions_require_evidence on public.submissions;
create trigger submissions_require_evidence
  before insert on public.submissions
  for each row execute function public.enforce_submission_evidence();
