-- ============================================================================
-- Parent-chosen icons for quests, routines, and challenges
-- ----------------------------------------------------------------------------
-- Rewards already store a parent-chosen `icon`; quests and challenges never
-- did — their card art was always auto-derived (task_type → icon, or a fixed
-- "lightning" icon for every challenge). This adds a nullable `icon` column
-- to each, storing an icon slug the parent explicitly picked. Purely
-- additive: existing rows keep icon = null and continue to render exactly as
-- before (the app falls back to the same auto-derivation it always used).
--
-- quest_schedules also gets the column so a routine's chosen icon carries
-- into every quest occurrence generate_due_quests() materializes from it.
-- ============================================================================

alter table public.tasks add column if not exists icon text;
alter table public.quest_schedules add column if not exists icon text;
alter table public.challenges add column if not exists icon text;

create or replace function public.generate_due_quests()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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
        schedule_id, occurrence_date, slot_key, pillar, evidence, verifier, icon
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
        s.verifier,
        s.icon
      )
      on conflict (schedule_id, child_id, occurrence_date, slot_key)
        where schedule_id is not null
      do nothing;
    end loop;
  end loop;
end;
$function$;
