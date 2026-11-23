-- Round 6: the event registration form asks for first name and last name separately, a WhatsApp number,
-- an optional alternative number (hotline or call number) and an email. The door finds people by either number,
-- and walk-ins keep first name, last name and the alternative number too.
-- Registrations keep "firstName" and "lastName" alongside "name" (both together, for tickets and the door).
-- Older pages that still send only "name" keep working. Safe to run more than once. Run after round 5.

create or replace function register_event(p_slug text, p_event text, p_reg jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c uuid; e events; taken int; cap int; st text; tk text; rid text; lead_id text; pid uuid; o jsonb; i int := 0;
        key text := right(regexp_replace(coalesce(p_reg->>'phone', ''), '\D', '', 'g'), 10);
        out jsonb := '[]'::jsonb; okey text; others jsonb := coalesce(p_reg->'others', '[]'::jsonb);
        fn text := nullif(trim(coalesce(p_reg->>'firstName', '')), '');
        ln text := nullif(trim(coalesce(p_reg->>'lastName', '')), '');
        full_name text;
begin
  -- New pages send first and last name; older ones send one name
  if p_reg ? 'firstName' or p_reg ? 'lastName' then
    if fn is null then raise exception 'Enter your first name'; end if;
    if ln is null then raise exception 'Enter your last name'; end if;
    full_name := fn || ' ' || ln;
  else
    full_name := trim(coalesce(p_reg->>'name', ''));
  end if;
  if length(key) < 10 then raise exception 'Enter a valid phone number'; end if;
  if length(full_name) < 2 then raise exception 'Enter your name'; end if;
  if p_reg ? 'firstName' and coalesce(p_reg->>'email', '') !~ '^\S+@\S+\.\S+$' then raise exception 'Enter a valid email address'; end if;
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

  for o in select jsonb_build_object('name', full_name, 'firstName', fn, 'lastName', ln, 'phone', p_reg->>'phone', 'altPhone', nullif(trim(coalesce(p_reg->>'altPhone', '')), ''), 'email', p_reg->>'email', 'answers', coalesce(p_reg->'answers', '{}'::jsonb))
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
    values (rid, c, e.id, pid, jsonb_strip_nulls(jsonb_build_object(
      'id', rid, 'eventId', e.id, 'personId', pid, 'name', trim(o->>'name'),
      'firstName', nullif(trim(coalesce(o->>'firstName', '')), ''), 'lastName', nullif(trim(coalesce(o->>'lastName', '')), ''),
      'phone', coalesce(nullif(o->>'phone', ''), p_reg->>'phone'), 'altPhone', nullif(trim(coalesce(o->>'altPhone', '')), ''), 'email', nullif(lower(trim(o->>'email')), ''),
      'guests', 0, 'days', coalesce(p_reg->'days', '[]'::jsonb), 'answers', coalesce(o->'answers', '{}'::jsonb),
      'type', coalesce(p_reg->>'type', 'individual'), 'byRegId', lead_id,
      'ticket', tk, 'status', st, 'checkins', '[]'::jsonb, 'sessions', '[]'::jsonb, 'checkinLog', '[]'::jsonb, 'at', now())));
    if i = 0 then lead_id := rid; end if;
    out := out || jsonb_build_object('name', trim(o->>'name'), 'ticket', tk, 'status', st);
    i := i + 1;
  end loop;
  return jsonb_build_object('status', out->0->>'status', 'ticket', out->0->>'ticket', 'tickets', out);
end $$;
grant execute on function register_event(text, text, jsonb) to anon, authenticated;

-- ---------- The door: find people by their WhatsApp number or their alternative number ----------
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
         when length(dg) >= 7 and q !~* '[a-z]{3,}' then
           right(regexp_replace(coalesce(x.data->>'phone', ''), '\D', '', 'g'), 10) like '%' || right(dg, 10)
           or right(regexp_replace(coalesce(x.data->>'altPhone', ''), '\D', '', 'g'), 10) like '%' || right(dg, 10)
         when length(q) >= 3 then x.data->>'name' ilike '%' || q || '%'
         else false end)
     order by x.data->>'name' limit 8);
  return out;
end $$;
grant execute on function checkin_find(uuid, text, text, text) to authenticated;

-- ---------- Walk-ins: first name, last name and an optional alternative number ----------
drop function if exists checkin_walkin(uuid, text, text, text, text, text, text);
create or replace function checkin_walkin(p_church uuid, p_event text, p_name text, p_phone text, p_email text, p_day text, p_session text,
                                          p_first text default null, p_last text default null, p_alt text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e events; key text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10); rid text; pid uuid;
        fn text := nullif(trim(coalesce(p_first, '')), ''); ln text := nullif(trim(coalesce(p_last, '')), '');
        nm text := coalesce(nullif(trim(concat_ws(' ', fn, ln)), ''), trim(coalesce(p_name, '')));
begin
  perform checkin_guard(p_church, p_event);
  if length(nm) < 2 then raise exception 'Enter their first and last name'; end if;
  if length(key) < 10 then raise exception 'Enter a valid phone number'; end if;
  select * into e from events where church_id = p_church and id = p_event;
  perform pg_advisory_xact_lock(hashtext(p_church::text || '|' || e.id));
  select id into rid from registrations where church_id = p_church and event_id = e.id and right(regexp_replace(data->>'phone', '\D', '', 'g'), 10) = key order by (data->>'byRegId') nulls first limit 1;
  if rid is not null then return checkin_do(p_church, e.id, rid, p_day, p_session, 'phone'); end if;
  select id into pid from people where church_id = p_church and right(regexp_replace(phone, '\D', '', 'g'), 10) = key limit 1;
  rid := gen_random_uuid()::text;
  insert into registrations (id, church_id, event_id, person_id, data) values (rid, p_church, e.id, pid, jsonb_strip_nulls(jsonb_build_object(
    'id', rid, 'eventId', e.id, 'personId', pid, 'name', nm, 'firstName', fn, 'lastName', ln,
    'phone', p_phone, 'altPhone', nullif(trim(coalesce(p_alt, '')), ''), 'email', nullif(lower(trim(coalesce(p_email, ''))), ''),
    'guests', 0, 'days', jsonb_build_array(p_day), 'answers', '{}'::jsonb, 'type', 'individual', 'walkIn', true,
    'ticket', next_event_ticket(p_church, e), 'status', 'confirmed', 'checkins', '[]'::jsonb, 'sessions', '[]'::jsonb, 'checkinLog', '[]'::jsonb, 'at', now())));
  insert into activity_log (church_id, actor_id, action, at) values (p_church, my_person(p_church), 'added a walk-in at ' || (e.data->>'title'), now());
  return checkin_do(p_church, e.id, rid, p_day, p_session, 'walkin');
end $$;
grant execute on function checkin_walkin(uuid, text, text, text, text, text, text, text, text, text) to authenticated;
