-- Round 8: members joining from events and the Sunday code, worker requests, check-in at the venue,
-- event ticket categories, event media and the church page. Safe to run more than once.

-- ---------- People who join are members ----------
-- Anyone joining a church themselves (from search, an event or "I'm a member" on the Sunday code) already
-- belongs to it, so they start at the church's first Member stage, not as a first-timer.
create or replace function member_stage(c uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select s->>'key' from churches ch, jsonb_array_elements(coalesce(ch.profile->'journey'->'stages', '[]'::jsonb)) s
      where ch.id = c and s->>'kind' = 'member' limit 1),
    'member')
$$;

create or replace function join_church(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare c uuid := (p->>'church')::uuid; me uuid; match uuid; v_key text := right(regexp_replace(coalesce(p->>'phone', ''), '\D', '', 'g'), 10);
  r_member uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not exists (select 1 from churches where id = c) then raise exception 'Church not found'; end if;
  if exists (select 1 from people where church_id = c and user_id = auth.uid()) then
    return (select id from people where church_id = c and user_id = auth.uid() limit 1);
  end if;
  if length(trim(coalesce(p->>'firstName', ''))) < 1 or length(trim(coalesce(p->>'lastName', ''))) < 1 then raise exception 'Enter your name'; end if;
  if length(v_key) < 10 then raise exception 'Enter a valid phone number'; end if;
  select id into match from people where church_id = c and user_id is null and right(regexp_replace(phone, '\D', '', 'g'), 10) = v_key limit 1;
  insert into people (church_id, first_name, last_name, gender, phone, whatsapp, email, birthday, stage, user_id, tracked, first_visit, consent_at, consent_via, joined_via, branch_id, extra)
  values (c, trim(p->>'firstName'), trim(p->>'lastName'), p->>'gender', trim(p->>'phone'), trim(p->>'phone'), (select email from auth.users where id = auth.uid()),
          nullif(p->>'birthday', '')::date, member_stage(c), auth.uid(), true, current_date, now(), 'joined', 'search', nullif(p->>'branch', ''),
          case when match is null then '{}'::jsonb else jsonb_build_object('possibleMatchId', match) end)
  returning id into me;
  select r.id into r_member from roles r where r.church_id = c and r.key = 'member';
  if r_member is not null then
    insert into role_assignments (church_id, person_id, role_id, scope_type) values (c, me, r_member, 'self') on conflict do nothing;
  end if;
  insert into activity_log (church_id, actor_id, action, target_table, target_id) values (c, me, 'joined from Traqi search', 'people', me);
  return me;
end $$;
grant execute on function join_church(jsonb) to authenticated;

-- ---------- Confirming new joiners: the admin, Follow-up and Membership ----------
create or replace function confirms_joiners(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select has_perm(c, 'people.edit') or heads_tag(c, array['followup', 'membership'], true)
$$;
drop policy if exists "confirm joiners" on people;
create policy "confirm joiners" on people for update
  using (joined_via = 'search' and confirmed_at is null and confirms_joiners(church_id))
  with check (confirms_joiners(church_id));

-- ---------- One Sunday code for everyone ----------
-- Check in by phone number or email.
create or replace function checkin_public(p_slug text, p_code text, p_phone text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c uuid; m meetings; p people; v text := trim(coalesce(p_phone, '')); key text := right(regexp_replace(v, '\D', '', 'g'), 10); rid text;
begin
  select id into c from churches where slug = p_slug;
  if c is null then return jsonb_build_object('status', 'no-church'); end if;
  select * into m from meetings
   where church_id = c and coalesce((data->>'checkin')::boolean, false)
     and now() between (data->>'start')::timestamptz - interval '30 minutes' and (data->>'end')::timestamptz
   order by data->>'start' limit 1;
  if m.id is null then return jsonb_build_object('status', 'no-meeting'); end if;
  if coalesce(m.data->>'code', '') <> trim(coalesce(p_code, '')) then return jsonb_build_object('status', 'bad-code'); end if;
  if position('@' in v) > 0 then
    select * into p from people where church_id = c and lower(email) = lower(v) and inactive is null limit 1;
  elsif length(key) >= 10 then
    select * into p from people where church_id = c and right(regexp_replace(phone, '\D', '', 'g'), 10) = key limit 1;
  end if;
  if p.id is null then return jsonb_build_object('status', 'not-found', 'meeting', m.data->>'name'); end if;
  if exists (select 1 from attendance_records where church_id = c and meeting_id = m.id and person_id = p.id) then
    return jsonb_build_object('status', 'already', 'meeting', m.data->>'name');
  end if;
  rid := gen_random_uuid()::text;
  insert into attendance_records (id, church_id, meeting_id, person_id, data)
  values (rid, c, m.id, p.id, jsonb_build_object('id', rid, 'meetingId', m.id, 'personId', p.id, 'method', 'link', 'at', now()));
  update people set last_seen = current_date, missed_in_a_row = 0, tracked = true where id = p.id;
  return jsonb_build_object('status', 'ok', 'meeting', m.data->>'name');
end $$;
grant execute on function checkin_public(text, text, text) to anon, authenticated;

-- "I'm a member" with Google: is this account in the church yet, and what do we know?
create or replace function sunday_member_status(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c uuid; p people;
begin
  if auth.uid() is null then return jsonb_build_object('signedIn', false, 'member', false); end if;
  select id into c from churches where slug = p_slug;
  if c is null then raise exception 'Church not found'; end if;
  select * into p from people where church_id = c and user_id = auth.uid() limit 1;
  if p.id is null then
    return jsonb_build_object('signedIn', true, 'member', false, 'churchId', c, 'email', (select email from auth.users where id = auth.uid()));
  end if;
  return jsonb_build_object('signedIn', true, 'member', true, 'churchId', c, 'email', coalesce(p.email, (select email from auth.users where id = auth.uid())),
    'person', jsonb_build_object('firstName', p.first_name, 'lastName', p.last_name));
end $$;
grant execute on function sunday_member_status(text) to authenticated;

-- A signed-in member checks themselves in to the service that's on (the service code proves they're there).
create or replace function checkin_member(p_slug text, p_code text, p_online boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c uuid; m meetings; p people; rid text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select id into c from churches where slug = p_slug;
  if c is null then return jsonb_build_object('status', 'no-church'); end if;
  select * into p from people where church_id = c and user_id = auth.uid() limit 1;
  if p.id is null then return jsonb_build_object('status', 'not-member'); end if;
  select * into m from meetings
   where church_id = c and coalesce((data->>'checkin')::boolean, false)
     and now() between (data->>'start')::timestamptz - interval '30 minutes' and (data->>'end')::timestamptz
   order by data->>'start' limit 1;
  if m.id is null then return jsonb_build_object('status', 'no-meeting'); end if;
  if coalesce(m.data->>'code', '') <> trim(coalesce(p_code, '')) then return jsonb_build_object('status', 'bad-code'); end if;
  if exists (select 1 from attendance_records where church_id = c and meeting_id = m.id and person_id = p.id) then
    return jsonb_build_object('status', 'already', 'meeting', m.data->>'name', 'firstName', p.first_name);
  end if;
  rid := gen_random_uuid()::text;
  insert into attendance_records (id, church_id, meeting_id, person_id, data)
  values (rid, c, m.id, p.id, jsonb_build_object('id', rid, 'meetingId', m.id, 'personId', p.id, 'method', case when p_online then 'online' else 'link' end, 'at', now()));
  update people set last_seen = current_date, missed_in_a_row = 0, tracked = true where id = p.id;
  return jsonb_build_object('status', 'ok', 'meeting', m.data->>'name', 'firstName', p.first_name);
end $$;
grant execute on function checkin_member(text, text, boolean) to authenticated;

-- ---------- Event pages: what the public may see ----------
-- Never public: unpublished changes, check-in secrets and links, the committee's planning, private ticket categories.
create or replace function event_public(e events, p_token text default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select (e.data - 'draft' - 'checkinLink' - 'committee' - 'goals' - 'objectives' - 'targetBudget' - 'duties' - 'regLeadId' - 'regLeadAdds' - 'venueCheckin' - 'categories')
    || jsonb_build_object('venueCheckin', jsonb_build_object('on', coalesce((e.data->'venueCheckin'->>'on')::boolean, false)))
    || jsonb_build_object('categories', coalesce((
         select jsonb_agg(x - 'token' order by n) from jsonb_array_elements(coalesce(e.data->'categories', '[]'::jsonb)) with ordinality t(x, n)
          where coalesce((x->>'live')::boolean, true)
            and (not coalesce((x->>'private')::boolean, false) or (length(coalesce(p_token, '')) >= 6 and x->>'token' = p_token))), '[]'::jsonb))
$$;

drop function if exists event_page(text, text);
create or replace function event_page(p_slug text, p_event text, p_cat text default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('church', jsonb_build_object('name', c.name, 'slug', c.slug, 'profile', coalesce(c.profile, '{}'::jsonb) - 'prayerViewers'),
         'event', event_public(e, p_cat),
         'registered', (select coalesce(sum(1 + coalesce((r.data->>'guests')::int, 0)), 0) from registrations r where r.church_id = c.id and r.event_id = e.id and r.data->>'status' = 'confirmed'),
         'recent', coalesce((select jsonb_agg(x.initials) from (
             select upper(left(split_part(r.data->>'name', ' ', 1), 1) || left(split_part(r.data->>'name', ' ', 2), 1)) initials
             from registrations r where r.church_id = c.id and r.event_id = e.id and r.data->>'status' = 'confirmed'
             order by r.updated_at desc limit 4) x), '[]'::jsonb))
  from churches c join events e on e.church_id = c.id
  where c.slug = p_slug and e.slug = p_event and e.status = 'published'
$$;
grant execute on function event_page(text, text, text) to anon, authenticated;

-- ---------- The church page: one per church, at traqi.church/{church} ----------
create or replace function church_page(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', c.name, 'slug', c.slug, 'profile', coalesce(c.profile, '{}'::jsonb) - 'prayerViewers',
    'events', coalesce((select jsonb_agg(event_public(e) order by e.data->>'start') from events e
                         where e.church_id = c.id and e.status = 'published' and (e.data->>'end')::timestamptz > now()), '[]'::jsonb))
  from churches c where c.slug = p_slug
$$;
grant execute on function church_page(text) to anon, authenticated;

-- ---------- Registration with ticket categories ----------
create or replace function register_event(p_slug text, p_event text, p_reg jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c uuid; e events; taken int; cap int; st text; tk text; rid text; lead_id text; pid uuid; o jsonb; i int := 0;
        key text := right(regexp_replace(coalesce(p_reg->>'phone', ''), '\D', '', 'g'), 10);
        out jsonb := '[]'::jsonb; okey text; others jsonb := coalesce(p_reg->'others', '[]'::jsonb);
        fn text := nullif(trim(coalesce(p_reg->>'firstName', '')), '');
        ln text := nullif(trim(coalesce(p_reg->>'lastName', '')), '');
        full_name text; cat jsonb; cat_id text := nullif(p_reg->>'category', ''); cat_used int; cat_cap int;
begin
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
  -- At the venue (with its check-in code), people can still register on the day after online registration closes
  if e.data->>'closesAt' is not null and now() > (e.data->>'closesAt')::timestamptz and venue_code_ok(e, p_reg->>'venueCode') <> 'ok' then raise exception 'Registration has closed'; end if;
  if (e.data->>'end') is not null and now() > (e.data->>'end')::timestamptz then raise exception 'This event has ended'; end if;
  perform pg_advisory_xact_lock(hashtext(c::text || '|' || e.id));

  -- Ticket category: one the person may choose (public and live, or private with its own link)
  if cat_id is not null then
    select x into cat from jsonb_array_elements(coalesce(e.data->'categories', '[]'::jsonb)) x
     where x->>'id' = cat_id and coalesce((x->>'live')::boolean, true)
       and (not coalesce((x->>'private')::boolean, false) or x->>'token' = coalesce(p_reg->>'categoryToken', ''));
    if cat is null then raise exception 'That ticket type isn''t available'; end if;
  elsif exists (select 1 from jsonb_array_elements(coalesce(e.data->'categories', '[]'::jsonb)) x
                 where coalesce((x->>'live')::boolean, true) and not coalesce((x->>'private')::boolean, false)) then
    raise exception 'Choose a ticket type';
  end if;

  select id into lead_id from registrations
   where church_id = c and event_id = e.id and data->>'byRegId' is null and right(regexp_replace(data->>'phone', '\D', '', 'g'), 10) = key limit 1;
  if lead_id is not null then
    select jsonb_agg(jsonb_build_object('name', data->>'name', 'ticket', data->>'ticket', 'status', 'already', 'category', data->>'category') order by (data->>'byRegId') nulls first)
      into out from registrations where church_id = c and event_id = e.id and (id = lead_id or data->>'byRegId' = lead_id);
    return jsonb_build_object('status', 'already', 'ticket', out->0->>'ticket', 'tickets', out);
  end if;

  select coalesce(sum(1 + coalesce((data->>'guests')::int, 0)), 0) into taken from registrations where church_id = c and event_id = e.id and data->>'status' = 'confirmed';
  cap := nullif(e.data->>'capacity', '')::int;
  if cat is not null then
    cat_cap := nullif(cat->>'limit', '')::int;
    select count(*) into cat_used from registrations where church_id = c and event_id = e.id and data->>'category' = cat_id and data->>'status' in ('confirmed', 'pending');
    if cat_cap is not null and cat_used + 1 + jsonb_array_length(others) > cat_cap then
      raise exception 'Sorry, % tickets are all taken', cat->>'name';
    end if;
  end if;

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
      'type', coalesce(p_reg->>'type', 'individual'), 'byRegId', lead_id, 'category', cat_id,
      'ticket', tk, 'status', st, 'checkins', '[]'::jsonb, 'sessions', '[]'::jsonb, 'checkinLog', '[]'::jsonb, 'at', now())));
    if i = 0 then lead_id := rid; end if;
    out := out || jsonb_strip_nulls(jsonb_build_object('name', trim(o->>'name'), 'ticket', tk, 'status', st, 'category', cat_id));
    i := i + 1;
  end loop;
  return jsonb_build_object('status', out->0->>'status', 'ticket', out->0->>'ticket', 'tickets', out);
end $$;
grant execute on function register_event(text, text, jsonb) to anon, authenticated;

-- ---------- Check-in at the venue: people check themselves in with a code ----------
-- A printed code (valid during event hours) and/or a code on a screen that changes every minute.
create or replace function venue_printed_code(secret text) returns text language sql immutable as $$ select 'P' || upper(left(md5(secret || '|printed'), 5)) $$;
create or replace function venue_screen_code(secret text, at timestamptz) returns text language sql immutable as $$
  select 'S' || upper(left(md5(secret || '|' || floor(extract(epoch from at) / 60)::bigint::text), 5)) $$;
-- An hour before each day starts until it ends (Lagos time)
create or replace function event_hours_now(e events) returns boolean language sql stable as $$
  select exists (
    select 1 from jsonb_array_elements(coalesce(nullif(e.data->'dayPlan', '[]'::jsonb),
                    jsonb_build_array(jsonb_build_object('date', left(e.data->>'start', 10), 'start', '00:00', 'end', '23:59')))) d
     where now() between ((d->>'date') || 'T' || (d->>'start') || ':00+01:00')::timestamptz - interval '1 hour'
                     and ((d->>'date') || 'T' || (d->>'end') || ':00+01:00')::timestamptz)
$$;
create or replace function venue_code_ok(e events, p_code text) returns text
language plpgsql stable security definer set search_path = public as $$
declare v jsonb := e.data->'venueCheckin'; k text := upper(trim(coalesce(p_code, ''))); s text := v->>'secret';
begin
  if v is null or not coalesce((v->>'on')::boolean, false) or length(coalesce(s, '')) < 8 then return 'bad'; end if;
  if not ((coalesce((v->>'printed')::boolean, false) and k = venue_printed_code(s))
       or (coalesce((v->>'screen')::boolean, false) and k in (venue_screen_code(s, now()), venue_screen_code(s, now() - interval '1 minute')))) then
    return 'bad';
  end if;
  if not event_hours_now(e) then return 'closed'; end if;
  return 'ok';
end $$;

-- Mask a name for "Is this you?": Grace A••••
create or replace function mask_name(n text) returns text language sql immutable as $$
  select case when position(' ' in trim(n)) > 0
    then split_part(trim(n), ' ', 1) || ' ' || left(trim(substr(trim(n), position(' ' in trim(n)) + 1)), 1) || repeat('•', least(4, greatest(2, length(trim(substr(trim(n), position(' ' in trim(n)) + 1))) - 1)))
    else left(trim(n), 2) || '•••' end
$$;

create or replace function venue_find_reg(c uuid, e events, p_who text) returns registrations
language sql stable security definer set search_path = public as $$
  select r.* from registrations r
   where r.church_id = c and r.event_id = e.id and (
     case when position('@' in coalesce(p_who, '')) > 0 then lower(r.data->>'email') = lower(trim(p_who))
          when length(regexp_replace(coalesce(p_who, ''), '\D', '', 'g')) >= 10 then
            right(regexp_replace(coalesce(r.data->>'phone', ''), '\D', '', 'g'), 10) = right(regexp_replace(p_who, '\D', '', 'g'), 10)
            or right(regexp_replace(coalesce(r.data->>'altPhone', ''), '\D', '', 'g'), 10) = right(regexp_replace(p_who, '\D', '', 'g'), 10)
          else false end)
   order by (r.data->>'byRegId') nulls first, r.data->>'at' limit 1
$$;

-- Step 1: who is this? Shows only a partly hidden name.
create or replace function venue_checkin_find(p_slug text, p_event text, p_code text, p_who text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c uuid; e events; ok text; r registrations;
begin
  select id into c from churches where slug = p_slug;
  select * into e from events where church_id = c and slug = p_event and status = 'published';
  if e.id is null then return jsonb_build_object('status', 'no-event'); end if;
  ok := venue_code_ok(e, p_code);
  if ok <> 'ok' then return jsonb_build_object('status', case ok when 'closed' then 'closed' else 'bad-code' end); end if;
  r := venue_find_reg(c, e, p_who);
  if r.id is null then return jsonb_build_object('status', 'not-found'); end if;
  return jsonb_build_object('status', 'found', 'name', mask_name(r.data->>'name'));
end $$;
grant execute on function venue_checkin_find(text, text, text, text) to anon, authenticated;

-- Step 2: "Yes, that's me". Checked in for today, with their ticket.
create or replace function venue_checkin(p_slug text, p_event text, p_code text, p_who text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c uuid; e events; ok text; r registrations; res jsonb;
begin
  select id into c from churches where slug = p_slug;
  select * into e from events where church_id = c and slug = p_event and status = 'published';
  if e.id is null then return jsonb_build_object('status', 'no-event'); end if;
  ok := venue_code_ok(e, p_code);
  if ok <> 'ok' then return jsonb_build_object('status', case ok when 'closed' then 'closed' else 'bad-code' end); end if;
  r := venue_find_reg(c, e, p_who);
  if r.id is null then return jsonb_build_object('status', 'not-found'); end if;
  res := checkin_do(c, e.id, r.id, lagos_today(), null, 'self');
  return jsonb_build_object('status', res->>'result', 'name', r.data->>'name', 'ticket', r.data->>'ticket', 'ticketStatus', r.data->>'status', 'category', r.data->>'category');
end $$;
grant execute on function venue_checkin(text, text, text, text) to anon, authenticated;

-- The organiser's screen and printout: the codes, for people allowed to manage the event or check people in
create or replace function venue_codes(p_event text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare e events; s text;
begin
  select * into e from events where id = p_event and is_church_member(church_id) limit 1;
  if e.id is null or not (event_manager(e.church_id, e.id) or event_checkin_staff(e.church_id, e.id)) then raise exception 'Not allowed'; end if;
  s := e.data->'venueCheckin'->>'secret';
  if length(coalesce(s, '')) < 8 then raise exception 'Switch on check-in at the venue first'; end if;
  return jsonb_build_object('printed', venue_printed_code(s), 'screen', venue_screen_code(s, now()), 'open', event_hours_now(e));
end $$;
grant execute on function venue_codes(text) to authenticated;

-- ---------- Event media: videos and carousels (up to 10 MB each) ----------
-- Files are stored as <church id>/event-<event id>/<random name>, and removed 14 days after the event.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-media', 'event-media', true, 10485760, array['video/mp4', 'video/webm', 'video/quicktime', 'image/webp', 'image/png', 'image/jpeg', 'image/gif'])
on conflict (id) do update set public = true, file_size_limit = 10485760, allowed_mime_types = array['video/mp4', 'video/webm', 'video/quicktime', 'image/webp', 'image/png', 'image/jpeg', 'image/gif'];
drop policy if exists "event media is public" on storage.objects;
create policy "event media is public" on storage.objects for select using (bucket_id = 'event-media');
drop policy if exists "event media upload" on storage.objects;
create policy "event media upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'event-media' and is_church_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "event media remove" on storage.objects;
create policy "event media remove" on storage.objects for delete to authenticated
  using (bucket_id = 'event-media' and (owner = auth.uid() or has_perm(((storage.foldername(name))[1])::uuid, 'events.manage')));

-- For the daily clean-up (server only): events that ended 14+ days ago and still have uploaded media
create or replace function event_media_due() returns table (church_id uuid, event_id text)
language sql stable security definer set search_path = public as $$
  select e.church_id, e.id from events e
   where (e.data->>'end')::timestamptz < now() - interval '14 days'
     and e.data->'page'->>'mediaCleared' is null
     and (e.data->'page'->'media'->>'video' is not null or jsonb_array_length(coalesce(e.data->'page'->'media'->'slides', '[]'::jsonb)) > 0
          or e.data->'page'->'host'->>'video' is not null or jsonb_array_length(coalesce(e.data->'page'->'host'->'photos', '[]'::jsonb)) > 0)
$$;
create or replace function event_media_cleared(c uuid, ev text) returns void
language sql security definer set search_path = public as $$
  update events set data = jsonb_set(
      jsonb_set(data, '{page}', coalesce(data->'page', '{}'::jsonb) #- '{media,video}' #- '{media,slides}' #- '{host,video}' #- '{host,photos}'),
      '{page,mediaCleared}', to_jsonb(now()))
   where church_id = c and id = ev
$$;
revoke all on function event_media_due() from public, anon, authenticated;
revoke all on function event_media_cleared(uuid, text) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function event_media_due() to service_role;
    grant execute on function event_media_cleared(uuid, text) to service_role;
  end if;
end $$;
