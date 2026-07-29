-- ============================================================================
-- Web Push foundation: subscriptions + delivery outbox on top of `events`
-- ----------------------------------------------------------------------------
-- Separation of concerns (approved design):
--   events                  = the PERMANENT domain log (already existed; gains
--                             a few missing domain facts via tiny triggers)
--   notification_deliveries = the OUTBOX: who to tell about an event + the
--                             delivery state machine. References events(id).
--   push_subscriptions      = one row per device the user said yes on.
--
-- Every trigger here is BEST-EFFORT: an exception in notification plumbing
-- must never roll back an approval, quest, reward or achievement write.
-- Enqueue is durable: delivery rows commit with the domain change; the
-- sweeper retries anything a transient send failure leaves behind.
-- ============================================================================

-- ---------- push subscriptions --------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  user_role text not null check (user_role in ('parent','child')),
  endpoint text not null unique,
  p256dh_key text not null,
  auth_key text not null,
  platform text,
  device_label text,
  enabled boolean not null default true,
  failure_count integer not null default 0,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- owners manage ONLY their own devices; nobody can read anyone else's
-- endpoint or keys (service role bypasses RLS for sending)
drop policy if exists "own subscriptions" on public.push_subscriptions;
create policy "own subscriptions" on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- upsert path for re-subscribes: same endpoint, refreshed keys
create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text,
  p_platform text default null, p_device_label text default null
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare me public.profiles%rowtype;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then raise exception 'no profile'; end if;
  insert into public.push_subscriptions
    (family_id, user_id, user_role, endpoint, p256dh_key, auth_key, platform, device_label)
  values (me.family_id, me.id, me.role, p_endpoint, p_p256dh, p_auth, p_platform, p_device_label)
  on conflict (endpoint) do update set
    family_id = excluded.family_id,
    user_id = excluded.user_id,
    user_role = excluded.user_role,
    p256dh_key = excluded.p256dh_key,
    auth_key = excluded.auth_key,
    platform = excluded.platform,
    device_label = excluded.device_label,
    enabled = true,
    failure_count = 0,
    updated_at = now();
  return jsonb_build_object('saved', true);
end $$;

-- ---------- delivery outbox -------------------------------------------------
create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  family_id uuid not null,
  recipient_user_id uuid not null,
  recipient_role text not null,
  title text not null,
  body text not null,
  destination text not null,
  status text not null default 'queued'
    check (status in ('queued','sent','failed','dead','skipped')),
  attempts integer not null default 0,
  last_error text,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, recipient_user_id)
);
create index if not exists notification_deliveries_queue
  on public.notification_deliveries (status, scheduled_for)
  where status in ('queued','failed');

alter table public.notification_deliveries enable row level security;
-- no client policies: the outbox is service-role-only territory

-- ---------- fan-out: events → deliveries (THE one place notifications
-- are born; copy follows the approved launch scope) -------------------------
create or replace function public.enqueue_notifications()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_title text; v_body text; v_dest text;
  v_to_parents boolean := false; v_to_child boolean := false;
  v_nick text;
begin
  select nickname into v_nick from public.profiles where id = new.child_id;
  v_nick := coalesce(v_nick, 'Your hero');

  if new.type = 'child_join_requested' then
    v_title := 'A new hero at the gate';
    v_body  := 'A new hero wants to join your WonderNest family.';
    v_dest  := '/admin/children';
    v_to_parents := true;
  elsif new.type = 'submission_waiting' then
    v_title := 'Quest ready for review';
    v_body  := v_nick || ' finished a quest — it''s ready for your review.';
    v_dest  := '/admin/review';
    v_to_parents := true;
  elsif new.type in ('reward_purchased', 'reward_wished') then
    v_title := 'Reward decision waiting';
    v_body  := v_nick || case when new.type = 'reward_purchased'
                 then ' claimed a reward — time to make it real.'
                 else ' wished for something new.' end;
    v_dest  := '/admin/rewards';
    v_to_parents := true;
  elsif new.type = 'child_approved' then
    v_title := 'Welcome, hero!';
    v_body  := 'Your hero has been approved. Your adventure can begin!';
    v_dest  := '/app';
    v_to_child := true;
  elsif new.type = 'task_completed' then
    v_title := 'Quest approved! ✨';
    v_body  := 'Amazing! Your quest was approved.';
    v_dest  := '/app';
    v_to_child := true;
  elsif new.type = 'submission_rejected' then
    v_title := 'One more try';
    v_body  := 'Your quest needs another try. You can do it!';
    v_dest  := '/app';
    v_to_child := true;
  elsif new.type = 'reward_granted' then
    v_title := 'Treasure delivered! 🎁';
    v_body  := 'Your reward has been approved!';
    v_dest  := '/app/shop';
    v_to_child := true;
  elsif new.type = 'achievement_unlocked' then
    v_title := 'New badge earned! 🏅';
    v_body  := 'You unlocked a new achievement!';
    v_dest  := '/app/character';
    v_to_child := true;
  else
    return new; -- chest_opened, companion_legend, challenge_won… in-app only
  end if;

  if v_to_parents then
    insert into public.notification_deliveries
      (event_id, family_id, recipient_user_id, recipient_role, title, body, destination)
    select new.id, new.family_id, p.id, 'parent', v_title, v_body, v_dest
      from public.profiles p
     where p.family_id = new.family_id and p.role = 'parent'
        on conflict (event_id, recipient_user_id) do nothing;
  end if;
  if v_to_child and new.child_id is not null then
    insert into public.notification_deliveries
      (event_id, family_id, recipient_user_id, recipient_role, title, body, destination)
    values (new.id, new.family_id, new.child_id, 'child', v_title, v_body, v_dest)
        on conflict (event_id, recipient_user_id) do nothing;
  end if;
  return new;
exception when others then
  return new; -- notifications are best-effort, never break the domain write
end $$;

drop trigger if exists trg_enqueue_notifications on public.events;
create trigger trg_enqueue_notifications
  after insert on public.events
  for each row execute function public.enqueue_notifications();

-- ---------- missing domain facts → events (tiny best-effort triggers) ------
-- Every function swallows its own errors: the domain write always wins.

create or replace function public.log_submission_waiting()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  if new.status = 'needs_review' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.events (family_id, child_id, type, payload)
    values (new.family_id, new.child_id, 'submission_waiting',
            jsonb_build_object('submission_id', new.id, 'task_id', new.task_id));
  elsif tg_op = 'UPDATE' and new.status = 'rejected' and old.status is distinct from new.status then
    insert into public.events (family_id, child_id, type, payload)
    values (new.family_id, new.child_id, 'submission_rejected',
            jsonb_build_object('submission_id', new.id, 'task_id', new.task_id));
  end if;
  return new;
exception when others then return new;
end $$;

drop trigger if exists trg_log_submission_waiting on public.submissions;
create trigger trg_log_submission_waiting
  after insert or update of status on public.submissions
  for each row execute function public.log_submission_waiting();

create or replace function public.log_join_requested()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  if new.role = 'child' and new.status = 'pending_approval' and new.family_id is not null then
    insert into public.events (family_id, child_id, type, payload)
    values (new.family_id, new.id, 'child_join_requested',
            jsonb_build_object('profile_id', new.id));
  end if;
  return new;
exception when others then return new;
end $$;

drop trigger if exists trg_log_join_requested on public.profiles;
create trigger trg_log_join_requested
  after insert on public.profiles
  for each row execute function public.log_join_requested();

create or replace function public.log_reward_wished()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  insert into public.events (family_id, child_id, type, payload)
  values (new.family_id, new.child_id, 'reward_wished',
          jsonb_build_object('request_id', new.id));
  return new;
exception when others then return new;
end $$;

drop trigger if exists trg_log_reward_wished on public.reward_requests;
create trigger trg_log_reward_wished
  after insert on public.reward_requests
  for each row execute function public.log_reward_wished();

create or replace function public.log_reward_granted()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  if new.status = 'granted' and old.status is distinct from new.status then
    insert into public.events (family_id, child_id, type, payload)
    values (new.family_id, new.child_id, 'reward_granted',
            jsonb_build_object('redemption_id', new.id, 'reward_name', new.reward_name));
  end if;
  return new;
exception when others then return new;
end $$;

drop trigger if exists trg_log_reward_granted on public.redemptions;
create trigger trg_log_reward_granted
  after update of status on public.redemptions
  for each row execute function public.log_reward_granted();

create or replace function public.log_achievement_unlocked()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  insert into public.events (family_id, child_id, type, payload)
  values (new.family_id, new.child_id, 'achievement_unlocked',
          jsonb_build_object('key', new.key, 'title', new.title));
  return new;
exception when others then return new;
end $$;

drop trigger if exists trg_log_achievement_unlocked on public.achievements;
create trigger trg_log_achievement_unlocked
  after insert on public.achievements
  for each row execute function public.log_achievement_unlocked();
