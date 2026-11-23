-- Round 5: event management. Committees with roles and rights, committee meetings, thoughts and suggestions,
-- the committee-level budget review, numbered tickets (CH26-00125), registration and check-in teams,
-- the shared check-in link, and check-in by many people at once without double counting.
-- Also: departmental meetings with "Will you be there?". Safe to run more than once.

-- ---------- /door/<token> is the shared check-in link, so no church may use "door" as its address ----------
create or replace function slug_reserved(s text) returns boolean language sql immutable as $$
  select s = any (array['today','people','first-timers','welfare','attendance','classes','events','departments','finance','messages','settings',
    'activity','owner','login','signup','start','join','welcome','update','display','checkin','invite','api','c','e','admin','help','about',
    'pricing','privacy','terms','support','traqi','app','www','mail','static','public','auth','dashboard','door',
    'prayer','meeting','offline','icons','sw','share','tickets','ticket','register','demo'])
$$;

-- ---------- Who is who on an event ----------
-- The pastorate and the admin appoint committees.
create or replace function committee_picker(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_pastor(c) or exists (select 1 from role_assignments ra join roles r on r.id = ra.role_id
                                  where ra.church_id = c and ra.person_id = my_person(c) and r.key = 'admin')
$$;

-- Anyone on the event's committee (head, assistant, Finance Lead or member)
create or replace function on_committee(c uuid, ev text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from events e where e.church_id = c and e.id = ev and (
    my_person(c)::text in (e.data->'committee'->>'headId', e.data->'committee'->>'assistantId', e.data->'committee'->>'financeLeadId')
    or exists (select 1 from jsonb_array_elements(coalesce(e.data->'committee'->'members', '[]'::jsonb)) m where m->>'personId' = my_person(c)::text)))
$$;

-- May do this on the committee: the head and assistant may do everything; others only what they were given.
-- perm: team | meetings | landing | budget | checkin
create or replace function committee_can(c uuid, ev text, perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from events e where e.church_id = c and e.id = ev and (
    my_person(c)::text in (e.data->'committee'->>'headId', e.data->'committee'->>'assistantId')
    or (perm = 'budget' and e.data->'committee'->>'financeLeadId' = my_person(c)::text)
    or (perm = 'checkin' and e.data->>'regLeadId' = my_person(c)::text)
    or exists (select 1 from jsonb_array_elements(coalesce(e.data->'committee'->'members', '[]'::jsonb)) m
               where m->>'personId' = my_person(c)::text and coalesce(m->'perms', '[]'::jsonb) ? perm)))
$$;

-- On a follow-up, registration or check-in team: named, or in a chosen department (or one of its units)
create or replace function on_duty(c uuid, ev text, duty text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from events e where e.church_id = c and e.id = ev and (
    coalesce(e.data->'duties'->duty->'personIds', '[]'::jsonb) ? my_person(c)::text
    or exists (select 1 from group_members gm join groups g on g.id = gm.group_id
               where gm.church_id = c and gm.person_id = my_person(c)
                 and (coalesce(e.data->'duties'->duty->'groupIds', '[]'::jsonb) ? g.id::text
                      or coalesce(e.data->'duties'->duty->'groupIds', '[]'::jsonb) ? g.parent_id::text))))
$$;

-- May check people in at this event
create or replace function event_checkin_staff(c uuid, ev text) returns boolean
language sql stable security definer set search_path = public as $$
  select is_pastor(c) or has_perm(c, 'events.manage') or committee_can(c, ev, 'checkin') or committee_can(c, ev, 'landing') or on_duty(c, ev, 'checkin')
$$;

-- May change the event itself (its page, form, committee, meetings or teams)
create or replace function event_manager(c uuid, ev text) returns boolean
language sql stable security definer set search_path = public as $$
  select committee_can(c, ev, 'team') or committee_can(c, ev, 'meetings') or committee_can(c, ev, 'landing') or committee_can(c, ev, 'checkin')
$$;

-- ---------- Events: committee members see their event; committee managers can edit it ----------
drop policy if exists "read events" on events;
create policy "read events" on events for select using (is_church_member(church_id) and (status = 'published' or created_by = my_person(church_id)
  or has_perm(church_id, 'events.manage') or is_pastor(church_id) or committee_picker(church_id) or on_committee(church_id, id)));
drop policy if exists "edit events" on events;
create policy "edit events" on events for update using (has_perm(church_id, 'events.manage') or is_pastor(church_id) or committee_picker(church_id) or event_manager(church_id, id));
drop policy if exists "create events" on events;
create policy "create events" on events for insert with check (has_perm(church_id, 'events.manage') or is_pastor(church_id) or committee_picker(church_id));
-- (Publishing still needs a pastor: see events_publish_guard.)

-- ---------- Registrations: the committee and the teams can see them ----------
drop policy if exists "read registrations" on registrations;
create policy "read registrations" on registrations for select using (person_id = my_person(church_id) or has_perm(church_id, 'events.manage') or is_pastor(church_id)
  or on_committee(church_id, event_id) or on_duty(church_id, event_id, 'followup') or on_duty(church_id, event_id, 'registration') or committee_can(church_id, event_id, 'checkin'));
drop policy if exists "committee manages registrations" on registrations;
create policy "committee manages registrations" on registrations for update using (committee_can(church_id, event_id, 'landing') or committee_can(church_id, event_id, 'checkin'));

-- ---------- Numbered tickets: CH26-00125 ----------
-- The start of every ticket: the committee's choice, or the first two letters of the title and the year
create or replace function event_ticket_prefix(e events) returns text language sql immutable as $$
  select coalesce(nullif(regexp_replace(upper(coalesce(e.data->>'ticketPrefix', '')), '[^A-Z0-9]', '', 'g'), ''),
                  coalesce(upper(substring(e.data->>'title' from '[A-Za-z]{2}')), 'TQ') || substr(e.data->>'start', 3, 2))
$$;
-- The next number for this event. Callers hold the event's lock, so two people never get the same number.
create or replace function next_event_ticket(c uuid, e events) returns text
language plpgsql volatile security definer set search_path = public as $$
declare pre text := event_ticket_prefix(e); n int;
begin
  select coalesce(max(substring(data->>'ticket' from '-(\d+)$')::int), 0) + 1 into n
    from registrations where church_id = c and event_id = e.id and data->>'ticket' ~ ('^' || pre || '-\d+$');
  return pre || '-' || lpad(n::text, 5, '0');
end $$;

-- Any registration saved with a ticket another registration already has gets the next number instead
create or replace function registrations_unique_ticket() returns trigger
language plpgsql security definer set search_path = public as $$
declare e events;
begin
  if exists (select 1 from registrations r where r.church_id = new.church_id and r.event_id = new.event_id and r.id <> new.id
               and upper(r.data->>'ticket') = upper(new.data->>'ticket')) then
    select * into e from events where church_id = new.church_id and id = new.event_id;
    perform pg_advisory_xact_lock(hashtext(new.church_id::text || '|' || new.event_id));
    new.data := jsonb_set(new.data, '{ticket}', to_jsonb(next_event_ticket(new.church_id, e)));
  end if;
  return new;
end $$;
drop trigger if exists registrations_unique_ticket on registrations;
create trigger registrations_unique_ticket before insert on registrations for each row execute function registrations_unique_ticket();
create index if not exists registrations_event on registrations (church_id, event_id);

-- Registering: the same as before, with numbered tickets handed out one at a time per event
create or replace function register_event(p_slug text, p_event text, p_reg jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c uuid; e events; taken int; cap int; st text; tk text; rid text; lead_id text; pid uuid; o jsonb; i int := 0;
        key text := right(regexp_replace(coalesce(p_reg->>'phone', ''), '\D', '', 'g'), 10);
        out jsonb := '[]'::jsonb; okey text; others jsonb := coalesce(p_reg->'others', '[]'::jsonb);
begin
  if length(key) < 10 then raise exception 'Enter a valid phone number'; end if;
  if length(trim(coalesce(p_reg->>'name', ''))) < 2 then raise exception 'Enter your name'; end if;
  if jsonb_array_length(others) > 20 then raise exception 'You can register up to 20 people at once'; end if;
  select id into c from churches where slug = p_slug;
  select * into e from events where church_id = c and slug = p_event and status = 'published';
  if e.id is null then raise exception 'This event is not open for registration'; end if;
  if e.data->>'closesAt' is not null and now() > (e.data->>'closesAt')::timestamptz then raise exception 'Registration has closed'; end if;
  if (e.data->>'end') is not null and now() > (e.data->>'end')::timestamptz then raise exception 'This event has ended'; end if;
  -- One registration at a time for this event: places and ticket numbers stay exact
  perform pg_advisory_xact_lock(hashtext(c::text || '|' || e.id));

  -- Already registered: give back their tickets
  select id into lead_id from registrations
   where church_id = c and event_id = e.id and data->>'byRegId' is null and right(regexp_replace(data->>'phone', '\D', '', 'g'), 10) = key limit 1;
  if lead_id is not null then
    select jsonb_agg(jsonb_build_object('name', data->>'name', 'ticket', data->>'ticket', 'status', 'already') order by (data->>'byRegId') nulls first)
      into out from registrations where church_id = c and event_id = e.id and (id = lead_id or data->>'byRegId' = lead_id);
    return jsonb_build_object('status', 'already', 'ticket', out->0->>'ticket', 'tickets', out);
  end if;

  select coalesce(sum(1 + coalesce((data->>'guests')::int, 0)), 0) into taken from registrations where church_id = c and event_id = e.id and data->>'status' = 'confirmed';
  cap := nullif(e.data->>'capacity', '')::int;

  for o in select jsonb_build_object('name', p_reg->>'name', 'phone', p_reg->>'phone', 'email', p_reg->>'email', 'answers', coalesce(p_reg->'answers', '{}'::jsonb))
           union all select x from jsonb_array_elements(others) x loop
    if length(trim(coalesce(o->>'name', ''))) < 2 then raise exception 'Enter a name for everyone you register'; end if;
    st := case when coalesce((e.data->>'needsApproval')::boolean, false) then 'pending'
               when cap is not null and taken + 1 > cap then 'waitlist' else 'confirmed' end;
    if st = 'confirmed' then taken := taken + 1; end if;
    tk := next_event_ticket(c, e);
    rid := gen_random_uuid()::text;
    okey := right(regexp_replace(coalesce(nullif(o->>'phone', ''), case when i = 0 then p_reg->>'phone' end, ''), '\D', '', 'g'), 10);
    pid := null;
    if length(okey) = 10 then select id into pid from people where church_id = c and right(regexp_replace(phone, '\D', '', 'g'), 10) = okey limit 1; end if;
    insert into registrations (id, church_id, event_id, person_id, data)
    values (rid, c, e.id, pid, jsonb_build_object(
      'id', rid, 'eventId', e.id, 'personId', pid, 'name', trim(o->>'name'),
      'phone', coalesce(nullif(o->>'phone', ''), p_reg->>'phone'), 'email', nullif(lower(trim(o->>'email')), ''),
      'guests', 0, 'days', coalesce(p_reg->'days', '[]'::jsonb), 'answers', coalesce(o->'answers', '{}'::jsonb),
      'type', coalesce(p_reg->>'type', 'individual'), 'byRegId', lead_id,
      'ticket', tk, 'status', st, 'checkins', '[]'::jsonb, 'sessions', '[]'::jsonb, 'checkinLog', '[]'::jsonb, 'at', now()));
    if i = 0 then lead_id := rid; end if;
    out := out || jsonb_build_object('name', trim(o->>'name'), 'ticket', tk, 'status', st);
    i := i + 1;
  end loop;
  return jsonb_build_object('status', out->0->>'status', 'ticket', out->0->>'ticket', 'tickets', out);
end $$;
grant execute on function register_event(text, text, jsonb) to anon, authenticated;

-- ---------- Check-in: many people at many doors, one record ----------
create or replace function lagos_today() returns text language sql stable as $$ select to_char(now() at time zone 'Africa/Lagos', 'YYYY-MM-DD') $$;

-- What the door sees: enough to recognise someone, with phone and email partly hidden
create or replace function door_reg(r registrations, p_day text, p_session text) returns jsonb
language sql stable security definer set search_path = public as $$
  with m as (select x from jsonb_array_elements(coalesce(r.data->'checkinLog', '[]'::jsonb)) with ordinality t(x, n)
             where x->>'day' = p_day and (p_session is null or x->>'session' = p_session) order by n desc limit 1),
       inn as (select coalesce(r.data->'checkins', '[]'::jsonb) ? p_day and (p_session is null or coalesce(r.data->'sessions', '[]'::jsonb) ? p_session) as yes)
  select jsonb_build_object(
    'id', r.id, 'name', r.data->>'name', 'ticket', r.data->>'ticket', 'status', r.data->>'status', 'type', r.data->>'type',
    'phone', case when length(regexp_replace(coalesce(r.data->>'phone', ''), '\D', '', 'g')) >= 4 then '•••• ' || right(regexp_replace(r.data->>'phone', '\D', '', 'g'), 4) else '' end,
    'email', case when r.data->>'email' like '%@%' then left(r.data->>'email', 2) || '•••@' || split_part(r.data->>'email', '@', 2) end,
    'checkins', coalesce(r.data->'checkins', '[]'::jsonb), 'sessions', coalesce(r.data->'sessions', '[]'::jsonb), 'checkinLog', coalesce(r.data->'checkinLog', '[]'::jsonb),
    'inBy', case when (select yes from inn) then coalesce((select p.first_name || ' ' || p.last_name from m join people p on p.id::text = m.x->>'byId'), 'someone on the team') end,
    'inAt', case when (select yes from inn) then (select m.x->>'at' from m) end)
$$;

create or replace function checkin_guard(c uuid, ev text) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if my_person(c) is null or not event_checkin_staff(c, ev) then raise exception 'You are not on the check-in team for this event'; end if;
  if not exists (select 1 from events where church_id = c and id = ev and status = 'published') then raise exception 'This event is not open'; end if;
end $$;

-- Opening the shared link: which event, and is this person allowed? Each opening is written in the activity log.
create or replace function checkin_open(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e events; ch churches;
begin
  select * into e from events where length(coalesce(p_token, '')) >= 10 and data->'checkinLink'->>'token' = p_token
     and not coalesce((data->'checkinLink'->>'revoked')::boolean, false) and status = 'published' limit 1;
  if e.id is null then return jsonb_build_object('allowed', false, 'reason', 'This check-in link has been turned off or replaced. Ask the Registration Lead for the new one.'); end if;
  select * into ch from churches where id = e.church_id;
  if my_person(e.church_id) is null then return jsonb_build_object('allowed', false, 'reason', 'Your account is not part of ' || ch.name || ' on Traqi yet. Ask the church admin for an invite.'); end if;
  if not event_checkin_staff(e.church_id, e.id) then return jsonb_build_object('allowed', false, 'reason', 'You''re not on the check-in team for ' || (e.data->>'title') || '. Ask the Registration Lead to add you.'); end if;
  insert into activity_log (church_id, actor_id, action, at) values (e.church_id, my_person(e.church_id), 'opened the check-in link for ' || (e.data->>'title'), now());
  return jsonb_build_object('allowed', true, 'event', jsonb_build_object(
    'id', e.id, 'churchId', e.church_id, 'title', e.data->>'title', 'churchName', ch.name, 'start', e.data->>'start', 'end', e.data->>'end',
    'sessionCheckin', coalesce((e.data->>'sessionCheckin')::boolean, false),
    'days', coalesce(nullif(e.data->'dayPlan', '[]'::jsonb),
      (select jsonb_agg(jsonb_build_object('date', d, 'start', '00:00', 'end', '23:59')) from jsonb_array_elements_text(coalesce(e.data->'days', '[]'::jsonb)) d))));
end $$;

-- Find by ticket ID, phone, email or name
create or replace function checkin_find(p_church uuid, p_event text, p_q text, p_day text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q text := trim(coalesce(p_q, '')); d text := coalesce(p_day, lagos_today()); dg text := regexp_replace(q, '\D', '', 'g'); out jsonb;
begin
  perform checkin_guard(p_church, p_event);
  select coalesce(jsonb_agg(door_reg(r, d, null) order by r.data->>'name'), '[]'::jsonb) into out
    from registrations r
   where r.church_id = p_church and r.id in (
     select x.id from registrations x where x.church_id = p_church and x.event_id = p_event and (
       case
         when q like '%@%' then lower(x.data->>'email') = lower(q)
         when q ~ '^[A-Za-z0-9]{2,6}-[A-Za-z0-9]{3,}$' then upper(x.data->>'ticket') = upper(q)
         when length(dg) >= 7 and q !~* '[a-z]{3,}' then right(regexp_replace(coalesce(x.data->>'phone', ''), '\D', '', 'g'), 10) like '%' || right(dg, 10)
         when length(q) >= 3 then x.data->>'name' ilike '%' || q || '%'
         else false end)
     order by x.data->>'name' limit 8);
  return out;
end $$;

-- Check one person in. The row is locked, so if two people scan the same ticket, the second is told who did it.
create or replace function checkin_do(c uuid, ev text, p_reg text, p_day text, p_session text, p_via text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r registrations; s text := nullif(p_session, '');
begin
  select * into r from registrations where church_id = c and event_id = ev and id = p_reg for update;
  if r.id is null then raise exception 'That registration is no longer there'; end if;
  if r.data->>'status' <> 'confirmed' then return jsonb_build_object('result', 'not-confirmed', 'reg', door_reg(r, p_day, s)); end if;
  if coalesce(r.data->'checkins', '[]'::jsonb) ? p_day and (s is null or coalesce(r.data->'sessions', '[]'::jsonb) ? s) then
    return jsonb_build_object('result', 'already', 'reg', door_reg(r, p_day, s));
  end if;
  update registrations set updated_at = now(), data = data
      || jsonb_build_object('checkins', case when coalesce(data->'checkins', '[]'::jsonb) ? p_day then data->'checkins' else coalesce(data->'checkins', '[]'::jsonb) || to_jsonb(p_day) end)
      || jsonb_build_object('sessions', case when s is null or coalesce(data->'sessions', '[]'::jsonb) ? s then coalesce(data->'sessions', '[]'::jsonb) else coalesce(data->'sessions', '[]'::jsonb) || to_jsonb(s) end)
      || jsonb_build_object('checkinLog', coalesce(data->'checkinLog', '[]'::jsonb) || jsonb_strip_nulls(jsonb_build_object('day', p_day, 'at', now(), 'byId', my_person(c), 'via', p_via, 'session', s)))
    where church_id = c and id = r.id returning * into r;
  return jsonb_build_object('result', 'in', 'reg', door_reg(r, p_day, s));
end $$;

create or replace function checkin_mark(p_church uuid, p_event text, p_reg text, p_day text, p_session text, p_via text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform checkin_guard(p_church, p_event);
  if p_via not in ('qr', 'ticket', 'phone', 'email', 'name', 'walkin') then raise exception 'Unknown check-in method'; end if;
  return checkin_do(p_church, p_event, p_reg, p_day, p_session, p_via);
end $$;

-- Someone who didn't register: register them (numbered ticket) and check them in
create or replace function checkin_walkin(p_church uuid, p_event text, p_name text, p_phone text, p_email text, p_day text, p_session text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e events; key text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10); rid text; pid uuid;
begin
  perform checkin_guard(p_church, p_event);
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Enter their name'; end if;
  if length(key) < 10 then raise exception 'Enter a valid phone number'; end if;
  select * into e from events where church_id = p_church and id = p_event;
  perform pg_advisory_xact_lock(hashtext(p_church::text || '|' || e.id));
  select id into rid from registrations where church_id = p_church and event_id = e.id and right(regexp_replace(data->>'phone', '\D', '', 'g'), 10) = key order by (data->>'byRegId') nulls first limit 1;
  if rid is not null then return checkin_do(p_church, e.id, rid, p_day, p_session, 'phone'); end if;
  select id into pid from people where church_id = p_church and right(regexp_replace(phone, '\D', '', 'g'), 10) = key limit 1;
  rid := gen_random_uuid()::text;
  insert into registrations (id, church_id, event_id, person_id, data) values (rid, p_church, e.id, pid, jsonb_build_object(
    'id', rid, 'eventId', e.id, 'personId', pid, 'name', trim(p_name), 'phone', p_phone, 'email', nullif(lower(trim(coalesce(p_email, ''))), ''),
    'guests', 0, 'days', jsonb_build_array(p_day), 'answers', '{}'::jsonb, 'type', 'individual', 'walkIn', true,
    'ticket', next_event_ticket(p_church, e), 'status', 'confirmed', 'checkins', '[]'::jsonb, 'sessions', '[]'::jsonb, 'checkinLog', '[]'::jsonb, 'at', now()));
  insert into activity_log (church_id, actor_id, action, at) values (p_church, my_person(p_church), 'added a walk-in at ' || (e.data->>'title'), now());
  return checkin_do(p_church, e.id, rid, p_day, p_session, 'walkin');
end $$;

-- Registered, in, yet to come: for the live numbers at the top of the check-in screen
create or replace function checkin_stats(p_church uuid, p_event text, p_day text, p_session text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare reg int; inn int; s text := nullif(p_session, '');
begin
  perform checkin_guard(p_church, p_event);
  select count(*), count(*) filter (where coalesce(data->'checkins', '[]'::jsonb) ? p_day and (s is null or coalesce(data->'sessions', '[]'::jsonb) ? s))
    into reg, inn from registrations
   where church_id = p_church and event_id = p_event and data->>'status' = 'confirmed' and coalesce(data->>'type', 'individual') <> 'online';
  return jsonb_build_object('registered', reg, 'in', inn, 'notYet', reg - inn, 'pct', case when reg > 0 then inn::numeric / reg else 0 end);
end $$;

-- Internal helpers: only reachable through the checks above
revoke execute on function checkin_do(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function next_event_ticket(uuid, events) from public, anon, authenticated;
revoke execute on function door_reg(registrations, text, text) from public, anon, authenticated;
grant execute on function checkin_open(text) to authenticated;
grant execute on function checkin_find(uuid, text, text, text) to authenticated;
grant execute on function checkin_mark(uuid, text, text, text, text, text) to authenticated;
grant execute on function checkin_walkin(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function checkin_stats(uuid, text, text, text) to authenticated;

-- ---------- Event budgets: committee review, then finance, then the Lead Pastor ----------
drop policy if exists "ask for funds" on fund_requests;
create policy "ask for funds" on fund_requests for insert with check (is_church_member(church_id) and (by_id = my_person(church_id) or finance_staff(church_id)
  or (data->>'eventId' is not null and committee_can(church_id, data->>'eventId', 'budget'))));
drop policy if exists "read funds" on fund_requests;
create policy "read funds" on fund_requests for select using (
  by_id = my_person(church_id) or finance_staff(church_id)
  or (group_id is not null and exists (select 1 from group_members gm where gm.group_id = fund_requests.group_id and gm.person_id = my_person(fund_requests.church_id) and gm.is_leader))
  or (data->>'eventId' is not null and committee_can(church_id, data->>'eventId', 'budget')));
drop policy if exists "move funds" on fund_requests;
create policy "move funds" on fund_requests for update using (
  by_id = my_person(church_id) or finance_staff(church_id)
  or (data->>'eventId' is not null and committee_can(church_id, data->>'eventId', 'budget')));

-- The steps an event budget may take, and who may take them
create or replace function fund_event_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare ev text := new.data->>'eventId';
begin
  if ev is null or new.data->>'parentId' is not null or old.stage is not distinct from new.stage then return new; end if;
  -- Leaving the committee (approved on, or sent back to the person who raised it): the committee's reviewers
  if old.stage = 'committee' and new.stage in ('finance', 'pastor', 'returned') and not (committee_can(new.church_id, ev, 'budget') or is_pastor(new.church_id)) then
    raise exception 'Only the event committee''s head, assistant or Finance Lead can move this request on';
  end if;
  -- The final approval of an event budget is the Lead Pastor's
  if old.stage = 'pastor' and new.stage = 'approved' and not is_lead(new.church_id) then
    raise exception 'Only the Lead Pastor can give the final approval on an event budget';
  end if;
  return new;
end $$;
drop trigger if exists fund_event_guard on fund_requests;
create trigger fund_event_guard before update on fund_requests for each row execute function fund_event_guard();

-- ---------- Thoughts and suggestions from the committee ----------
create table if not exists event_notes (
  id text not null,
  church_id uuid not null references churches on delete cascade,
  data jsonb not null,
  event_id text,
  by_id uuid,
  updated_at timestamptz not null default now(),
  primary key (church_id, id)
);
alter table event_notes enable row level security;
create index if not exists event_notes_event on event_notes (church_id, event_id);
drop policy if exists "read event notes" on event_notes;
create policy "read event notes" on event_notes for select using (on_committee(church_id, event_id) or committee_picker(church_id));
drop policy if exists "add event notes" on event_notes;
create policy "add event notes" on event_notes for insert with check (by_id = my_person(church_id) and (on_committee(church_id, event_id) or committee_picker(church_id)));
drop policy if exists "answer event notes" on event_notes;
create policy "answer event notes" on event_notes for update using (by_id = my_person(church_id) or committee_can(church_id, event_id, 'team') or committee_picker(church_id));
drop policy if exists "remove event notes" on event_notes;
create policy "remove event notes" on event_notes for delete using (by_id = my_person(church_id) or committee_can(church_id, event_id, 'team') or committee_picker(church_id));

-- ---------- "Will you be there?" for department and committee meetings ----------
create table if not exists meeting_rsvps (
  id text not null,
  church_id uuid not null references churches on delete cascade,
  data jsonb not null,
  person_id uuid,
  kind text check (kind in ('dept', 'committee')),
  ref_id text,
  updated_at timestamptz not null default now(),
  primary key (church_id, id)
);
alter table meeting_rsvps enable row level security;
create index if not exists meeting_rsvps_ref on meeting_rsvps (church_id, kind, ref_id);
drop policy if exists "own answers" on meeting_rsvps;
create policy "own answers" on meeting_rsvps for all using (person_id = my_person(church_id)) with check (person_id = my_person(church_id) and is_church_member(church_id));
drop policy if exists "leaders see answers" on meeting_rsvps;
create policy "leaders see answers" on meeting_rsvps for select using (is_pastor(church_id)
  or (kind = 'dept' and (leads_group(church_id, ref_id) or exists (select 1 from groups g, jsonb_array_elements(coalesce(g.extra->'assistants', '[]'::jsonb)) a
                                                                    where g.church_id = meeting_rsvps.church_id and g.id::text = meeting_rsvps.ref_id and (a->>'personId')::uuid = my_person(g.church_id))))
  or (kind = 'committee' and on_committee(church_id, ref_id)));
