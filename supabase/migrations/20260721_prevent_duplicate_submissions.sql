-- ============================================================================
-- One submission per quest attempt — no more rapid-tap duplicates
-- ----------------------------------------------------------------------------
-- A child hammering "I did it!" created one submission PER TAP (20+ rows
-- seconds apart were observed live), each rendering as its own review card.
-- Worse, approving a duplicate card of an already-completed task awarded the
-- rewards AGAIN (award_submission only guarded per-submission, not per-task).
--
-- Three layers:
--   1. data fix — collapse existing pending duplicates to one per task
--      (none at all when the task is already completed/awarded)
--   2. a partial unique index — at most ONE pending submission per task,
--      atomic under any race
--   3. a BEFORE INSERT trigger for a friendly error message, and an
--      award_submission short-circuit so a duplicate of a completed task can
--      never award twice (it just clears the stray card, purging any media
--      pointer it carried)
-- ============================================================================

-- ---- 1. collapse existing duplicates ---------------------------------------
-- completed tasks: every pending submission is a stray duplicate
delete from public.submissions s
 using public.tasks t
 where t.id = s.task_id
   and s.status in ('pending', 'needs_review')
   and t.status = 'completed';

-- everything else: keep only the EARLIEST pending submission per task
delete from public.submissions s
 where s.status in ('pending', 'needs_review')
   and s.id not in (
     select distinct on (task_id) id
       from public.submissions
      where status in ('pending', 'needs_review')
      order by task_id, created_at asc
   );

-- ---- 2. at most one pending submission per task, enforced atomically -------
create unique index if not exists submissions_one_pending_per_task
  on public.submissions (task_id)
  where status in ('pending', 'needs_review');

-- ---- 3a. friendly guard for the common (non-race) case ---------------------
create or replace function public.prevent_duplicate_submission()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if exists (
    select 1 from public.submissions
     where task_id = new.task_id and status in ('pending', 'needs_review')
  ) then
    raise exception 'already sent — this quest is waiting for review';
  end if;
  if (select status from public.tasks where id = new.task_id)
       not in ('active', 'rejected') then
    raise exception 'already sent — this quest is waiting for review';
  end if;
  return new;
end $function$;

drop trigger if exists prevent_duplicate_submission on public.submissions;
create trigger prevent_duplicate_submission
  before insert on public.submissions
  for each row execute function public.prevent_duplicate_submission();

-- ---- 3b. approving a duplicate of a completed task never awards again ------
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

  -- a stray duplicate of an already-awarded quest: clear the card (and any
  -- media pointer it carried) but award NOTHING a second time
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
