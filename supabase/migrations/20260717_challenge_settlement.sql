-- ============================================================================
-- Challenge bonus-XP settlement (approved design, Proposal 3)
-- ----------------------------------------------------------------------------
-- Settles each challenge ONCE when its end time passes, using the same lazy,
-- family-scoped, idempotent pattern as generate_due_quests():
--   competitive: highest score wins the bonus XP (ties: every top scorer gets
--                the full amount; minimum participation score >= 1)
--   cooperative: if the family total reaches goal_target, every contributor
--                (score >= 1) receives the bonus ("each", per the doc)
-- Hard guardrails: HERO XP ONLY — never coins, companion xp, quests_done,
-- streaks, or achievements, so a challenge can never advance a campaign.
-- Ending a challenge early (parent's End button) stamps settled_at with NO
-- award; natural expiry is the only path that pays.
-- ============================================================================

alter table public.challenges add column if not exists settled_at timestamptz;

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

  -- Anything already finished (ended early, or legacy rows) settles silently.
  update public.challenges
     set settled_at = now()
   where family_id = fam and settled_at is null and status <> 'active';

  -- Naturally-expired active challenges: award once, then close.
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
        end loop;
      end if;
    end if;

    update public.challenges
       set status = 'finished', settled_at = now()
     where id = c.id;
  end loop;
end;
$$;

grant execute on function public.settle_challenges() to authenticated;
