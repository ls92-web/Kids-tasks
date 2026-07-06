-- Companion unlock rules move server-side. bond_companion now enforces:
--   1. only heroes bond, and only when they have NO active partner
--      (which in turn is only possible after complete_legend, i.e. the
--      previous partner reached level 100)
--   2. a species that is still locked for this hero cannot be bonded
--   3. a Legend (or any previously bonded species) cannot be re-bonded
-- The client-side speciesUnlocked() in game.ts remains for display only;
-- the two rule tables must stay in sync.

-- Hero level from xp — mirrors levelFromXp() in src/lib/game.ts
-- (xpForNext(level) = 100 + (level-1)*60, capped at 99).
create or replace function public.hero_level(p_xp integer)
returns integer
language plpgsql
immutable
as $$
declare
  lvl int := 1;
  rem int := greatest(0, coalesce(p_xp, 0));
  step int;
begin
  loop
    step := 100 + (lvl - 1) * 60;
    exit when rem < step or lvl >= 99;
    rem := rem - step;
    lvl := lvl + 1;
  end loop;
  return lvl;
end $$;

create or replace function public.bond_companion(p_species text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  me public.profiles%rowtype;
  lvl integer;
  awakened boolean;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found or me.role <> 'child' then
    raise exception 'only heroes can bond a companion';
  end if;
  if p_species not in ('dragon','fox','owl','wolf','tiger','phoenix','turtle','forest','robot','ninja','samurai','pirate') then
    raise exception 'unknown companion';
  end if;

  -- one partner at a time; a new bond is only possible after the current
  -- partner was sealed as a Legend (complete_legend requires level 100)
  if exists (select 1 from public.companions where child_id = me.id and status = 'active') then
    raise exception 'you already have an adventure partner';
  end if;

  -- Legends stay in the Hero Hall — a completed journey cannot restart
  if exists (select 1 from public.companions where child_id = me.id and species = p_species) then
    raise exception 'this companion has already completed their journey with you';
  end if;

  -- unlock rules — mirrors COMPANION_UNLOCKS in src/lib/game.ts
  -- (world completions: ninja map ends at 36 quests, samurai 72, speed 108)
  lvl := public.hero_level(me.xp);
  awakened := case p_species
    when 'dragon'  then true                            -- starter
    when 'fox'     then true                            -- starter
    when 'turtle'  then true                            -- starter
    when 'owl'     then lvl >= 10
    when 'tiger'   then lvl >= 25
    when 'phoenix' then lvl >= 40
    when 'forest'  then me.tasks_completed >= 25
    when 'wolf'    then me.tasks_completed >= 50
    when 'pirate'  then me.total_coins_earned >= 1000
    when 'ninja'   then me.tasks_completed >= 36        -- Shadow Ninja Village complete
    when 'samurai' then me.tasks_completed >= 72        -- Legend of the Samurai complete
    when 'robot'   then me.tasks_completed >= 108       -- Speed Realm complete
    else false
  end;
  if not awakened then
    raise exception 'this companion has not awakened yet';
  end if;

  insert into public.companions (child_id, family_id, species, status)
  values (me.id, me.family_id, p_species, 'active');

  -- profiles.pet mirrors the active partner so every existing screen keeps working
  update public.profiles set pet = p_species where id = me.id;

  return jsonb_build_object('bonded', true, 'species', p_species);
end $$;
