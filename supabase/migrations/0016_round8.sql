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
