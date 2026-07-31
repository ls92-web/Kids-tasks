-- ============================================================================
-- Early Bird counts the CHILD's mornings, on both sides of the wire
-- ----------------------------------------------------------------------------
-- The client bar counted quests CREATED before noon device-time (routines all
-- generate in the morning, so it raced to 7/7), while the server counted
-- quests APPROVED before noon UTC (parents review in the evening, so it
-- stayed near 0) — a full bar over a locked badge, forever. Both sides now
-- agree: a quest is a "morning quest" when the child's FIRST SUBMISSION was
-- sent before 12:00 in the family's timezone. Client mirror: computeCounts()
-- in src/lib/game.ts. Also guarantees children can read their own
-- submissions (the client's honest count needs it).
-- ============================================================================

drop policy if exists "children read own submissions" on public.submissions;
create policy "children read own submissions" on public.submissions
  for select using (child_id = auth.uid());

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
    count(*) filter (where title ilike '%manners%')
  into n_total, n_prayer, n_quran, n_homework, n_chore, reading_minutes,
       n_learning, n_responsibility, n_character, n_family,
       n_bed, n_adhkar, n_gratitude, n_creative, n_brush, n_shower,
       n_exercise, n_sleep, n_truth, n_help, n_manners
  from public.tasks where child_id = p_child and status = 'completed';

  -- Early Bird counts what the CHILD did: quests whose first submission was
  -- sent before noon in the family's own timezone (was: approval time, UTC —
  -- which depended on when the PARENT reviewed, not when the child acted)
  select count(*) into n_morning from (
    select t.id, min(s.created_at) as first_sub, max(f.timezone) as tz
      from public.tasks t
      join public.submissions s on s.task_id = t.id
      join public.families f on f.id = t.family_id
     where t.child_id = p_child and t.status = 'completed'
     group by t.id
  ) q
  where extract(hour from (q.first_sub at time zone coalesce(q.tz, 'Asia/Kuwait'))) < 12;

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

