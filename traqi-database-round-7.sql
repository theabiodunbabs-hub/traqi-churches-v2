-- Round 7: the event page as a way into Traqi.
-- "I'm a member" on an event page → Continue with Google → either Home (already in the church)
-- or the form filled in from Google, which registers them AND joins them to the church.
-- Safe to run more than once. Run after round 6.

-- ---------- Who is this, for this event? ----------
-- Signed in with Google on an event page: are they in the church hosting it, what do we already know, and their tickets.
create or replace function event_member_status(p_slug text, p_event text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c uuid; e events; p people; tickets jsonb;
begin
  if auth.uid() is null then return jsonb_build_object('signedIn', false, 'member', false, 'tickets', '[]'::jsonb); end if;
  select id into c from churches where slug = p_slug;
  select * into e from events where church_id = c and slug = p_event and status = 'published';
  if e.id is null then raise exception 'This event is not open for registration'; end if;
  select * into p from people where church_id = c and user_id = auth.uid() limit 1;
  if p.id is null then
    return jsonb_build_object('signedIn', true, 'member', false, 'churchId', c, 'email', (select email from auth.users where id = auth.uid()), 'tickets', '[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('name', r.data->>'name', 'ticket', r.data->>'ticket', 'status', r.data->>'status') order by r.data->>'at'), '[]'::jsonb)
    into tickets from registrations r where r.church_id = c and r.event_id = e.id and r.person_id = p.id;
  return jsonb_build_object('signedIn', true, 'member', true, 'churchId', c, 'email', coalesce(p.email, (select email from auth.users where id = auth.uid())),
    'person', jsonb_build_object('firstName', p.first_name, 'lastName', p.last_name, 'phone', p.phone, 'gender', p.gender, 'email', p.email,
                                 'birthday', case when p.birthday is null then null else to_char(p.birthday, 'YYYY-MM-DD') end),
    'tickets', tickets);
end $$;
grant execute on function event_member_status(text, text) to authenticated;

-- ---------- A member registers (and joins the church, if they're new) ----------
create or replace function register_event_member(p_slug text, p_event text, p_reg jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c uuid; e events; me uuid; joined boolean := false; res jsonb; mail text; reg jsonb; bd text := nullif(p_reg->>'birthday', '');
begin
  if auth.uid() is null then raise exception 'Sign in with Google first'; end if;
  select id into c from churches where slug = p_slug;
  select * into e from events where church_id = c and slug = p_event and status = 'published';
  if e.id is null then raise exception 'This event is not open for registration'; end if;
  select email into mail from auth.users where id = auth.uid();

  select id into me from people where church_id = c and user_id = auth.uid() limit 1;
  if me is null then
    -- New to the church: the birthday (day and month) and male or female are needed to join
    if bd is null or bd !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Choose your birthday (day and month)'; end if;
    if coalesce(p_reg->>'gender', '') not in ('M', 'F') then raise exception 'Choose male or female'; end if;
    me := join_church(jsonb_build_object('church', c, 'firstName', p_reg->>'firstName', 'lastName', p_reg->>'lastName',
                                         'gender', p_reg->>'gender', 'phone', p_reg->>'phone', 'birthday', bd));
    -- Like anyone joining from search, they wait for the admin to confirm them (joined_via 'search')
    insert into activity_log (church_id, actor_id, action, target_table, target_id) values (c, me, 'joined by registering for ' || (e.data->>'title'), 'people', me);
    joined := true;
  else
    -- Already in: fill in a birthday the church didn't have
    if bd is not null and bd ~ '^\d{4}-\d{2}-\d{2}$' then update people set birthday = bd::date where id = me and birthday is null; end if;
  end if;

  -- Registered already (by this account)? Give back their tickets
  if exists (select 1 from registrations where church_id = c and event_id = e.id and person_id = me) then
    select jsonb_agg(jsonb_build_object('name', data->>'name', 'ticket', data->>'ticket', 'status', 'already') order by data->>'at')
      into res from registrations where church_id = c and event_id = e.id and person_id = me;
    return jsonb_build_object('status', 'already', 'ticket', res->0->>'ticket', 'tickets', res, 'churchId', c, 'joined', joined);
  end if;

  -- The email is always the Google account's
  reg := (p_reg - 'gender' - 'birthday') || jsonb_build_object('email', mail);
  res := register_event(p_slug, p_event, reg);
  -- The new registration (and an older one with the same phone, not yet linked) belongs to this member
  update registrations set person_id = me, data = jsonb_set(data, '{personId}', to_jsonb(me::text))
   where church_id = c and event_id = e.id and data->>'byRegId' is null and (person_id is null or person_id = me)
     and (data->>'ticket' = res->>'ticket'
          or right(regexp_replace(coalesce(data->>'phone', ''), '\D', '', 'g'), 10) = right(regexp_replace(coalesce(p_reg->>'phone', ''), '\D', '', 'g'), 10));
  return res || jsonb_build_object('churchId', c, 'joined', joined);
end $$;
grant execute on function register_event_member(text, text, jsonb) to authenticated;
