-- A hero's name is chosen once, at the start of the adventure. Children can
-- no longer change their own nickname (or login username) — the guard trigger
-- reverts those fields on any child self-update, exactly like XP/coins.
-- Parents keep full control: the is_parent() branch is untouched, and the
-- Heroes page gains a Rename control for fixing typos.

create or replace function public.guard_profile_update()
returns trigger
language plpgsql
set search_path to 'public'
as $$
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
    new.nickname := old.nickname;
    new.username := old.username;
  end if;
  return new;
end $$;
