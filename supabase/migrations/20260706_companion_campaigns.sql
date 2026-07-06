-- COMPANION CAMPAIGNS: the progression model changes.
--
-- A bonded companion runs its own CAMPAIGN: the three shared worlds
-- (Shadow Ninja Village → Legend of the Samurai → Speed Realm) plus one
-- companion-exclusive FINALE world — 4 worlds × 36 quests = 144 steps.
-- Campaign progress belongs to the BOND (companions.quests_done), not the
-- hero's lifetime total, so every new campaign starts back at step 0.
--
-- LEGENDARY is earned by completing the finale world (quests_done >= 144),
-- no longer by reaching XP level 100. XP keeps flowing for growth/evolution.

-- 1) per-campaign progress counter
alter table public.companions add column if not exists quests_done integer not null default 0;

-- Backfill: quests approved while each bond was (or is) the active partner.
update public.companions c set quests_done = sub.n
from (
  select c2.id,
         (select count(*) from public.tasks t
           where t.child_id = c2.child_id
             and t.status = 'completed'
             and t.completed_at >= c2.bonded_at
             and (c2.legend_at is null or t.completed_at <= c2.legend_at)) as n
  from public.companions c2
) sub
where sub.id = c.id;

-- 2) campaign length (single source of truth; mirrors CAMPAIGN_TOTAL in src/lib/worlds.ts)
create or replace function public.campaign_total()
returns integer language sql immutable as $$ select 144 $$;

-- 3) quest approval advances the active campaign
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
  n_homework int; n_chore int; n_reading int; n_helper int; n_bed int; n_morning int; n_total int;
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

  -- streak
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

  -- the bonded companion grows with every quest — and its campaign advances
  update public.companions set
    xp = xp + t.xp_reward,
    quests_done = quests_done + 1
  where child_id = p.id and status = 'active';

  insert into public.events (family_id, child_id, type, payload)
  values (t.family_id, p.id, 'task_completed',
          jsonb_build_object('task_id', t.id, 'title', t.title, 'coins', t.coin_reward, 'xp', t.xp_reward));

  -- challenge scores
  update public.challenge_participants cp set score = score + 1
  from public.challenges c
  where cp.challenge_id = c.id and cp.child_id = p.id
    and c.status = 'active' and now() between c.starts_at and c.ends_at
    and (c.metric = 'tasks'
      or (c.metric = 'reading' and t.task_type = 'reading')
      or (c.metric = 'homework' and t.task_type = 'homework')
      or (c.metric = 'habits' and t.task_type = 'habit')
      or (c.metric = 'cleaning' and t.task_type = 'chore'));

  -- counts across completed quests (includes this one)
  select
    count(*) filter (where task_type = 'homework'),
    count(*) filter (where task_type = 'chore'),
    count(*) filter (where task_type = 'reading'),
    count(*) filter (where task_type in ('other','habit')),
    count(*) filter (where task_type = 'chore' and lower(title) like '%bed%'),
    count(*) filter (where extract(hour from (completed_at at time zone 'utc')) < 12),
    count(*)
  into n_homework, n_chore, n_reading, n_helper, n_bed, n_morning, n_total
  from public.tasks where child_id = p.id and status = 'completed';

  if n_total >= 1 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'first_steps', 'First Steps') on conflict do nothing;
    if found then unlocked := unlocked || 'first_steps'; end if;
  end if;
  if n_bed >= 20 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'bed_master', 'Bed Master') on conflict do nothing;
    if found then unlocked := unlocked || 'bed_master'; end if;
  end if;
  if n_homework >= 30 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'homework_hero', 'Homework Hero') on conflict do nothing;
    if found then unlocked := unlocked || 'homework_hero'; end if;
  end if;
  if n_chore >= 50 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'cleaning_champion', 'Cleaning Champion') on conflict do nothing;
    if found then unlocked := unlocked || 'cleaning_champion'; end if;
  end if;
  if n_reading >= 15 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'reading_star', 'Reading Star') on conflict do nothing;
    if found then unlocked := unlocked || 'reading_star'; end if;
  end if;
  if n_reading >= 20 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'reading_legend', 'Reading Legend') on conflict do nothing;
    if found then unlocked := unlocked || 'reading_legend'; end if;
  end if;
  if n_helper >= 25 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'family_helper', 'Family Helper') on conflict do nothing;
    if found then unlocked := unlocked || 'family_helper'; end if;
  end if;
  if n_morning >= 7 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'early_bird', 'Early Bird') on conflict do nothing;
    if found then unlocked := unlocked || 'early_bird'; end if;
  end if;
  if new_streak >= 7 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'streak_7', '7-Day Streak') on conflict do nothing;
    if found then unlocked := unlocked || 'streak_7'; end if;
  end if;
  if new_streak >= 30 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'streak_30', 'Consistency Crown') on conflict do nothing;
    if found then unlocked := unlocked || 'streak_30'; end if;
  end if;
  if new_streak >= 100 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'streak_100', 'Century Streak') on conflict do nothing;
    if found then unlocked := unlocked || 'streak_100'; end if;
  end if;
  if n_total >= 100 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'tasks_100', 'Centurion') on conflict do nothing;
    if found then unlocked := unlocked || 'tasks_100'; end if;
  end if;
  if n_total >= 250 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'quest_master', 'Quest Master') on conflict do nothing;
    if found then unlocked := unlocked || 'quest_master'; end if;
  end if;
  if p.total_coins_earned + t.coin_reward >= 1000 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'coins_1000', 'Coin Collector') on conflict do nothing;
    if found then unlocked := unlocked || 'coins_1000'; end if;
  end if;
  if p.xp + t.xp_reward >= 48000 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'legendary_hero', 'Legendary Hero') on conflict do nothing;
    if found then unlocked := unlocked || 'legendary_hero'; end if;
  end if;

  return jsonb_build_object(
    'awarded', true,
    'coins', t.coin_reward,
    'xp', t.xp_reward,
    'streak', new_streak,
    'achievements', to_jsonb(unlocked)
  );
end $function$;

-- 4) Legendary = campaign completed (finale world cleared), not XP level
create or replace function public.complete_legend()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  c public.companions%rowtype;
begin
  select * into c
  from public.companions
  where child_id = auth.uid() and status = 'active'
  for update;

  if not found then raise exception 'no active companion'; end if;
  if c.quests_done < public.campaign_total() then
    raise exception 'your companion has not finished their campaign yet';
  end if;

  update public.companions
     set status = 'legend', legend_at = now()
   where id = c.id;

  insert into public.events (family_id, child_id, type, payload)
  values (c.family_id, c.child_id, 'companion_legend',
          jsonb_build_object('species', c.species, 'xp', c.xp, 'quests_done', c.quests_done));

  return jsonb_build_object('legend', true, 'species', c.species);
end $$;
