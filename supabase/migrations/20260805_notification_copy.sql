-- ============================================================================
-- Notifications say WHAT happened, to WHOM, and where tapping lands
-- ----------------------------------------------------------------------------
-- The fan-out used to write one static string per event type ("Your quest was
-- approved!") even though the event payloads already carried the quest title,
-- wish name and achievement name — so every push read like a form letter.
-- This keeps the exact same architecture (events → enqueue_notifications →
-- outbox → send-push) and only upgrades what the ONE copy mapper produces:
--
--   * specific copy: child nickname + quoted quest/wish/treasure/achievement
--     names, with a safe per-event fallback when a title is unavailable
--   * deep links: the closest real route (a child's own quest page, the
--     parent review queue focused on the submission, the wish opened in its
--     review card) instead of section-level pages
--   * stable tags (submission-review:<id>, wish-granted:<id>, …) so a
--     re-sent or updated alert replaces its sibling instead of stacking,
--     while unrelated alerts never replace each other
--   * diagnosable fallbacks: fallback_reason records WHY copy degraded
--     (missing title, unknown event type) right on the delivery row
--
-- Lock-screen privacy is unchanged: nickname + item titles only. Never proof
-- images, rejection reasons, coin balances or family codes.
-- ============================================================================

alter table public.notification_deliveries
  add column if not exists tag text,
  add column if not exists fallback_reason text;

create or replace function public.enqueue_notifications()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_title text; v_body text; v_dest text; v_tag text;
  v_reason text; -- why copy fell back, for diagnosis; null = fully specific
  v_to_parents boolean := false; v_to_child boolean := false;
  v_nick text;
  v_item text;   -- the quoted thing: quest / wish / treasure / achievement
  v_task uuid; v_req uuid;
begin
  select nickname into v_nick from public.profiles where id = new.child_id;

  if new.type = 'push_test' then
    -- direct delivery to one explicit recipient — no domain meaning
    insert into public.notification_deliveries
      (event_id, family_id, recipient_user_id, recipient_role, title, body, destination, tag)
    select new.id, new.family_id, p.id, p.role,
           'WonderNest is connected! ✨',
           'Notifications are working on this device.',
           case when p.role = 'parent' then '/admin' else '/app' end,
           'push-test'
      from public.profiles p
     where p.id = (new.payload->>'recipient_user_id')::uuid
        on conflict (event_id, recipient_user_id) do nothing;
    return new;

  elsif new.type = 'child_join_requested' then
    v_title := 'New hero wants to join';
    v_body  := coalesce(v_nick || ' is waiting for your approval.',
                        'A new hero is waiting for your approval.');
    if v_nick is null then v_reason := 'nickname unavailable'; end if;
    v_dest  := '/admin/children';
    v_tag   := 'join-request:' || coalesce(new.child_id::text, new.id::text);
    v_to_parents := true;

  elsif new.type = 'submission_waiting' then
    v_task := (new.payload->>'task_id')::uuid;
    select title into v_item from public.tasks where id = v_task;
    v_title := 'Quest ready for review';
    v_body  := coalesce(v_nick, 'Your hero')
               || coalesce(' completed “' || v_item || '.” Tap to review it.',
                           ' completed a quest. Tap to review it.');
    if v_item is null then v_reason := 'quest title unavailable'; end if;
    v_dest  := '/admin/review'
               || coalesce('?submission=' || (new.payload->>'submission_id'), '');
    v_tag   := 'submission-review:' || coalesce(new.payload->>'submission_id', new.id::text);
    v_to_parents := true;

  elsif new.type = 'reward_purchased' then
    v_item  := new.payload->>'reward';
    v_title := 'Reward claimed 🎁';
    v_body  := coalesce(v_nick, 'Your hero')
               || coalesce(' claimed “' || v_item || '” — time to make it real.',
                           ' claimed a reward — time to make it real.');
    if v_item is null then v_reason := 'reward name unavailable'; end if;
    v_dest  := '/admin/rewards';
    v_tag   := 'reward-claimed:' || new.id::text;
    v_to_parents := true;

  elsif new.type = 'reward_wished' then
    v_req := (new.payload->>'request_id')::uuid;
    select name into v_item from public.reward_requests where id = v_req;
    v_title := 'New wish request';
    v_body  := coalesce(v_nick, 'Your hero')
               || coalesce(' wished for “' || v_item || '.” Tap to review the wish.',
                           ' made a new wish. Tap to review it.');
    if v_item is null then v_reason := 'wish name unavailable'; end if;
    v_dest  := '/admin/rewards' || coalesce('?wish=' || v_req::text, '');
    v_tag   := 'wish-request:' || coalesce(v_req::text, new.id::text);
    v_to_parents := true;

  elsif new.type = 'child_approved' then
    v_title := 'Welcome, hero!';
    v_body  := 'Your family said yes — your adventure begins!';
    v_dest  := '/app';
    v_tag   := 'join-approved:' || coalesce(new.child_id::text, new.id::text);
    v_to_child := true;

  elsif new.type = 'quest_assigned' then
    v_task := (new.payload->>'task_id')::uuid;
    v_item := new.payload->>'title';
    v_title := 'A new adventure awaits! ⚔️';
    v_body  := coalesce('“' || v_item || '” has been added to your quests.',
                        'A new quest is waiting for you.');
    if v_item is null then v_reason := 'quest title unavailable'; end if;
    v_dest  := coalesce('/app/quest/' || v_task::text, '/app');
    v_tag   := 'quest-assigned:' || coalesce(v_task::text, new.id::text);
    v_to_child := true;

  elsif new.type = 'task_completed' then
    v_item := new.payload->>'title';
    v_title := 'Quest approved! ✨';
    v_body  := coalesce('Amazing work! “' || v_item || '” was approved.',
                        'Amazing work! Your quest was approved.');
    if v_item is null then v_reason := 'quest title unavailable'; end if;
    v_dest  := '/app';
    v_tag   := 'quest-approved:' || coalesce(new.payload->>'task_id', new.id::text);
    v_to_child := true;

  elsif new.type = 'submission_rejected' then
    v_task := (new.payload->>'task_id')::uuid;
    select title into v_item from public.tasks where id = v_task;
    v_title := 'Your quest needs another try';
    -- deliberately NO parent feedback text on the lock screen
    v_body  := coalesce('You''re almost there! Open “' || v_item || '” and try again.',
                        'You''re almost there! Open your quest and try again.');
    if v_item is null then v_reason := 'quest title unavailable'; end if;
    v_dest  := coalesce('/app/quest/' || v_task::text, '/app');
    v_tag   := 'quest-retry:' || coalesce(v_task::text, new.id::text);
    v_to_child := true;

  elsif new.type = 'wish_approved' then
    v_item := new.payload->>'name';
    v_title := 'Your wish was granted! 🎉';
    v_body  := coalesce('“' || v_item || '” has been approved. Come check it out!',
                        'Your wish was granted. Come check it out!');
    if v_item is null then v_reason := 'wish name unavailable'; end if;
    v_dest  := '/app/shop';
    v_tag   := 'wish-granted:' || coalesce(new.payload->>'request_id', new.id::text);
    v_to_child := true;

  elsif new.type = 'wish_declined' then
    -- gentle, and deliberately reason-free on the lock screen
    v_title := 'Wish update';
    v_body  := 'Your wish wasn''t approved this time. Come see what''s next.';
    v_dest  := '/app/shop';
    v_tag   := 'wish-update:' || coalesce(new.payload->>'request_id', new.id::text);
    v_to_child := true;

  elsif new.type = 'reward_granted' then
    v_item := new.payload->>'reward_name';
    v_title := 'Treasure delivered! 🎁';
    v_body  := coalesce('“' || v_item || '” is yours — enjoy it!',
                        'Your treasure is ready — enjoy it!');
    if v_item is null then v_reason := 'reward name unavailable'; end if;
    v_dest  := '/app/shop';
    v_tag   := 'reward-granted:' || coalesce(new.payload->>'redemption_id', new.id::text);
    v_to_child := true;

  elsif new.type = 'achievement_unlocked' then
    v_item := new.payload->>'title';
    v_title := 'Achievement unlocked! 🏆';
    v_body  := coalesce('You earned “' || v_item || '.” Come celebrate!',
                        'You unlocked a new achievement. Come celebrate!');
    if v_item is null then v_reason := 'achievement title unavailable'; end if;
    v_dest  := '/app/character';
    v_tag   := 'achievement:' || coalesce(new.payload->>'key', new.id::text);
    v_to_child := true;

  elsif new.type in ('chest_opened', 'challenge_won', 'companion_legend',
                     'companion_evolved', 'level_up', 'world_unlocked',
                     'campaign_complete') then
    return new; -- known in-app-only moments: celebrated inside the app, never pushed

  else
    -- genuinely unknown event type: the LAST-RESORT generic notification.
    -- fallback_reason makes every use findable so the mapping can be fixed.
    v_title := 'WonderNest update';
    v_body  := 'Open WonderNest to see what''s new.';
    v_dest  := case when new.child_id is not null then '/app' else '/admin' end;
    v_tag   := 'update:' || new.id::text;
    v_reason := 'unknown event type: ' || new.type;
    if new.child_id is not null then v_to_child := true; else v_to_parents := true; end if;
    raise log 'notification fallback for event % (type %)', new.id, new.type;
  end if;

  if v_to_parents then
    insert into public.notification_deliveries
      (event_id, family_id, recipient_user_id, recipient_role,
       title, body, destination, tag, fallback_reason)
    select new.id, new.family_id, p.id, 'parent', v_title, v_body, v_dest, v_tag, v_reason
      from public.profiles p
     where p.family_id = new.family_id and p.role = 'parent'
        on conflict (event_id, recipient_user_id) do nothing;
  end if;
  if v_to_child and new.child_id is not null then
    insert into public.notification_deliveries
      (event_id, family_id, recipient_user_id, recipient_role,
       title, body, destination, tag, fallback_reason)
    values (new.id, new.family_id, new.child_id, 'child', v_title, v_body, v_dest, v_tag, v_reason)
        on conflict (event_id, recipient_user_id) do nothing;
  end if;
  return new;
exception when others then
  return new; -- notifications are best-effort, never break the domain write
end $$;
