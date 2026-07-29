-- ============================================================================
-- Chest reveal can never be lost: already_opened returns TODAY'S PRIZE
-- ----------------------------------------------------------------------------
-- A laggy tap could grant the prize server-side while the client lost the
-- reveal (navigation, suspended Safari, dropped response) — the child saw
-- "nothing" though the coins landed. The grant was always atomic and safe;
-- only the STORY was lost. Now a repeat call returns what today's chest
-- contained, so the client can replay the reveal any time that day.
-- ============================================================================

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
    -- replay: tell the client what today's chest already contained
    select e.payload->>'kind', (e.payload->>'bonus')::int into kind, bonus
      from public.events e
     where e.child_id = p.id and e.type = 'chest_opened'
       and e.created_at >= today::timestamptz
     order by e.created_at desc limit 1;
    return jsonb_build_object('already_opened', true, 'kind', kind, 'bonus', bonus);
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
