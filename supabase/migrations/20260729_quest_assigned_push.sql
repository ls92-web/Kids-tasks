-- ============================================================================
-- quest_assigned: the child hears about a new adventure the moment a parent
-- assigns it — the exact scenario the owner tested and found silent.
-- Routine occurrences stay quiet (they'd spam at daily generation); only
-- parent-assigned one-off quests notify. Plus a 'push_test' event type so a
-- real end-to-end delivery can be exercised on demand without faking any
-- domain fact.
-- ============================================================================

create or replace function public.log_quest_assigned()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  if new.schedule_id is null and new.status = 'active'
     and new.created_by is distinct from new.child_id then
    insert into public.events (family_id, child_id, type, payload)
    values (new.family_id, new.child_id, 'quest_assigned',
            jsonb_build_object('task_id', new.id, 'title', new.title));
  end if;
  return new;
exception when others then return new;
end $$;

drop trigger if exists trg_log_quest_assigned on public.tasks;
create trigger trg_log_quest_assigned
  after insert on public.tasks
  for each row execute function public.log_quest_assigned();

-- fan-out gains quest_assigned (child) and push_test (explicit recipient)
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

  if new.type = 'push_test' then
    -- direct delivery to one explicit recipient — no domain meaning
    insert into public.notification_deliveries
      (event_id, family_id, recipient_user_id, recipient_role, title, body, destination)
    select new.id, new.family_id, p.id, p.role,
           'WonderNest is connected! ✨',
           'Notifications are working on this device.',
           case when p.role = 'parent' then '/admin' else '/app' end
      from public.profiles p
     where p.id = (new.payload->>'recipient_user_id')::uuid
        on conflict (event_id, recipient_user_id) do nothing;
    return new;
  elsif new.type = 'child_join_requested' then
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
  elsif new.type = 'quest_assigned' then
    v_title := 'New adventure! ⚔️';
    v_body  := 'A new adventure is waiting for you.';
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
  elsif new.type = 'wish_approved' then
    v_title := 'Wish granted! 🌟';
    v_body  := 'Your grown-up said yes to your wish — check the Treasure Vault!';
    v_dest  := '/app/shop';
    v_to_child := true;
  elsif new.type = 'wish_declined' then
    v_title := 'About your wish';
    v_body  := 'Your grown-up looked at your wish — come talk about it together.';
    v_dest  := '/app/shop';
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
