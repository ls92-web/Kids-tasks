-- ============================================================================
-- Optional auto-end date for routines (recurring quests)
-- ----------------------------------------------------------------------------
-- One-off quests already have `deadline`; routines had no expiration concept
-- at all before this — they only stopped via a parent's manual "End". This
-- adds an optional `expires_at`: when set, generate_due_quests() treats it
-- exactly like a manual end (active=false, ended_at stamped) the first time
-- it runs on/after that date, then simply stops generating — no schema
-- change to `ended_at`'s existing meaning, no change to one-off quests.
-- ============================================================================

alter table public.quest_schedules add column if not exists expires_at timestamptz;

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

  -- routines whose optional auto-end date has passed stop exactly like a
  -- manual End — the row and every quest it already generated stay intact
  update public.quest_schedules
     set active = false, ended_at = coalesce(ended_at, expires_at)
   where family_id = fam
     and active = true
     and ended_at is null
     and expires_at is not null
     and expires_at <= now();

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
