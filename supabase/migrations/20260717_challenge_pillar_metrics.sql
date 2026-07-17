-- ============================================================================
-- Expanded challenge metrics (approved design, Proposal 1)
-- ----------------------------------------------------------------------------
-- Adds the six WonderNest Pillars + prayer as challenge metrics, powered by a
-- new informational `pillar` column on tasks/quest_schedules. task_type stays
-- the operational taxonomy; pillar is auto-populated (hidden in the v1 UI) —
-- from the Official Library profile when one is used, otherwise from a
-- task_type default mapping in the app. Exercise is treated as Wellbeing.
--
-- award_submission changes are ADDITIVE ONLY: two new OR branches in the
-- challenge-scoring predicate. The five existing metrics behave identically.
-- ============================================================================

-- 1. Informational pillar metadata (nullable → existing rows/flows untouched).
alter table public.tasks add column if not exists pillar text
  check (pillar is null or pillar = any (array['faith','learning','responsibility','wellbeing','character','family']));
alter table public.quest_schedules add column if not exists pillar text
  check (pillar is null or pillar = any (array['faith','learning','responsibility','wellbeing','character','family']));

-- 2. Widen the challenge metric whitelist: 5 existing + prayer + 6 pillars.
alter table public.challenges drop constraint if exists challenges_metric_check;
alter table public.challenges add constraint challenges_metric_check
  check (metric = any (array[
    'tasks','reading','homework','cleaning','habits',
    'prayer',
    'faith','learning','responsibility','wellbeing','character','family'
  ]));

-- 3. Routine generator copies the template's pillar onto each occurrence.
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
        schedule_id, occurrence_date, slot_key, pillar
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
        s.pillar
      )
      on conflict (schedule_id, child_id, occurrence_date, slot_key)
        where schedule_id is not null
      do nothing;
    end loop;
  end loop;
end;
$$;

-- 4. award_submission: identical to the previous version EXCEPT two additive
--    OR branches in the challenge-scoring predicate (prayer + pillar match).
create or replace function public.award_submission(p_submission_id uuid, p_feedback text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  s public.submissions%rowtype;
  t public.tasks%rowtype;
  p public.profiles%rowtype;
  today date := (now() at time zone 'utc')::date;
  new_streak integer;
  unlocked text[] := '{}';
  n_homework int; n_chore int; n_reading int; n_prayer int; n_quran int;
  n_helper int; n_bed int; n_morning int; n_total int;
  comp_xp int;
begin
  if current_user in ('anon', 'authenticated') and not public.is_parent() then
    raise exception 'not allowed';
  end if;

  select * into s from public.submissions where id = p_submission_id for update;
  if not found then raise exception 'submission not found'; end if;
  if s.status in ('approved','ai_approved') then
    return jsonb_build_object('already_awarded', true);
  end if;

  select * into t from public.tasks where id = s.task_id for update;
  select * into p from public.profiles where id = s.child_id for update;

  update public.submissions
     set status = 'approved',
         ai_feedback = coalesce(p_feedback, ai_feedback),
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_submission_id;

  update public.tasks set status = 'completed', completed_at = now() where id = t.id;

  if p.last_streak_date = today then
    new_streak := p.streak_days;
  elsif p.last_streak_date = today - 1 then
    new_streak := p.streak_days + 1;
  else
    new_streak := 1;
  end if;

  update public.profiles set
    xp = xp + t.xp_reward,
    coins = coins + t.coin_reward,
    total_coins_earned = total_coins_earned + t.coin_reward,
    tasks_completed = tasks_completed + 1,
    streak_days = new_streak,
    last_streak_date = today
  where id = p.id;

  update public.companions set
    xp = xp + t.xp_reward,
    quests_done = quests_done + 1
  where child_id = p.id and status = 'active';

  select xp into comp_xp from public.companions where child_id = p.id and status = 'active';

  insert into public.events (family_id, child_id, type, payload)
  values (t.family_id, p.id, 'task_completed',
          jsonb_build_object('task_id', t.id, 'title', t.title, 'coins', t.coin_reward, 'xp', t.xp_reward));

  update public.challenge_participants cp set score = score + 1
  from public.challenges c
  where cp.challenge_id = c.id and cp.child_id = p.id
    and c.status = 'active' and now() between c.starts_at and c.ends_at
    and (c.metric = 'tasks'
      or (c.metric = 'reading' and t.task_type = 'reading')
      or (c.metric = 'homework' and t.task_type = 'homework')
      or (c.metric = 'habits' and t.task_type = 'habit')
      or (c.metric = 'cleaning' and t.task_type = 'chore')
      or (c.metric = 'prayer' and t.task_type = 'prayer')
      or (t.pillar is not null and c.metric = t.pillar));

  select
    count(*) filter (where task_type = 'homework'),
    count(*) filter (where task_type = 'chore'),
    count(*) filter (where task_type = 'reading'),
    count(*) filter (where task_type = 'prayer'),
    count(*) filter (where task_type = 'quran'),
    count(*) filter (where task_type in ('other','habit')),
    count(*) filter (where task_type = 'chore' and lower(title) like '%bed%'),
    count(*) filter (where extract(hour from (completed_at at time zone 'utc')) < 12),
    count(*)
  into n_homework, n_chore, n_reading, n_prayer, n_quran, n_helper, n_bed, n_morning, n_total
  from public.tasks where child_id = p.id and status = 'completed';

  if n_total >= 1 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'first_steps', 'First Steps') on conflict do nothing;
    if found then unlocked := array_append(unlocked, 'First Steps'); end if;
  end if;
  if n_bed >= 20 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'bed_master', 'Bed Master') on conflict do nothing;
    if found then unlocked := array_append(unlocked, 'Bed Master'); end if;
  end if;
  if n_homework >= 30 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'homework_hero', 'Homework Hero') on conflict do nothing;
    if found then unlocked := array_append(unlocked, 'Homework Hero'); end if;
  end if;
  if n_reading >= 15 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'reading_star', 'Reading Star') on conflict do nothing;
    if found then unlocked := array_append(unlocked, 'Reading Star'); end if;
  end if;
  if n_helper >= 25 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'family_helper', 'Family Helper') on conflict do nothing;
    if found then unlocked := array_append(unlocked, 'Family Helper'); end if;
  end if;
  if n_morning >= 7 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'early_bird', 'Early Bird') on conflict do nothing;
    if found then unlocked := array_append(unlocked, 'Early Bird'); end if;
  end if;
  if new_streak >= 7 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'streak_7', '7-Day Streak') on conflict do nothing;
    if found then unlocked := array_append(unlocked, '7-Day Streak'); end if;
  end if;
  if n_prayer >= 50 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'prayer_guardian', 'Prayer Guardian') on conflict do nothing;
    if found then unlocked := array_append(unlocked, 'Prayer Guardian'); end if;
  end if;
  if n_quran >= 30 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'quran_companion', 'Qur''an Companion') on conflict do nothing;
    if found then unlocked := array_append(unlocked, 'Qur''an Companion'); end if;
  end if;
  if n_total >= 36 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'first_world', 'World Explorer') on conflict do nothing;
    if found then unlocked := array_append(unlocked, 'World Explorer'); end if;
  end if;
  if comp_xp is not null and public.hero_level(comp_xp) >= 20 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'first_evolution', 'First Evolution') on conflict do nothing;
    if found then unlocked := array_append(unlocked, 'First Evolution'); end if;
  end if;

  return jsonb_build_object(
    'awarded', true,
    'coins', t.coin_reward,
    'xp', t.xp_reward,
    'streak', new_streak,
    'achievements', to_jsonb(unlocked)
  );
end $function$;
