-- ============================================================================
-- Child join approval + hero-picker login (approved onboarding rework)
-- ----------------------------------------------------------------------------
-- Children who join with the Family Code no longer become active instantly:
-- they are created with profiles.status = 'pending_approval' and wait for a
-- parent to approve them. Children a parent creates directly stay active
-- immediately, and every pre-existing row defaults to 'active' — nothing
-- about current families changes.
--
-- Also adds two anon-callable, minimal-info lookups that power the new
-- onboarding wizard and the "Choose Your Hero" login picker. The Family Code
-- is already the join credential, so gating these on the code adds no new
-- exposure; they return only name/crest and active heroes' display data.
--
-- Approval writes an event row ('child_approved') — the clean hook for
-- future notifications without touching this flow again.
-- ============================================================================

-- ---- profiles: approval state ----------------------------------------------
alter table public.profiles add column if not exists status text not null default 'active';
alter table public.profiles add column if not exists approved_at timestamptz;
alter table public.profiles add column if not exists approved_by uuid;
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check
  check (status in ('pending_approval', 'active', 'rejected'));

-- ---- children cannot touch their own approval state ------------------------
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if current_user = 'authenticated' and not public.is_parent() then
    new.xp := old.xp;
    new.coins := old.coins;
    new.role := old.role;
    new.family_id := old.family_id;
    new.streak_days := old.streak_days;
    new.last_streak_date := old.last_streak_date;
    new.tasks_completed := old.tasks_completed;
    new.total_coins_earned := old.total_coins_earned;
    new.last_chest_date := old.last_chest_date;
    new.status := old.status;
    new.approved_at := old.approved_at;
    new.approved_by := old.approved_by;
  end if;
  return new;
end $function$;

-- ---- signup trigger: honour a pending status from join-family --------------
-- Only 'pending_approval' is accepted from metadata; anything else (including
-- absent — the parent create-child path and parent signup) stays 'active'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role text := coalesce(meta->>'role', 'parent');
  v_status text := case when meta->>'status' = 'pending_approval'
                        then 'pending_approval' else 'active' end;
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

  insert into public.profiles (id, family_id, role, username, nickname, avatar, character_class, pet, status)
  values (
    new.id, v_family, v_role,
    meta->>'username',
    coalesce(meta->>'nickname', case when v_role = 'parent' then 'Guild Master' else 'Adventurer' end),
    coalesce(meta->>'avatar', 'fox'),
    coalesce(meta->>'character_class', 'shadow_warrior'),
    coalesce(meta->>'pet', 'dragon'),
    case when v_role = 'child' then v_status else 'active' end
  );

  -- A hero's first companion is bonded the moment they join.
  if v_role = 'child' then
    insert into public.companions (child_id, family_id, species, status)
    values (new.id, v_family, coalesce(meta->>'pet', 'dragon'), 'active')
    on conflict (child_id, species) do nothing;
  end if;

  return new;
end $function$;

-- ---- pending children see only their own profile ---------------------------
create or replace function public.my_status()
returns text
language sql
stable
security definer
set search_path to 'public'
as $$ select status from public.profiles where id = auth.uid() $$;

drop policy if exists "family members read profiles" on public.profiles;
create policy "family members read profiles" on public.profiles
for select using (
  id = auth.uid()
  or (family_id = public.my_family_id() and (public.is_parent() or public.my_status() = 'active'))
);

-- ---- parent approval -------------------------------------------------------
create or replace function public.approve_child(p_child uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c public.profiles%rowtype;
begin
  if not public.is_parent() then raise exception 'not allowed'; end if;
  select * into c from public.profiles
   where id = p_child and family_id = public.my_family_id()
     and role = 'child' and status = 'pending_approval'
   for update;
  if not found then raise exception 'no pending hero found'; end if;

  update public.profiles
     set status = 'active', approved_at = now(), approved_by = auth.uid()
   where id = p_child;

  -- notification-ready: future push/reminder systems subscribe to events
  insert into public.events (family_id, child_id, type, payload)
  values (c.family_id, c.id, 'child_approved',
          jsonb_build_object('nickname', c.nickname, 'pet', c.pet));
end $function$;

create or replace function public.reject_child(p_child uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  c public.profiles%rowtype;
begin
  if not public.is_parent() then raise exception 'not allowed'; end if;
  select * into c from public.profiles
   where id = p_child and family_id = public.my_family_id()
     and role = 'child' and status = 'pending_approval'
   for update;
  if not found then raise exception 'no pending hero found'; end if;

  update public.profiles
     set status = 'rejected', approved_at = now(), approved_by = auth.uid()
   where id = p_child;
end $function$;

-- ---- anon-callable lookups for the wizard + hero picker --------------------
-- Normalizes the code the way kids type it (qf7x92, qf-7x92, QF 7X92 …).
create or replace function public.normalize_family_code(p_code text)
returns text
language sql
immutable
as $$
  select case
    when length(regexp_replace(regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g'), '^QF', '')) = 4
    then 'QF-' || regexp_replace(regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g'), '^QF', '')
    else null
  end
$$;

-- "Family Found ✨" — returns only the family's display name and crest.
create or replace function public.lookup_family_by_code(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  f record;
begin
  select name, crest into f
    from public.families
   where code = public.normalize_family_code(p_code);
  if not found then
    return jsonb_build_object('found', false);
  end if;
  return jsonb_build_object('found', true, 'name', f.name, 'crest', f.crest);
end $function$;

-- "Choose Your Hero" — active heroes' display data only (no ids, no email,
-- no parent info). The username is required to sign in, and signing in still
-- needs the hero's PIN.
create or replace function public.family_heroes(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  fam uuid;
  heroes jsonb;
begin
  select id into fam from public.families
   where code = public.normalize_family_code(p_code);
  if not found then
    return jsonb_build_object('found', false);
  end if;
  select coalesce(jsonb_agg(
           jsonb_build_object('username', username, 'nickname', nickname, 'pet', pet)
           order by created_at), '[]'::jsonb)
    into heroes
    from public.profiles
   where family_id = fam and role = 'child' and status = 'active';
  return jsonb_build_object('found', true, 'heroes', heroes);
end $function$;
