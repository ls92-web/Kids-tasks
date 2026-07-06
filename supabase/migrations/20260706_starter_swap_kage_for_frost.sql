-- Starter roster change: Kage (ninja) becomes a starter; Frost (fox) moves to
-- the Shadow Ninja Village completion reward. Mirrors COMPANION_UNLOCKS in
-- src/lib/game.ts — keep both in sync.

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
    when 'ninja'   then true                            -- starter
    when 'turtle'  then true                            -- starter
    when 'owl'     then lvl >= 10
    when 'tiger'   then lvl >= 25
    when 'phoenix' then lvl >= 40
    when 'forest'  then me.tasks_completed >= 25
    when 'wolf'    then me.tasks_completed >= 50
    when 'pirate'  then me.total_coins_earned >= 1000
    when 'fox'     then me.tasks_completed >= 36        -- Shadow Ninja Village complete
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
