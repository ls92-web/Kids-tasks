-- ECONOMY v1.1 — THE SAVING JOURNEY.
--
-- 1. profiles.dream_reward_id: every hero can pin ONE reward they are saving
--    toward; the dashboard shows it with a progress bar. Children may set
--    their own pin (it is their goal); it clears itself if the reward is
--    deleted.
-- 2. Daily chest trim: the chest was minting an expected ~47 coins/day —
--    roughly EQUAL to a full day of quest income — for zero effort, which
--    made coins cheap and daily spending inevitable. It becomes a daily
--    sparkle (~23 expected coins/day): still exciting, never a salary.
--    Quest coin rewards (10/20/40/80 by difficulty) are deliberately
--    UNCHANGED — effort keeps its full value.
--
-- Client mirror: REWARD_TIERS / tierForCost in src/lib/rewardLibrary.ts,
-- rewardRarity thresholds in src/lib/game.ts.

alter table public.profiles
  add column if not exists dream_reward_id uuid references public.rewards(id) on delete set null;

create or replace function public.open_daily_chest()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  p public.profiles%rowtype;
  today date := (now() at time zone 'utc')::date;
  roll numeric;
  kind text;
  bonus int;
begin
  select * into p from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'no profile'; end if;
  if p.role <> 'child' then raise exception 'only heroes open chests'; end if;
  if p.last_chest_date = today then
    return jsonb_build_object('already_opened', true);
  end if;

  roll := random();
  if roll < 0.5 then
    kind := 'coins'; bonus := 5 + floor(random() * 21)::int;       -- 5-25 coins
  elsif roll < 0.82 then
    kind := 'coins_big'; bonus := 30 + floor(random() * 21)::int;  -- 30-50 coins
  elsif roll < 0.96 then
    kind := 'xp'; bonus := 40 + floor(random() * 61)::int;         -- 40-100 xp
  else
    kind := 'jackpot'; bonus := 75;                                -- rare jackpot
  end if;

  if kind = 'xp' then
    update public.profiles set xp = xp + bonus, last_chest_date = today where id = p.id;
  else
    update public.profiles set coins = coins + bonus, total_coins_earned = total_coins_earned + bonus, last_chest_date = today where id = p.id;
  end if;

  insert into public.events (family_id, child_id, type, payload)
  values (p.family_id, p.id, 'chest_opened', jsonb_build_object('kind', kind, 'bonus', bonus));

  return jsonb_build_object('opened', true, 'kind', kind, 'bonus', bonus);
end $$;
