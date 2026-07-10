-- ============================================================================
-- Recurring quests — a lightweight template that lazily materializes ORDINARY
-- rows in `tasks`. Nothing in the completion pipeline changes: award_submission,
-- proof/submissions, parent review, coins/XP, companion progression,
-- achievements and challenge scoring all keep reading plain task rows.
--
-- Footprint: families.timezone; a wider tasks.task_type whitelist (to match the
-- app's existing TASK_TYPES); a quest_schedules table; three nullable columns
-- on tasks + one partial unique index; and a family-scoped generator RPC.
-- ============================================================================

-- 1. Family-local calendar. Existing families default to Asia/Kuwait; so do new
--    ones. Schedules are evaluated against this timezone, never raw UTC.
alter table public.families
  add column if not exists timezone text not null default 'Asia/Kuwait';

-- 2. Align the tasks.task_type whitelist with the app's TASK_TYPES so Prayer and
--    Qur'an routines (and one-off quests) can be created. Additive only — it
--    permits values the UI already offers; no scoring/achievement/challenge
--    behavior changes (those simply never matched prayer/quran before).
alter table public.tasks drop constraint if exists tasks_task_type_check;
alter table public.tasks add constraint tasks_task_type_check
  check (task_type = any (array['chore','homework','reading','prayer','quran','habit','other']));

-- 3. The recurring-quest template. Conservative reward defaults — routines can
--    fire several times a day; the future quest library / the parent refine them.
create table if not exists public.quest_schedules (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references public.families(id) on delete cascade,
  child_id     uuid not null references public.profiles(id) on delete cascade,
  created_by   uuid not null references public.profiles(id),
  title        text not null,
  description  text not null default '',
  task_type    text not null default 'chore'
                 check (task_type = any (array['chore','homework','reading','prayer','quran','habit','other'])),
  difficulty   text not null default 'easy'
                 check (difficulty = any (array['easy','medium','hard','epic'])),
  est_minutes  integer not null default 5,
  coin_reward  integer not null default 2,
  xp_reward    integer not null default 5,
  -- Postgres dow convention: 0=Sunday … 6=Saturday. Default = every day.
  weekdays     smallint[] not null default '{0,1,2,3,4,5,6}',
  -- named, stable slots: [{ "key": "fajr", "label": "Fajr", "time": null }, …]
  slots        jsonb not null default '[{"key":"default","label":"","time":null}]'::jsonb,
  active       boolean not null default true,   -- Pause = false; Resume = true
  ended_at     timestamptz,                     -- End routine (never deleted)
  created_at   timestamptz not null default now(),
  constraint quest_schedules_weekdays_not_empty
    check (coalesce(array_length(weekdays, 1), 0) >= 1),
  constraint quest_schedules_slots_is_array
    check (jsonb_typeof(slots) = 'array' and jsonb_array_length(slots) >= 1)
);

create index if not exists quest_schedules_family_idx on public.quest_schedules(family_id);
create index if not exists quest_schedules_child_idx on public.quest_schedules(child_id);

-- 4. Link + idempotency columns on tasks. All nullable → every existing manual
--    insert is completely unaffected.
alter table public.tasks add column if not exists schedule_id uuid
  references public.quest_schedules(id) on delete set null;
alter table public.tasks add column if not exists occurrence_date date;
alter table public.tasks add column if not exists slot_key text;

-- One occurrence per (schedule, child, local day, slot). This is the guard that
-- makes repeated generate_due_quests() calls safe.
create unique index if not exists tasks_recurring_occurrence_uidx
  on public.tasks (schedule_id, child_id, occurrence_date, slot_key)
  where schedule_id is not null;

-- 5. RLS: the family reads its own schedules; only parents write them.
alter table public.quest_schedules enable row level security;

drop policy if exists "family reads its schedules" on public.quest_schedules;
create policy "family reads its schedules" on public.quest_schedules
  for select using (family_id = public.my_family_id());

drop policy if exists "parents insert schedules" on public.quest_schedules;
create policy "parents insert schedules" on public.quest_schedules
  for insert with check (public.is_parent() and family_id = public.my_family_id());

drop policy if exists "parents update schedules" on public.quest_schedules;
create policy "parents update schedules" on public.quest_schedules
  for update using (public.is_parent() and family_id = public.my_family_id())
  with check (public.is_parent() and family_id = public.my_family_id());

drop policy if exists "parents delete schedules" on public.quest_schedules;
create policy "parents delete schedules" on public.quest_schedules
  for delete using (public.is_parent() and family_id = public.my_family_id());

-- 6. Lazy generation, scoped to the CALLER'S family only. Expires stale
--    recurring occurrences from earlier local days, then materializes today's.
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
  -- the caller's family (works for parent or child); no session → no-op.
  select family_id into fam from public.profiles where id = auth.uid();
  if fam is null then
    return;
  end if;

  select coalesce(timezone, 'Asia/Kuwait') into tz from public.families where id = fam;
  tz := coalesce(tz, 'Asia/Kuwait');

  today := (now() at time zone tz)::date;
  dow   := extract(dow from today)::smallint;

  -- (a) Expire stale recurring occurrences whose local day has passed. Only
  --     rows still actionable (active/rejected) are swept; 'submitted' and
  --     'needs_review' (proof in flight) and 'completed' are left untouched, and
  --     manual tasks (schedule_id is null) are never affected.
  update public.tasks
     set status = 'expired'
   where family_id = fam
     and schedule_id is not null
     and occurrence_date is not null
     and occurrence_date < today
     and status in ('active', 'rejected');

  -- (b) Generate today's occurrences for each active, non-ended schedule whose
  --     weekday set includes today. Never backfills past days.
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
        schedule_id, occurrence_date, slot_key
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
        -- deadline = end of this occurrence's LOCAL day (next local midnight)
        ((today + 1)::timestamp) at time zone tz,
        'active',
        s.created_by,
        s.id,
        today,
        coalesce(slot->>'key', 'default')
      )
      on conflict (schedule_id, child_id, occurrence_date, slot_key)
        where schedule_id is not null
      do nothing;
    end loop;
  end loop;
end;
$$;

grant execute on function public.generate_due_quests() to authenticated;
