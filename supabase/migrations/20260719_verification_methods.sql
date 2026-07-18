-- ============================================================================
-- Per-quest confirmation methods (approved design)
-- ----------------------------------------------------------------------------
-- Evidence (what the child provides) is modelled separately from verification
-- authority (who confirms):
--   evidence: none | photo | voice
--   verifier: parent | ai | ai_parent
-- v1 rules enforced by the check constraint:
--   - every quest has a verifier (parent or ai or both)
--   - AI verification requires photo evidence
--   - voice evidence requires parent-only verification (no AI on audio)
--   - parent-only quests may require no evidence ("I did it" -> parent queue)
-- Both columns nullable: NULL = legacy behavior (photo + AI pre-screen +
-- parent approval), so every existing quest and routine is unchanged.
-- ============================================================================

alter table public.tasks add column if not exists evidence text;
alter table public.tasks add column if not exists verifier text;
alter table public.tasks drop constraint if exists tasks_verification_check;
alter table public.tasks add constraint tasks_verification_check check (
  (evidence is null and verifier is null)
  or (verifier = 'parent' and evidence in ('none','photo','voice'))
  or (verifier in ('ai','ai_parent') and evidence = 'photo')
);

alter table public.quest_schedules add column if not exists evidence text;
alter table public.quest_schedules add column if not exists verifier text;
alter table public.quest_schedules drop constraint if exists quest_schedules_verification_check;
alter table public.quest_schedules add constraint quest_schedules_verification_check check (
  (evidence is null and verifier is null)
  or (verifier = 'parent' and evidence in ('none','photo','voice'))
  or (verifier in ('ai','ai_parent') and evidence = 'photo')
);

-- Routine generator copies the template's confirmation method onto occurrences.
create or replace function public.generate_due_quests()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  fam   uuid;
  tz    text;
  today date;
  dow   smallint;
  s     record;
  slot  jsonb;
begin
  select family_id into fam from public.profiles where id = auth.uid();
  if fam is null then
    return;
  end if;

  select coalesce(timezone, 'Asia/Kuwait') into tz from public.families where id = fam;
  tz := coalesce(tz, 'Asia/Kuwait');

  today := (now() at time zone tz)::date;
  dow   := extract(dow from today)::smallint;

  update public.tasks
     set status = 'expired'
   where family_id = fam
     and schedule_id is not null
     and occurrence_date is not null
     and occurrence_date < today
     and status in ('active', 'rejected');

  for s in
    select * from public.quest_schedules
     where family_id = fam
       and active = true
       and ended_at is null
       and dow = any(weekdays)
  loop
    for slot in select value from jsonb_array_elements(s.slots) as value
    loop
      insert into public.tasks (
        family_id, child_id, title, description, task_type, difficulty,
        est_minutes, coin_reward, xp_reward, deadline, status, created_by,
        schedule_id, occurrence_date, slot_key, pillar, evidence, verifier
      )
      values (
        s.family_id,
        s.child_id,
        s.title || case when coalesce(slot->>'label', '') <> ''
                        then ' · ' || (slot->>'label') else '' end,
        s.description,
        s.task_type,
        s.difficulty,
        s.est_minutes,
        s.coin_reward,
        s.xp_reward,
        ((today + 1)::timestamp) at time zone tz,
        'active',
        s.created_by,
        s.id,
        today,
        coalesce(slot->>'key', 'default'),
        s.pillar,
        s.evidence,
        s.verifier
      )
      on conflict (schedule_id, child_id, occurrence_date, slot_key)
        where schedule_id is not null
      do nothing;
    end loop;
  end loop;
end;
$$;
