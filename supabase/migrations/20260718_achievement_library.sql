-- ============================================================================
-- WonderNest Official Achievement Library v1.0 (approved decisions)
-- ----------------------------------------------------------------------------
-- - achievement_defs: the official catalogue (34 official + hidden framework +
--   3 legacy bonus achievements kept as-is). Source of truth going forward.
-- - check_achievements(child): the single unlock engine. Pays each
--   achievement's one-time reward to the HERO ONLY (profiles.xp + coins) —
--   never companion XP, quests_done, streaks, or campaign progression.
--   Already-unlocked achievements are never re-paid and never revoked.
-- - Hooks: award_submission (quest counts), settle_challenges (wins),
--   purchase_reward (redemptions/coins), and a challenge-join trigger.
-- - Title matching (approved for v1) identifies specific quests; stable IDs
--   can replace it later. Reading Star uses est_minutes of completed reading
--   quests as the "minutes read" measure.
-- - H003/H004 (14 consecutive morning/evening routines) ship in the catalogue
--   but inactive — deferred as genuinely complex. Hidden achievements carry
--   0/0 rewards until the doc defines official values.
-- - Badge artwork: badge_key points every new achievement at an EXISTING
--   official badge (approved reuse); repoint the data when new art lands.
-- ============================================================================

-- 0. Reward category metadata (needed by ACH028 / ACH033; persisted by the
--    rewards form when a library reward is used; null for custom rewards).
alter table public.rewards add column if not exists category text;

-- 1. The catalogue.
create table if not exists public.achievement_defs (
  key         text primary key,
  ach_id      text not null,
  title       text not null,
  category    text not null,
  hidden      boolean not null default false,
  legacy      boolean not null default false,
  active      boolean not null default true,
  xp_reward   integer not null default 0,
  coin_reward integer not null default 0,
  badge_key   text not null
);

alter table public.achievement_defs enable row level security;
drop policy if exists "achievement defs readable" on public.achievement_defs;
create policy "achievement defs readable" on public.achievement_defs
  for select using (true);

insert into public.achievement_defs (key, ach_id, title, category, hidden, legacy, active, xp_reward, coin_reward, badge_key) values
  -- Progression
  ('first_steps',         'ACH001', 'First Steps',          'progression',    false, false, true, 20, 10,  'first_steps'),
  ('quest_explorer',      'ACH002', 'Quest Explorer',       'progression',    false, false, true, 30, 20,  'first_world'),
  ('rising_hero',         'ACH003', 'Rising Hero',          'progression',    false, false, true, 50, 30,  'streak_7'),
  ('first_evolution',     'ACH004', 'First Evolution',      'progression',    false, false, true, 60, 40,  'first_evolution'),
  ('hero_evolution',      'ACH005', 'Hero Evolution',       'progression',    false, false, true, 80, 50,  'first_evolution'),
  ('legendary_companion', 'ACH006', 'Legendary Companion',  'progression',    false, false, true, 150, 100, 'first_legend'),
  -- Faith
  ('prayer_guardian',     'ACH007', 'Prayer Guardian',      'faith',          false, false, true, 80, 40,  'prayer_guardian'),
  ('quran_companion',     'ACH008', 'Qur''an Companion',    'faith',          false, false, true, 80, 40,  'quran_companion'),
  ('daily_dhikr',         'ACH009', 'Daily Dhikr',          'faith',          false, false, true, 60, 30,  'prayer_guardian'),
  ('grateful_heart',      'ACH010', 'Grateful Heart',       'faith',          false, false, true, 60, 30,  'prayer_guardian'),
  -- Learning
  ('homework_hero',       'ACH011', 'Homework Hero',        'learning',       false, false, true, 80, 40,  'homework_hero'),
  ('reading_star',        'ACH012', 'Reading Star',         'learning',       false, false, true, 80, 40,  'reading_star'),
  ('curious_mind',        'ACH013', 'Curious Mind',         'learning',       false, false, true, 70, 35,  'reading_star'),
  ('creative_artist',     'ACH014', 'Creative Artist',      'learning',       false, false, true, 60, 30,  'reading_star'),
  -- Responsibility
  ('bed_master',          'ACH015', 'Bed Master',           'responsibility', false, false, true, 60, 30,  'bed_master'),
  ('family_helper',       'ACH016', 'Family Helper',        'responsibility', false, false, true, 80, 40,  'family_helper'),
  ('responsibility_hero', 'ACH017', 'Responsibility Hero',  'responsibility', false, false, true, 100, 60, 'family_helper'),
  -- Wellbeing
  ('healthy_smile',       'ACH018', 'Healthy Smile',        'wellbeing',      false, false, true, 60, 30,  'early_bird'),
  ('fresh_start',         'ACH019', 'Fresh Start',          'wellbeing',      false, false, true, 60, 30,  'early_bird'),
  ('active_adventurer',   'ACH020', 'Active Adventurer',    'wellbeing',      false, false, true, 80, 40,  'streak_7'),
  ('early_sleeper',       'ACH021', 'Early Sleeper',        'wellbeing',      false, false, true, 70, 35,  'early_bird'),
  -- Character
  ('kindness_champion',   'ACH022', 'Kindness Champion',    'character',      false, false, true, 80, 40,  'family_helper'),
  ('truth_teller',        'ACH023', 'Truth Teller',         'character',      false, false, true, 60, 30,  'first_steps'),
  ('caring_friend',       'ACH024', 'Caring Friend',        'character',      false, false, true, 70, 35,  'family_helper'),
  ('good_manners',        'ACH025', 'Good Manners',         'character',      false, false, true, 70, 35,  'first_steps'),
  -- Family
  ('family_time',         'ACH026', 'Family Time',          'family',         false, false, true, 60, 30,  'family_helper'),
  ('adventure_together',  'ACH027', 'Adventure Together',   'family',         false, false, true, 100, 60, 'first_world'),
  ('memory_maker',        'ACH028', 'Memory Maker',         'family',         false, false, true, 80, 40,  'family_helper'),
  -- Special
  ('challenge_accepted',  'ACH029', 'Challenge Accepted',   'special',        false, false, true, 20, 10,  'first_steps'),
  ('challenge_champion',  'ACH030', 'Challenge Champion',   'special',        false, false, true, 80, 40,  'streak_7'),
  ('better_together',     'ACH031', 'Better Together',      'special',        false, false, true, 80, 40,  'family_helper'),
  ('treasure_collector',  'ACH032', 'Treasure Collector',   'special',        false, false, true, 70, 35,  'first_world'),
  ('dream_achiever',      'ACH033', 'Dream Achiever',       'special',        false, false, true, 100, 50, 'first_legend'),
  ('consistency_master',  'ACH034', 'Consistency Master',   'special',        false, false, true, 120, 60, 'streak_7'),
  -- Hidden framework (rewards 0/0 until the doc defines official values)
  ('secret_explorer',     'H001',   'Secret Explorer',      'special',        true,  false, true, 0, 0,    'first_world'),
  ('helping_hand',        'H002',   'Helping Hand',         'special',        true,  false, true, 0, 0,    'family_helper'),
  ('early_bird_14',       'H003',   'Early Bird',           'special',        true,  false, false, 0, 0,   'early_bird'),
  ('night_owl',           'H004',   'Night Owl',            'special',        true,  false, false, 0, 0,   'early_bird'),
  -- Legacy bonus achievements (kept; no doc rewards)
  ('early_bird',          'LEG001', 'Early Bird',           'special',        false, true,  true, 0, 0,    'early_bird'),
  ('streak_7',            'LEG002', '7-Day Streak',         'special',        false, true,  true, 0, 0,    'streak_7'),
  ('first_world',         'LEG003', 'World Explorer',       'special',        false, true,  true, 0, 0,    'first_world')
on conflict (key) do update set
  ach_id = excluded.ach_id, title = excluded.title, category = excluded.category,
  hidden = excluded.hidden, legacy = excluded.legacy, active = excluded.active,
  xp_reward = excluded.xp_reward, coin_reward = excluded.coin_reward,
  badge_key = excluded.badge_key;

-- 2. The unlock engine. Computes each measurable requirement, then unlocks and
--    pays any not-yet-earned achievements. Returns the newly unlocked titles.
create or replace function public.check_achievements(p_child uuid)
returns text[]
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  p public.profiles%rowtype;
  d public.achievement_defs%rowtype;
  unlocked text[] := '{}';
  cand text[] := '{}';
  n_total int; n_prayer int; n_quran int; n_homework int; n_chore int;
  reading_minutes int; n_learning int; n_responsibility int; n_character int; n_family int;
  n_bed int; n_adhkar int; n_gratitude int; n_creative int; n_brush int; n_shower int;
  n_exercise int; n_sleep int; n_truth int; n_help int; n_manners int; n_morning int;
  max_day int; n_comp_wins int; n_coop_wins int; n_famexp int; n_premium int;
  has_joined boolean; comp_level int; comp_quests int; is_legend boolean;
begin
  select * into p from public.profiles where id = p_child;
  if not found or p.role <> 'child' then
    return unlocked;
  end if;

  -- one pass over completed quests
  select
    count(*),
    count(*) filter (where task_type = 'prayer'),
    count(*) filter (where task_type = 'quran'),
    count(*) filter (where task_type = 'homework'),
    count(*) filter (where task_type = 'chore'),
    coalesce(sum(est_minutes) filter (where task_type = 'reading'), 0),
    count(*) filter (where pillar = 'learning'),
    count(*) filter (where pillar = 'responsibility'),
    count(*) filter (where pillar = 'character'),
    count(*) filter (where pillar = 'family'),
    count(*) filter (where task_type = 'chore' and title ilike '%bed%'),
    count(*) filter (where title ilike '%adhkar%'),
    count(*) filter (where title ilike '%gratitude%' or title ilike '%grateful%'),
    count(*) filter (where title ilike '%drawing%' or title ilike '%creative%' or title ilike '%craft%'),
    count(*) filter (where title ilike '%brush%'),
    count(*) filter (where title ilike '%shower%'),
    count(*) filter (where title ilike '%exercise%' or title ilike '%stretch%' or title ilike '%outdoor%'),
    count(*) filter (where title ilike '%sleep%'),
    count(*) filter (where title ilike '%truth%'),
    count(*) filter (where title ilike '%help a %'),
    count(*) filter (where title ilike '%manners%'),
    count(*) filter (where extract(hour from (completed_at at time zone 'utc')) < 12)
  into n_total, n_prayer, n_quran, n_homework, n_chore, reading_minutes,
       n_learning, n_responsibility, n_character, n_family,
       n_bed, n_adhkar, n_gratitude, n_creative, n_brush, n_shower,
       n_exercise, n_sleep, n_truth, n_help, n_manners, n_morning
  from public.tasks where child_id = p_child and status = 'completed';

  select coalesce(max(cnt), 0) into max_day from (
    select count(*) as cnt from public.tasks
     where child_id = p_child and status = 'completed' and completed_at is not null
     group by (completed_at at time zone 'utc')::date
  ) q;

  select
    count(*) filter (where payload->>'mode' = 'competitive'),
    count(*) filter (where payload->>'mode' = 'cooperative')
  into n_comp_wins, n_coop_wins
  from public.events where child_id = p_child and type = 'challenge_won';

  select
    count(*) filter (where r.category = 'Family Experiences'),
    count(*) filter (where r.category = 'Premium Rewards')
  into n_famexp, n_premium
  from public.redemptions rd
  join public.rewards r on r.id = rd.reward_id
  where rd.child_id = p_child;

  select exists (select 1 from public.challenge_participants where child_id = p_child)
    into has_joined;

  select coalesce(max(public.hero_level(xp)), 0),
         coalesce(max(quests_done), 0),
         coalesce(bool_or(status = 'legend' or xp >= public.legend_xp_threshold()), false)
    into comp_level, comp_quests, is_legend
  from public.companions where child_id = p_child;

  -- candidates (official)
  if n_total >= 1  then cand := array_append(cand, 'first_steps'); end if;
  if n_total >= 25 then cand := array_append(cand, 'quest_explorer'); end if;
  if public.hero_level(p.xp) >= 20 then cand := array_append(cand, 'rising_hero'); end if;
  if comp_level >= 20 or is_legend then cand := array_append(cand, 'first_evolution'); end if;
  if comp_level >= 50 or is_legend then cand := array_append(cand, 'hero_evolution'); end if;
  if is_legend then cand := array_append(cand, 'legendary_companion'); end if;
  if n_prayer >= 100 then cand := array_append(cand, 'prayer_guardian'); end if;
  if n_quran >= 50 then cand := array_append(cand, 'quran_companion'); end if;
  if n_adhkar >= 30 then cand := array_append(cand, 'daily_dhikr'); end if;
  if n_gratitude >= 30 then cand := array_append(cand, 'grateful_heart'); end if;
  if n_homework >= 100 then cand := array_append(cand, 'homework_hero'); end if;
  if reading_minutes >= 1000 then cand := array_append(cand, 'reading_star'); end if;
  if n_learning >= 50 then cand := array_append(cand, 'curious_mind'); end if;
  if n_creative >= 30 then cand := array_append(cand, 'creative_artist'); end if;
  if n_bed >= 50 then cand := array_append(cand, 'bed_master'); end if;
  if n_chore >= 100 then cand := array_append(cand, 'family_helper'); end if;
  if n_responsibility >= 250 then cand := array_append(cand, 'responsibility_hero'); end if;
  if n_brush >= 100 then cand := array_append(cand, 'healthy_smile'); end if;
  if n_shower >= 50 then cand := array_append(cand, 'fresh_start'); end if;
  if n_exercise >= 100 then cand := array_append(cand, 'active_adventurer'); end if;
  if n_sleep >= 50 then cand := array_append(cand, 'early_sleeper'); end if;
  if n_character >= 100 then cand := array_append(cand, 'kindness_champion'); end if;
  if n_truth >= 30 then cand := array_append(cand, 'truth_teller'); end if;
  if n_help >= 50 then cand := array_append(cand, 'caring_friend'); end if;
  if n_manners >= 50 then cand := array_append(cand, 'good_manners'); end if;
  if n_family >= 20 then cand := array_append(cand, 'family_time'); end if;
  if n_coop_wins >= 10 then cand := array_append(cand, 'adventure_together'); end if;
  if n_famexp >= 20 then cand := array_append(cand, 'memory_maker'); end if;
  if has_joined then cand := array_append(cand, 'challenge_accepted'); end if;
  if n_comp_wins >= 1 then cand := array_append(cand, 'challenge_champion'); end if;
  if n_coop_wins >= 1 then cand := array_append(cand, 'better_together'); end if;
  if p.coins >= 500 then cand := array_append(cand, 'treasure_collector'); end if;
  if n_premium >= 1 then cand := array_append(cand, 'dream_achiever'); end if;
  if p.streak_days >= 30 then cand := array_append(cand, 'consistency_master'); end if;
  -- hidden (active ones)
  if comp_quests >= public.campaign_total() then cand := array_append(cand, 'secret_explorer'); end if;
  if max_day >= 10 then cand := array_append(cand, 'helping_hand'); end if;
  -- legacy bonus (kept with their original requirements; no payout)
  if n_morning >= 7 then cand := array_append(cand, 'early_bird'); end if;
  if p.streak_days >= 7 then cand := array_append(cand, 'streak_7'); end if;
  if n_total >= 36 then cand := array_append(cand, 'first_world'); end if;

  -- unlock + one-time payout (hero xp + coins only; never companion/campaign)
  for d in
    select * from public.achievement_defs where key = any(cand) and active
  loop
    insert into public.achievements (child_id, family_id, key, title)
    values (p_child, p.family_id, d.key, d.title)
    on conflict (child_id, key) do nothing;
    if found then
      if d.xp_reward > 0 or d.coin_reward > 0 then
        update public.profiles
           set xp = xp + d.xp_reward,
               coins = coins + d.coin_reward,
               total_coins_earned = total_coins_earned + d.coin_reward
         where id = p_child;
      end if;
      unlocked := array_append(unlocked, d.title);
    end if;
  end loop;

  return unlocked;
end;
$$;

-- 3. award_submission now delegates every achievement check to the engine.
--    Identical to the previous version except the inline unlock blocks are
--    replaced by one check_achievements call (after rewards are applied).
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

  unlocked := public.check_achievements(p.id);

  return jsonb_build_object(
    'awarded', true,
    'coins', t.coin_reward,
    'xp', t.xp_reward,
    'streak', new_streak,
    'achievements', to_jsonb(unlocked)
  );
end $function$;

-- 4. settle_challenges: winners get their achievement check after the payout.
create or replace function public.settle_challenges()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  fam uuid;
  c   record;
  w   record;
  top_score int;
  team_total int;
begin
  select family_id into fam from public.profiles where id = auth.uid();
  if fam is null then
    return;
  end if;

  update public.challenges
     set settled_at = now()
   where family_id = fam and settled_at is null and status <> 'active';

  for c in
    select * from public.challenges
     where family_id = fam
       and status = 'active'
       and settled_at is null
       and ends_at <= now()
     for update
  loop
    if c.mode = 'cooperative' then
      select coalesce(sum(score), 0) into team_total
        from public.challenge_participants where challenge_id = c.id;
      if c.goal_target is not null and team_total >= c.goal_target then
        for w in
          select child_id from public.challenge_participants
           where challenge_id = c.id and score >= 1
        loop
          update public.profiles set xp = xp + c.bonus_xp where id = w.child_id;
          insert into public.events (family_id, child_id, type, payload)
          values (fam, w.child_id, 'challenge_won',
                  jsonb_build_object('challenge_id', c.id, 'title', c.title,
                                     'xp', c.bonus_xp, 'mode', 'cooperative'));
          perform public.check_achievements(w.child_id);
        end loop;
      end if;
    else
      select max(score) into top_score
        from public.challenge_participants where challenge_id = c.id;
      if top_score is not null and top_score >= 1 then
        for w in
          select child_id from public.challenge_participants
           where challenge_id = c.id and score = top_score
        loop
          update public.profiles set xp = xp + c.bonus_xp where id = w.child_id;
          insert into public.events (family_id, child_id, type, payload)
          values (fam, w.child_id, 'challenge_won',
                  jsonb_build_object('challenge_id', c.id, 'title', c.title,
                                     'xp', c.bonus_xp, 'mode', 'competitive'));
          perform public.check_achievements(w.child_id);
        end loop;
      end if;
    end if;

    update public.challenges
       set status = 'finished', settled_at = now()
     where id = c.id;
  end loop;
end;
$$;

-- 5. purchase_reward: redemption/coin achievements check after purchase.
create or replace function public.purchase_reward(p_reward_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r public.rewards%rowtype;
  p public.profiles%rowtype;
begin
  select * into p from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'no profile'; end if;
  select * into r from public.rewards where id = p_reward_id and family_id = p.family_id for update;
  if not found then raise exception 'reward not found'; end if;
  if not r.available or (r.expires_at is not null and r.expires_at < now()) then
    raise exception 'reward unavailable';
  end if;
  if r.quantity is not null and r.quantity <= 0 then
    raise exception 'sold out';
  end if;
  if p.coins < r.coin_cost then
    raise exception 'not enough coins';
  end if;

  update public.profiles set coins = coins - r.coin_cost where id = p.id;
  if r.quantity is not null then
    update public.rewards set quantity = quantity - 1 where id = r.id;
  end if;
  insert into public.redemptions (reward_id, child_id, family_id, reward_name, coins_spent)
  values (r.id, p.id, p.family_id, r.name, r.coin_cost);
  insert into public.events (family_id, child_id, type, payload)
  values (p.family_id, p.id, 'reward_purchased', jsonb_build_object('reward', r.name, 'coins', r.coin_cost));

  perform public.check_achievements(p.id);

  return jsonb_build_object('ok', true, 'coins_left', p.coins - r.coin_cost);
end $function$;

-- 6. Joining a challenge unlocks Challenge Accepted immediately.
create or replace function public.on_challenge_join()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.check_achievements(new.child_id);
  return new;
end;
$$;

drop trigger if exists challenge_join_achievements on public.challenge_participants;
create trigger challenge_join_achievements
  after insert on public.challenge_participants
  for each row execute function public.on_challenge_join();
