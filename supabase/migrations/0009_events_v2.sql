-- Events, round 2: registering others (one ticket each), registration types,
-- feedback after the event, and the short /church/event links. Safe to run more than once.

-- New top-level words can't become church links
create or replace function slug_reserved(s text) returns boolean language sql immutable as $$
  select s = any (array['today','people','first-timers','welfare','attendance','classes','events','departments','finance','messages','settings',
    'activity','owner','login','signup','start','join','welcome','update','display','checkin','invite','api','c','e','admin','help','about',
    'pricing','privacy','terms','support','traqi','app','www','mail','static','public','auth','dashboard',
    'prayer','meeting','offline','icons','sw','share','tickets','ticket','register','demo'])
$$;

-- The public page also shows the first letters of the latest names, for "people registered"
create or replace function event_page(p_slug text, p_event text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('church', jsonb_build_object('name', c.name, 'slug', c.slug, 'profile', coalesce(c.profile, '{}'::jsonb) - 'prayerViewers'),
         'event', e.data,
         'registered', (select coalesce(sum(1 + coalesce((r.data->>'guests')::int, 0)), 0) from registrations r where r.church_id = c.id and r.event_id = e.id and r.data->>'status' = 'confirmed'),
         'recent', coalesce((select jsonb_agg(x.initials) from (
             select upper(left(split_part(r.data->>'name', ' ', 1), 1) || left(split_part(r.data->>'name', ' ', 2), 1)) initials
             from registrations r where r.church_id = c.id and r.event_id = e.id and r.data->>'status' = 'confirmed'
             order by r.updated_at desc limit 4) x), '[]'::jsonb))
  from churches c join events e on e.church_id = c.id
  where c.slug = p_slug and e.slug = p_event and e.status = 'published'
$$;

create or replace function new_ticket(ev_slug text) returns text language sql volatile as $$
  select coalesce(nullif(upper(substr(regexp_replace(ev_slug, '[^a-z]', '', 'g'), 1, 4)), ''), 'TQ') || '-' ||
         (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 6))
$$;

-- p_reg: { name, phone, email, type, days, answers, others: [{ name, phone, email, answers }] }
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
    tk := new_ticket(e.slug);
    rid := gen_random_uuid()::text;
    okey := right(regexp_replace(coalesce(nullif(o->>'phone', ''), case when i = 0 then p_reg->>'phone' end, ''), '\D', '', 'g'), 10);
    pid := null;
    if length(okey) = 10 then select id into pid from people where church_id = c and right(regexp_replace(phone, '\D', '', 'g'), 10) = okey limit 1; end if;
    insert into registrations (id, church_id, event_id, person_id, data)
    values (rid, c, e.id, pid, jsonb_build_object(
      'id', rid, 'eventId', e.id, 'personId', pid, 'name', trim(o->>'name'),
      'phone', coalesce(nullif(o->>'phone', ''), p_reg->>'phone'), 'email', nullif(o->>'email', ''),
      'guests', 0, 'days', coalesce(p_reg->'days', '[]'::jsonb), 'answers', coalesce(o->'answers', '{}'::jsonb),
      'type', coalesce(p_reg->>'type', 'individual'), 'byRegId', lead_id,
      'ticket', tk, 'status', st, 'checkins', '[]'::jsonb, 'sessions', '[]'::jsonb, 'at', now()));
    if i = 0 then lead_id := rid; end if;
    out := out || jsonb_build_object('name', trim(o->>'name'), 'ticket', tk, 'status', st);
    i := i + 1;
  end loop;
  return jsonb_build_object('status', out->0->>'status', 'ticket', out->0->>'ticket', 'tickets', out);
end $$;

-- After the event: feedback against a ticket
create or replace function event_feedback(p_slug text, p_event text, p_ticket text, p_answers jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare c uuid; e events; r registrations;
begin
  select id into c from churches where slug = p_slug;
  select * into e from events where church_id = c and slug = p_event and status = 'published';
  if e.id is null or not coalesce((e.data->'feedback'->>'on')::boolean, false) then raise exception 'Feedback is not open for this event'; end if;
  select * into r from registrations where church_id = c and event_id = e.id and upper(data->>'ticket') = upper(trim(p_ticket));
  if r.id is null then raise exception 'We couldn''t find that ticket'; end if;
  update registrations set data = data || jsonb_build_object('feedback', jsonb_build_object('answers', coalesce(p_answers, '{}'::jsonb), 'at', now())), updated_at = now()
   where church_id = c and id = r.id;
end $$;

grant execute on function event_page(text, text) to anon, authenticated;
grant execute on function register_event(text, text, jsonb) to anon, authenticated;
grant execute on function event_feedback(text, text, text, jsonb) to anon, authenticated;

-- The public church page never shows who reads prayer requests
create or replace function church_page(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', c.name, 'slug', c.slug, 'profile', coalesce(c.profile, '{}'::jsonb) - 'prayerViewers',
    'events', coalesce((select jsonb_agg(e.data order by e.data->>'start') from events e
                         where e.church_id = c.id and e.status = 'published' and (e.data->>'end')::timestamptz > now()), '[]'::jsonb))
  from churches c where c.slug = p_slug
$$;
grant execute on function church_page(text) to anon, authenticated;
