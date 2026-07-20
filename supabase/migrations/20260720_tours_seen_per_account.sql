-- ============================================================================
-- Guide tours: seen-once per ACCOUNT, not per device
-- ----------------------------------------------------------------------------
-- The onboarding tours / companion coach beats used to be gated only by
-- localStorage, so every new device or browser replayed them. The seen flags
-- now also persist on the profile; the app seeds localStorage from this
-- column at session load and appends here whenever a tour completes.
-- tours_seen is deliberately NOT in guard_profile_update's strip list —
-- it's cosmetic per-user state a child may update on their own row.
-- ============================================================================

alter table public.profiles add column if not exists tours_seen text[] not null default '{}';

create or replace function public.mark_tour_seen(p_tour text)
returns void
language sql
set search_path to 'public'
as $$
  update public.profiles
     set tours_seen = array_append(tours_seen, p_tour)
   where id = auth.uid()
     and char_length(coalesce(p_tour, '')) between 1 and 40
     and not (p_tour = any(tours_seen));
$$;
