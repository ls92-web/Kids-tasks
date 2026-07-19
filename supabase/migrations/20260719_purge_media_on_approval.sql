-- ============================================================================
-- Privacy: purge proof media once a quest is approved (approved design)
-- ----------------------------------------------------------------------------
-- Photos and voice recordings are only needed until a quest is confirmed.
-- Once approved (by a parent, or by AI on an AI-only quest), the DB pointer
-- (submissions.image_path) is cleared here; the caller then deletes the
-- actual Storage object using the path returned as `purged_path` (Postgres
-- cannot delete Storage objects directly).
--
-- The tasks/submissions ROWS are never deleted — title, hero, type, outcome,
-- date and rewards remain forever. This preserves every existing invariant:
-- achievement counting (check_achievements re-scans completed tasks), the
-- parent Insights charts, and the Trophy Room progress bars all keep reading
-- exactly the same historical rows as before. Only the media is purged.
-- ============================================================================

alter table public.submissions add column if not exists media_purged boolean not null default false;

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
    'achievements', to_jsonb(unlocked),
    'purged_path', s.image_path
  );
end $function$;
