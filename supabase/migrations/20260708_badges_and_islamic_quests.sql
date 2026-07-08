-- Align the achievement badges with the delivered QuestForge badge art.
-- award_submission now counts prayer/qur'an quests and grants the badge set
-- that matches the 12 rendered badges (public/badges/<key>.png). The awarded
-- title text must match the BADGES catalog titles (src/lib/game.ts) so the
-- celebration can look up the right art. complete_legend grants first_legend.

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

  select xp into comp_xp from public.companions where child_id = p.id and status = 'active';

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
    count(*) filter (where task_type = 'prayer'),
    count(*) filter (where task_type = 'quran'),
    count(*) filter (where task_type in ('other','habit')),
    count(*) filter (where task_type = 'chore' and lower(title) like '%bed%'),
    count(*) filter (where extract(hour from (completed_at at time zone 'utc')) < 12),
    count(*)
  into n_homework, n_chore, n_reading, n_prayer, n_quran, n_helper, n_bed, n_morning, n_total
  from public.tasks where child_id = p.id and status = 'completed';

  -- the achievement badges (titles must match src/lib/game.ts BADGES)
  if n_total >= 1 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'first_steps', 'First Steps') on conflict do nothing;
    if found then unlocked := unlocked || 'First Steps'; end if;
  end if;
  if n_bed >= 20 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'bed_master', 'Bed Master') on conflict do nothing;
    if found then unlocked := unlocked || 'Bed Master'; end if;
  end if;
  if n_homework >= 30 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'homework_hero', 'Homework Hero') on conflict do nothing;
    if found then unlocked := unlocked || 'Homework Hero'; end if;
  end if;
  if n_reading >= 15 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'reading_star', 'Reading Star') on conflict do nothing;
    if found then unlocked := unlocked || 'Reading Star'; end if;
  end if;
  if n_helper >= 25 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'family_helper', 'Family Helper') on conflict do nothing;
    if found then unlocked := unlocked || 'Family Helper'; end if;
  end if;
  if n_morning >= 7 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'early_bird', 'Early Bird') on conflict do nothing;
    if found then unlocked := unlocked || 'Early Bird'; end if;
  end if;
  if new_streak >= 7 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'streak_7', '7-Day Streak') on conflict do nothing;
    if found then unlocked := unlocked || '7-Day Streak'; end if;
  end if;
  -- Islamic practice badges (parents assign 'prayer' / 'quran' quests)
  if n_prayer >= 50 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'prayer_guardian', 'Prayer Guardian') on conflict do nothing;
    if found then unlocked := unlocked || 'Prayer Guardian'; end if;
  end if;
  if n_quran >= 30 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'quran_companion', 'Qur''an Companion') on conflict do nothing;
    if found then unlocked := unlocked || 'Qur''an Companion'; end if;
  end if;
  -- milestone badges
  if n_total >= 36 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'first_world', 'World Explorer') on conflict do nothing;
    if found then unlocked := unlocked || 'World Explorer'; end if;
  end if;
  if comp_xp is not null and public.hero_level(comp_xp) >= 20 then
    insert into public.achievements(child_id, family_id, key, title) values (p.id, t.family_id, 'first_evolution', 'First Evolution') on conflict do nothing;
    if found then unlocked := unlocked || 'First Evolution'; end if;
  end if;

  return jsonb_build_object(
    'awarded', true,
    'coins', t.coin_reward,
    'xp', t.xp_reward,
    'streak', new_streak,
    'achievements', to_jsonb(unlocked)
  );
end $function$;

-- Sealing a Legend keeps its coin reward AND grants the First Legend badge.
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
  if c.quests_done < public.campaign_total() then
    raise exception 'your companion has not finished their campaign yet';
  end if;

  update public.companions
     set status = 'legend', legend_at = now()
   where id = c.id;

  update public.profiles
     set coins = coins + bonus,
         total_coins_earned = total_coins_earned + bonus
   where id = c.child_id;

  -- the First Legend achievement (title matches src/lib/game.ts BADGES)
  insert into public.achievements(child_id, family_id, key, title)
  values (c.child_id, c.family_id, 'first_legend', 'First Legend')
  on conflict do nothing;

  insert into public.events (family_id, child_id, type, payload)
  values (c.family_id, c.child_id, 'companion_legend',
          jsonb_build_object('species', c.species, 'xp', c.xp,
                             'quests_done', c.quests_done, 'reward', bonus));

  return jsonb_build_object('legend', true, 'species', c.species, 'reward', bonus);
end $$;
