-- Campaign pacing: champion growth and map progress finish together.
--
-- 1. companions.steps_done — difficulty-weighted campaign steps (easy/medium
--    1, hard 2, epic 3), capped at campaign_total(). quests_done stays a pure
--    quest count (achievements, "quests together", 25/50-quest unlocks).
-- 2. award_submission advances both counters.
-- 3. complete_legend gates on steps_done (the campaign), not quests_done.
-- 4. bond_companion world-completion unlocks (fox/samurai/robot) now read
--    lifetime weighted steps across all bonds instead of lifetime task count,
--    so "Complete Shadow Ninja Village" means exactly that.
--
-- Client mirror: STEP_WEIGHT / campaignForm / FORM_STEP_GATES in src/lib/game.ts,
-- campaignStep / lifetimeSteps in src/lib/worlds.ts.

alter table public.companions
  add column if not exists steps_done integer not null default 0;

-- existing bonds: every past quest was worth 1 step (the old pacing), so the
-- backfill preserves everyone's exact current map position
update public.companions
   set steps_done = least(quests_done, public.campaign_total())
 where steps_done = 0 and quests_done > 0;

create or replace function public.step_weight(p_difficulty text)
returns integer
language sql
immutable
as $$
  select case p_difficulty
    when 'hard' then 2
    when 'epic' then 3
    else 1
  end
$$;

-- award_submission: identical to the previous version except the companion
-- update now also advances steps_done by the quest's difficulty weight.
create or replace function public.award_submission(p_submission_id uuid, p_feedback text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
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

  if t.status = 'completed' then
    update public.submissions
       set status = 'approved',
           reviewed_by = auth.uid(), reviewed_at = now(),
           image_path = null,
           media_purged = (s.image_path is not null)
     where id = p_submission_id;
    return jsonb_build_object('already_awarded', true, 'purged_path', s.image_path);
  end if;

  select * into p from public.profiles where id = s.child_id for update;

  update public.submissions
     set status = 'approved',
         ai_feedback = coalesce(p_feedback, ai_feedback),
         reviewed_by = auth.uid(), reviewed_at = now(),
         image_path = null,
         media_purged = (s.image_path is not null)
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
    quests_done = quests_done + 1,
    steps_done = least(steps_done + public.step_weight(t.difficulty), public.campaign_total())
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
    'achievements', to_jsonb(unlocked),
    'purged_path', s.image_path
  );
end $$;

-- the Legend gate is the CAMPAIGN, measured in weighted steps
create or replace function public.complete_legend()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  c public.companions%rowtype;
  bonus integer := public.legend_reward_coins();
begin
  select * into c
  from public.companions
  where child_id = auth.uid() and status = 'active'
  for update;

  if not found then raise exception 'no active companion'; end if;
  if c.steps_done < public.campaign_total() then
    raise exception 'your companion has not finished their campaign yet';
  end if;

  update public.companions
     set status = 'legend', legend_at = now()
   where id = c.id;

  update public.profiles
     set coins = coins + bonus,
         total_coins_earned = total_coins_earned + bonus
   where id = c.child_id;

  insert into public.achievements(child_id, family_id, key, title)
  values (c.child_id, c.family_id, 'first_legend', 'First Legend')
  on conflict do nothing;

  insert into public.events (family_id, child_id, type, payload)
  values (c.family_id, c.child_id, 'companion_legend',
          jsonb_build_object('species', c.species, 'xp', c.xp,
                             'quests_done', c.quests_done,
                             'steps_done', c.steps_done, 'reward', bonus));

  return jsonb_build_object('legend', true, 'species', c.species, 'reward', bonus);
end $$;

-- world-completion unlocks read lifetime weighted steps (worlds actually
-- cleared), while the 25/50-quest and coin unlocks keep their old meaning
create or replace function public.bond_companion(p_species text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  me public.profiles%rowtype;
  lvl integer;
  steps integer;
  awakened boolean;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found or me.role <> 'child' then
    raise exception 'only heroes can bond a companion';
  end if;
  if p_species not in ('dragon','fox','owl','wolf','tiger','phoenix','turtle','forest','robot','ninja','samurai','pirate') then
    raise exception 'unknown companion';
  end if;

  if exists (select 1 from public.companions where child_id = me.id and status = 'active') then
    raise exception 'you already have an adventure partner';
  end if;

  if exists (select 1 from public.companions where child_id = me.id and species = p_species) then
    raise exception 'this companion has already completed their journey with you';
  end if;

  -- unlock rules — mirrors COMPANION_UNLOCKS in src/lib/game.ts
  -- (world completions in lifetime WEIGHTED steps: 36 / 72 / 108)
  lvl := public.hero_level(me.xp);
  select coalesce(sum(steps_done), 0) into steps
    from public.companions where child_id = me.id;
  awakened := case p_species
    when 'dragon'  then true                            -- starter
    when 'ninja'   then true                            -- starter
    when 'turtle'  then true                            -- starter
    when 'owl'     then lvl >= 10
    when 'tiger'   then lvl >= 25
    when 'phoenix' then lvl >= 40
    when 'forest'  then me.tasks_completed >= 25
    when 'wolf'    then me.tasks_completed >= 50
    when 'pirate'  then me.total_coins_earned >= 1000
    when 'fox'     then steps >= 36                     -- Shadow Ninja Village complete
    when 'samurai' then steps >= 72                     -- Legend of the Samurai complete
    when 'robot'   then steps >= 108                    -- Speed Realm complete
    else false
  end;
  if not awakened then
    raise exception 'this companion has not awakened yet';
  end if;

  insert into public.companions (child_id, family_id, species, status)
  values (me.id, me.family_id, p_species, 'active');

  update public.profiles set pet = p_species where id = me.id;

  return jsonb_build_object('bonded', true, 'species', p_species);
end $$;
