-- Adventure-game rework, backend foundation:
--   1. Families get a crest + shareable Family Code (QF-XXXX) for hero onboarding.
--   2. Companions become lifelong partners with their OWN xp/level and a
--      permanent collection (active -> legend, locked = no row yet).
--   3. Quest approval feeds the active companion's xp alongside the hero's.

-- ============================================================
-- 1. FAMILIES: crest + join code
-- ============================================================

alter table public.families add column if not exists crest text not null default 'shield';
alter table public.families add column if not exists code text;

-- Unambiguous alphabet: no I/L/O/0/1 so kids can read codes aloud.
create or replace function public.generate_family_code()
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  loop
    candidate := 'QF-' ||
      substr(alphabet, 1 + floor(random() * 31)::int, 1) ||
      substr(alphabet, 1 + floor(random() * 31)::int, 1) ||
      substr(alphabet, 1 + floor(random() * 31)::int, 1) ||
      substr(alphabet, 1 + floor(random() * 31)::int, 1);
    exit when not exists (select 1 from public.families where code = candidate);
  end loop;
  return candidate;
end $$;

-- Backfill existing families one row at a time so uniqueness checks see
-- each prior assignment.
do $$
declare f record;
begin
  for f in select id from public.families where code is null loop
    update public.families set code = public.generate_family_code() where id = f.id;
  end loop;
end $$;

alter table public.families alter column code set not null;
create unique index if not exists families_code_key on public.families (code);

-- ============================================================
-- 2. COMPANIONS: lifelong partners with their own progression
--    locked  = no row for that species yet
--    active  = the current adventure partner (max one per child)
--    legend  = completed at level 100, permanently in the Hero Hall
-- ============================================================

create table if not exists public.companions (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.profiles(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  species text not null,
  xp integer not null default 0,
  status text not null default 'active' check (status in ('active','legend')),
  bonded_at timestamptz not null default now(),
  legend_at timestamptz,
  unique (child_id, species)
);

create unique index if not exists companions_one_active
  on public.companions (child_id) where status = 'active';

alter table public.companions enable row level security;

drop policy if exists "family members read companions" on public.companions;
create policy "family members read companions" on public.companions
  for select using (family_id = public.my_family_id());
-- No insert/update policies: all writes go through security-definer functions.

-- Backfill: every existing child bonds with their current pet, carrying the
-- xp they already earned together (no one loses progress).
insert into public.companions (child_id, family_id, species, xp, status)
select p.id, p.family_id, p.pet, p.xp, 'active'
from public.profiles p
where p.role = 'child'
on conflict (child_id, species) do nothing;

-- ============================================================
-- 3. SIGNUP TRIGGER: parent signups carry crest; child signups bond
--    their first companion automatically.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role text := coalesce(meta->>'role', 'parent');
  v_family uuid;
begin
  if v_role = 'child' then
    v_family := (meta->>'family_id')::uuid;
  else
    insert into public.families (name, crest, code, created_by)
    values (
      coalesce(meta->>'family_name', 'My Family'),
      coalesce(meta->>'family_crest', 'shield'),
      public.generate_family_code(),
      new.id
    )
    returning id into v_family;
  end if;

  insert into public.profiles (id, family_id, role, username, nickname, avatar, character_class, pet)
  values (
    new.id, v_family, v_role,
    meta->>'username',
    coalesce(meta->>'nickname', case when v_role = 'parent' then 'Guild Master' else 'Adventurer' end),
    coalesce(meta->>'avatar', 'fox'),
    coalesce(meta->>'character_class', 'shadow_warrior'),
    coalesce(meta->>'pet', 'dragon')
  );

  -- A hero's first companion is bonded the moment they join.
  if v_role = 'child' then
    insert into public.companions (child_id, family_id, species, status)
    values (new.id, v_family, coalesce(meta->>'pet', 'dragon'), 'active')
    on conflict (child_id, species) do nothing;
  end if;

  return new;
end $$;

-- ============================================================
-- 4. BONDING + LEGEND RPCs
-- ============================================================

-- Total xp needed to reach companion level 100 with the shared curve
-- xpForNext(level) = 100 + (level-1)*60  =>  sum for levels 1..99 = 300960.
create or replace function public.legend_xp_threshold()
returns integer language sql immutable as $$ select 300960 $$;

-- Child picks a new partner — only allowed when they have NO active
-- companion (their first pick, or after a Legend Ceremony).
create or replace function public.bond_companion(p_species text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  me public.profiles%rowtype;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found or me.role <> 'child' then
    raise exception 'only heroes can bond a companion';
  end if;
  if p_species not in ('dragon','fox','owl','wolf','tiger','phoenix','turtle','forest','robot','ninja','samurai','pirate') then
    raise exception 'unknown companion';
  end if;
  if exists (select 1 from public.companions where child_id = me.id and status = 'active') then
    raise exception 'you already have an adventure partner';
  end if;
  if exists (select 1 from public.companions where child_id = me.id and species = p_species) then
    raise exception 'this companion has already completed their journey with you';
  end if;

  insert into public.companions (child_id, family_id, species, status)
  values (me.id, me.family_id, p_species, 'active');

  -- profiles.pet mirrors the active partner so every existing screen keeps working
  update public.profiles set pet = p_species where id = me.id;

  return jsonb_build_object('bonded', true, 'species', p_species);
end $$;

-- Completes the Legend Ceremony: the active companion (at level 100)
-- becomes a permanent Legend, freeing the child to bond a new partner.
create or replace function public.complete_legend()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  c public.companions%rowtype;
begin
  select * into c
  from public.companions
  where child_id = auth.uid() and status = 'active'
  for update;

  if not found then raise exception 'no active companion'; end if;
  if c.xp < public.legend_xp_threshold() then
    raise exception 'your companion has not reached Legend yet';
  end if;

  update public.companions
     set status = 'legend', legend_at = now()
   where id = c.id;

  insert into public.events (family_id, child_id, type, payload)
  values (c.family_id, c.child_id, 'companion_legend',
          jsonb_build_object('species', c.species, 'xp', c.xp));

  return jsonb_build_object('legend', true, 'species', c.species);
end $$;

-- ============================================================
-- 5. XP FLOW: quest approval + parent adjustments feed the
--    active companion alongside the hero.
-- ============================================================

create or replace function public.adjust_child(p_child_id uuid, p_coins integer, p_xp integer)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_parent() then raise exception 'not allowed'; end if;
  if (select family_id from public.profiles where id = p_child_id) <> public.my_family_id() then
    raise exception 'not your family';
  end if;
  update public.profiles set
    coins = greatest(0, coins + p_coins),
    xp = greatest(0, xp + p_xp)
  where id = p_child_id;
  -- the bonded companion grows (and shrinks) with the hero
  update public.companions set xp = greatest(0, xp + p_xp)
  where child_id = p_child_id and status = 'active';
end $$;
