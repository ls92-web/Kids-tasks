-- The Legend Ceremony's reward beat becomes real: sealing a Legend grants a
-- coin bonus, awarded server-side exactly once (the status flip guards it).

create or replace function public.legend_reward_coins()
returns integer language sql immutable as $$ select 250 $$;

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

  -- the ceremony's treasure: a one-time bonus for finishing the adventure
  update public.profiles
     set coins = coins + bonus,
         total_coins_earned = total_coins_earned + bonus
   where id = c.child_id;

  insert into public.events (family_id, child_id, type, payload)
  values (c.family_id, c.child_id, 'companion_legend',
          jsonb_build_object('species', c.species, 'xp', c.xp,
                             'quests_done', c.quests_done, 'reward', bonus));

  return jsonb_build_object('legend', true, 'species', c.species, 'reward', bonus);
end $$;
