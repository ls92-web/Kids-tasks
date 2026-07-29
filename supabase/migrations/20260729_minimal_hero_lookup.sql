-- ============================================================================
-- Public hero lookup, minimized (approved safeguard #4)
-- ----------------------------------------------------------------------------
-- family_heroes(code) used to expose every child's USERNAME to anyone holding
-- the family code. The picker only needs display data, so it now returns an
-- opaque profile id + nickname + companion. The username (needed to build the
-- login email) is resolved one hero at a time, at PIN-entry time, via
-- family_hero_login(code, hero_id) — the code remains the credential, but a
-- lookup no longer enumerates every login name in the family.
-- ============================================================================

create or replace function public.family_heroes(p_code text)
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
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
           jsonb_build_object('id', id, 'nickname', nickname, 'pet', pet)
           order by created_at), '[]'::jsonb)
    into heroes
    from public.profiles
   where family_id = fam and role = 'child' and status = 'active';
  return jsonb_build_object('found', true, 'heroes', heroes);
end $$;

create or replace function public.family_hero_login(p_code text, p_hero_id uuid)
returns jsonb
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  fam uuid;
  uname text;
begin
  select id into fam from public.families
   where code = public.normalize_family_code(p_code);
  if not found then return jsonb_build_object('found', false); end if;
  select username into uname
    from public.profiles
   where id = p_hero_id and family_id = fam and role = 'child' and status = 'active';
  if uname is null then return jsonb_build_object('found', false); end if;
  return jsonb_build_object('found', true, 'username', uname);
end $$;
