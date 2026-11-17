-- Traqi for Churches: attendance, welfare, classes, events, finance, messages, invites and the owner dashboard.
-- Run after 0003. Safe to run more than once. Each new table keeps the full item in `data`, plus the columns the privacy rules check.

-- ---------- People and church additions ----------
alter table people add column if not exists photo_url text;
alter table people add column if not exists inactive jsonb;
alter table people add column if not exists is_leader boolean not null default false;
alter table people add column if not exists anniversary date;
alter table people add column if not exists feedback jsonb not null default '[]';
alter table people add column if not exists prefs jsonb not null default '{}';
alter table churches add column if not exists profile jsonb;

-- ---------- Helpers ----------
create or replace function is_pastor(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from role_assignments ra join roles r on r.id = ra.role_id
                  where ra.church_id = c and ra.person_id = my_person(c) and r.key in ('lead', 'pastor'))
$$;

create or replace function leads_group(c uuid, g text) returns boolean
language sql stable security definer set search_path = public as $$
  select g is not null and exists (select 1 from group_members gm
     where gm.church_id = c and gm.person_id = my_person(c) and gm.is_leader and gm.group_id::text = g)
$$;

create or replace function is_welfare_head(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members gm join groups g on g.id = gm.group_id
     where gm.church_id = c and gm.person_id = my_person(c) and gm.is_leader and 'welfare' = any (g.tags))
$$;

-- ---------- A standard shape for the new tables ----------
create or replace function make_data_table(t text, extra text) returns void
language plpgsql as $$
begin
  execute format('create table if not exists %I (
      id text not null,
      church_id uuid not null references churches on delete cascade,
      data jsonb not null,
      %s
      updated_at timestamptz not null default now(),
      primary key (church_id, id))', t, extra);
  execute format('alter table %I enable row level security', t);
end $$;

select make_data_table('meetings', 'kind text, date date,');
select make_data_table('headcounts', 'meeting_id text,');
select make_data_table('attendance_records', 'meeting_id text, person_id uuid,');
select make_data_table('absences', 'person_id uuid,');
select make_data_table('welfare_requests', 'person_id uuid, raised_by uuid, assignee_id uuid, dept_group_id text, stage text, private boolean not null default false, route text[] not null default ''{}'', involve_welfare boolean not null default false,');
select make_data_table('welfare_minutes', 'request_id text,');
select make_data_table('programmes', '');
select make_data_table('class_sessions', 'programme_id text,');
select make_data_table('enrolments', 'person_id uuid, programme_id text,');
select make_data_table('events', 'slug text, status text, created_by uuid,');
select make_data_table('registrations', 'event_id text, person_id uuid,');
select make_data_table('service_counts', 'by_id uuid,');
select make_data_table('lodgements', 'by_id uuid,');
select make_data_table('transfers', 'by_id uuid,');
select make_data_table('message_templates', 'owner_id uuid,');
select make_data_table('announcements', 'by_id uuid,');
select make_data_table('wishes', 'person_id uuid,');
select make_data_table('invites', 'person_id uuid, used_at timestamptz,');
select make_data_table('app_feedback', 'by_id uuid,');
drop function make_data_table(text, text);

create index if not exists attendance_person on attendance_records (church_id, person_id);
create index if not exists attendance_meeting on attendance_records (church_id, meeting_id);
create unique index if not exists events_slug on events (church_id, slug);

-- ---------- Privacy rules ----------
-- Church settings: anyone in the church reads them (via churches select); admins change them (existing policy).

drop policy if exists "read meetings" on meetings;
create policy "read meetings" on meetings for select using (is_church_member(church_id));
drop policy if exists "manage meetings" on meetings;
create policy "manage meetings" on meetings for all using (has_perm(church_id, 'attendance.record') or has_perm(church_id, 'checkin.code') or has_perm(church_id, 'classes.manage') or has_perm(church_id, 'events.manage'));

drop policy if exists "read headcounts" on headcounts;
create policy "read headcounts" on headcounts for select using (is_church_member(church_id));
drop policy if exists "record headcounts" on headcounts;
create policy "record headcounts" on headcounts for all using (has_perm(church_id, 'attendance.record'));

drop policy if exists "read attendance" on attendance_records;
create policy "read attendance" on attendance_records for select using (person_id = my_person(church_id) or has_perm(church_id, 'people.view') or has_perm(church_id, 'attendance.record') or has_perm(church_id, 'classes.manage'));
drop policy if exists "check in" on attendance_records;
create policy "check in" on attendance_records for insert with check (person_id = my_person(church_id) or has_perm(church_id, 'attendance.record') or has_perm(church_id, 'classes.manage') or has_perm(church_id, 'events.manage'));
drop policy if exists "correct attendance" on attendance_records;
create policy "correct attendance" on attendance_records for update using (has_perm(church_id, 'attendance.record') or has_perm(church_id, 'classes.manage'));

drop policy if exists "own absences" on absences;
create policy "own absences" on absences for all using (person_id = my_person(church_id)) with check (person_id = my_person(church_id));
drop policy if exists "staff read absences" on absences;
create policy "staff read absences" on absences for select using (has_perm(church_id, 'people.view'));

-- Welfare: who can see a request depends on its route (see the spec).
create or replace function welfare_staff(c uuid, w welfare_requests) returns boolean
language sql stable security definer set search_path = public as $$
  select is_lead(c)
      or (is_pastor(c) and not ('lead' = any (w.route)))
      or (is_welfare_head(c) and 'welfare' = any (w.route))
      or (not w.private and 'dept' = any (w.route) and leads_group(c, w.dept_group_id))
      or (w.assignee_id is not null and w.assignee_id = my_person(c))
$$;
drop policy if exists "see welfare" on welfare_requests;
create policy "see welfare" on welfare_requests for select using (welfare_staff(church_id, welfare_requests) or person_id = my_person(church_id) or raised_by = my_person(church_id));
drop policy if exists "raise welfare" on welfare_requests;
create policy "raise welfare" on welfare_requests for insert with check (raised_by = my_person(church_id));
drop policy if exists "handle welfare" on welfare_requests;
create policy "handle welfare" on welfare_requests for update using (welfare_staff(church_id, welfare_requests));
drop policy if exists "read minutes" on welfare_minutes;
create policy "read minutes" on welfare_minutes for select using (exists (select 1 from welfare_requests w where w.church_id = welfare_minutes.church_id and w.id = welfare_minutes.request_id and welfare_staff(w.church_id, w)));
drop policy if exists "write minutes" on welfare_minutes;
create policy "write minutes" on welfare_minutes for insert with check (exists (select 1 from welfare_requests w where w.church_id = welfare_minutes.church_id and w.id = welfare_minutes.request_id and welfare_staff(w.church_id, w)));

drop policy if exists "read programmes" on programmes;
create policy "read programmes" on programmes for select using (is_church_member(church_id));
drop policy if exists "manage programmes" on programmes;
create policy "manage programmes" on programmes for all using (has_perm(church_id, 'classes.manage'));
drop policy if exists "read sessions" on class_sessions;
create policy "read sessions" on class_sessions for select using (is_church_member(church_id));
drop policy if exists "manage sessions" on class_sessions;
create policy "manage sessions" on class_sessions for all using (has_perm(church_id, 'classes.manage'));
drop policy if exists "read enrolments" on enrolments;
create policy "read enrolments" on enrolments for select using (person_id = my_person(church_id) or has_perm(church_id, 'classes.manage') or has_perm(church_id, 'people.view'));
drop policy if exists "enrol" on enrolments;
create policy "enrol" on enrolments for insert with check (person_id = my_person(church_id) or has_perm(church_id, 'classes.manage'));
drop policy if exists "manage enrolments" on enrolments;
create policy "manage enrolments" on enrolments for update using (has_perm(church_id, 'classes.manage'));

drop policy if exists "read events" on events;
create policy "read events" on events for select using (is_church_member(church_id) and (status = 'published' or created_by = my_person(church_id) or has_perm(church_id, 'events.manage') or is_pastor(church_id)));
drop policy if exists "create events" on events;
create policy "create events" on events for insert with check (has_perm(church_id, 'events.manage'));
drop policy if exists "edit events" on events;
create policy "edit events" on events for update using (has_perm(church_id, 'events.manage') or is_pastor(church_id));

-- Only a pastor can publish an event.
create or replace function events_publish_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') and not is_pastor(new.church_id) then
    raise exception 'Only a pastor can approve an event';
  end if;
  return new;
end $$;
drop trigger if exists events_publish_guard on events;
create trigger events_publish_guard before insert or update on events for each row execute function events_publish_guard();

drop policy if exists "read registrations" on registrations;
create policy "read registrations" on registrations for select using (person_id = my_person(church_id) or has_perm(church_id, 'events.manage') or is_pastor(church_id));
drop policy if exists "register" on registrations;
create policy "register" on registrations for insert with check (person_id = my_person(church_id) or has_perm(church_id, 'events.manage'));
drop policy if exists "manage registrations" on registrations;
create policy "manage registrations" on registrations for all using (has_perm(church_id, 'events.manage'));

drop policy if exists "read counts" on service_counts;
create policy "read counts" on service_counts for select using (has_perm(church_id, 'finance.view') or has_perm(church_id, 'finance.count'));
drop policy if exists "submit counts" on service_counts;
create policy "submit counts" on service_counts for insert with check (has_perm(church_id, 'finance.count'));
drop policy if exists "correct counts" on service_counts;
create policy "correct counts" on service_counts for update using (has_perm(church_id, 'finance.count') or has_perm(church_id, 'finance.approve'));
drop policy if exists "read lodgements" on lodgements;
create policy "read lodgements" on lodgements for select using (has_perm(church_id, 'finance.view') or has_perm(church_id, 'finance.count'));
drop policy if exists "record lodgements" on lodgements;
create policy "record lodgements" on lodgements for all using (has_perm(church_id, 'finance.count') or has_perm(church_id, 'finance.transfers'));
drop policy if exists "read transfers" on transfers;
create policy "read transfers" on transfers for select using (has_perm(church_id, 'finance.view'));
drop policy if exists "record transfers" on transfers;
create policy "record transfers" on transfers for all using (has_perm(church_id, 'finance.transfers'));

drop policy if exists "read templates" on message_templates;
create policy "read templates" on message_templates for select using (is_church_member(church_id));
drop policy if exists "manage templates" on message_templates;
create policy "manage templates" on message_templates for all using (has_perm(church_id, 'messages.bulk') or owner_id = my_person(church_id));
drop policy if exists "read announcements" on announcements;
create policy "read announcements" on announcements for select using (is_church_member(church_id));
drop policy if exists "send announcements" on announcements;
create policy "send announcements" on announcements for all using (has_perm(church_id, 'messages.bulk'));
drop policy if exists "wishes" on wishes;
create policy "wishes" on wishes for all using (has_perm(church_id, 'people.view') or has_perm(church_id, 'messages.bulk'));
drop policy if exists "manage invites" on invites;
create policy "manage invites" on invites for all using (has_perm(church_id, 'roles.manage') or has_perm(church_id, 'people.edit'));
drop policy if exists "send feedback" on app_feedback;
create policy "send feedback" on app_feedback for insert with check (by_id = my_person(church_id));

-- ---------- Invites: link whatever account someone signs in with ----------
create or replace function redeem_invite(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare inv invites; p people;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into inv from invites where id = p_token;
  if inv.id is null then raise exception 'This invite link is not valid'; end if;
  if inv.used_at is not null then
    if exists (select 1 from people where id = inv.person_id and user_id = auth.uid()) then return inv.church_id; end if;
    raise exception 'This invite link has already been used';
  end if;
  select * into p from people where id = inv.person_id;
  if p.user_id is not null and p.user_id <> auth.uid() then raise exception 'This person already has an account'; end if;
  if exists (select 1 from people where church_id = inv.church_id and user_id = auth.uid() and id <> p.id) then
    raise exception 'This account is already linked to someone else in this church';
  end if;
  update people set user_id = auth.uid() where id = p.id;
  update invites set used_at = now(), data = data || jsonb_build_object('usedAt', now()) where church_id = inv.church_id and id = inv.id;
  insert into activity_log (church_id, actor_id, action) values (inv.church_id, p.id, 'joined Traqi with an invite link');
  return inv.church_id;
end $$;

-- ---------- Public: church page ----------
create or replace function church_page(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', c.name, 'slug', c.slug, 'profile', coalesce(c.profile, '{}'::jsonb),
    'events', coalesce((select jsonb_agg(e.data order by e.data->>'start') from events e
                         where e.church_id = c.id and e.status = 'published' and (e.data->>'end')::timestamptz > now()), '[]'::jsonb))
  from churches c where c.slug = p_slug
$$;

-- ---------- Public: Sunday check-in by link ----------
create or replace function checkin_public(p_slug text, p_code text, p_phone text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c uuid; m meetings; p people; key text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
begin
  select id into c from churches where slug = p_slug;
  if c is null then return jsonb_build_object('status', 'no-church'); end if;
  select * into m from meetings
   where church_id = c and coalesce((data->>'checkin')::boolean, false)
     and now() between (data->>'start')::timestamptz - interval '30 minutes' and (data->>'end')::timestamptz
   order by data->>'start' limit 1;
  if m.id is null then return jsonb_build_object('status', 'no-meeting'); end if;
  if coalesce(m.data->>'code', '') <> trim(coalesce(p_code, '')) then return jsonb_build_object('status', 'bad-code'); end if;
  select * into p from people where church_id = c and right(regexp_replace(phone, '\D', '', 'g'), 10) = key limit 1;
  if p.id is null then return jsonb_build_object('status', 'not-found', 'meeting', m.data->>'name'); end if;
  if exists (select 1 from attendance_records where church_id = c and meeting_id = m.id and person_id = p.id) then
    return jsonb_build_object('status', 'already', 'meeting', m.data->>'name');
  end if;
  insert into attendance_records (id, church_id, meeting_id, person_id, data)
  values (gen_random_uuid()::text, c, m.id, p.id, jsonb_build_object('meetingId', m.id, 'personId', p.id, 'method', 'link', 'at', now()))
  returning id into key;
  update attendance_records set data = data || jsonb_build_object('id', key) where church_id = c and id = key;
  update people set last_seen = current_date, missed_in_a_row = 0, tracked = true where id = p.id;
  return jsonb_build_object('status', 'ok', 'meeting', m.data->>'name');
end $$;

-- ---------- Public: the two-part first-timer form, with feedback ----------
create or replace function welcome_v2(
  p_slug text, p_first text, p_last text, p_gender text, p_phone text, p_location text, p_heard text, p_consent boolean, p_feedback jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c uuid; p people; pid uuid; who uuid; m text; key text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
begin
  if length(key) < 10 then raise exception 'Enter a valid phone number'; end if;
  select id into c from churches where slug = p_slug;
  if c is null then raise exception 'Church not found'; end if;
  -- The service happening today, if any
  select id into m from meetings where church_id = c and date = current_date order by data->>'start' desc limit 1;

  select * into p from people where church_id = c and right(regexp_replace(phone, '\D', '', 'g'), 10) = key limit 1;
  if p.id is not null then
    -- Known: add today's feedback; a first-timer seen on a later day is now returning
    update people set
      feedback = coalesce(feedback, '[]'::jsonb) || coalesce(case when p_feedback is not null then jsonb_build_array(p_feedback) end, '[]'::jsonb),
      location = coalesce(location, nullif(trim(p_location), '')), heard_from = coalesce(heard_from, nullif(p_heard, '')),
      stage = case when stage = 'first_timer' and first_visit < current_date then 'returning' else stage end,
      last_seen = current_date
    where id = p.id;
    if p.stage = 'first_timer' and p.first_visit < current_date then
      update followup_cases set stage = 'returned' where person_id = p.id and stage in ('new', 'contacted', 'visited');
    end if;
    if m is not null and not exists (select 1 from attendance_records where church_id = c and meeting_id = m and person_id = p.id) then
      insert into attendance_records (id, church_id, meeting_id, person_id, data)
      values (gen_random_uuid()::text, c, m, p.id, jsonb_build_object('meetingId', m, 'personId', p.id, 'method', 'welcome', 'at', now()));
    end if;
    return jsonb_build_object('status', case when p.first_visit < current_date then 'back' else 'updated' end);
  end if;

  if not coalesce(p_consent, false) then raise exception 'Consent is required'; end if;
  if length(trim(coalesce(p_first, ''))) = 0 or length(trim(coalesce(p_last, ''))) = 0 then raise exception 'Enter your name'; end if;
  if p_gender not in ('M', 'F') then raise exception 'Choose male or female'; end if;

  insert into people (church_id, first_name, last_name, gender, phone, whatsapp, location, heard_from, stage, tracked, first_visit, last_seen, consent_at, consent_via, feedback)
  values (c, trim(p_first), trim(p_last), p_gender, trim(p_phone), trim(p_phone), nullif(trim(p_location), ''), nullif(p_heard, ''), 'first_timer', true,
          current_date, current_date, now(), 'welcome-form', coalesce(case when p_feedback is not null then jsonb_build_array(p_feedback) end, '[]'::jsonb))
  returning id into pid;

  select gm.person_id into who
    from group_members gm join groups g on g.id = gm.group_id and 'followup' = any (g.tags)
    left join people tp on tp.id = gm.person_id
   where gm.church_id = c
   group by gm.person_id, tp.location
   order by (tp.location is not null and lower(tp.location) = lower(coalesce(p_location, ''))) desc,
            (select count(*) from followup_cases fc where fc.assignee_id = gm.person_id and fc.stage in ('new', 'contacted', 'visited')) asc
   limit 1;
  insert into followup_cases (church_id, person_id, assignee_id) values (c, pid, who);
  if m is not null then
    insert into attendance_records (id, church_id, meeting_id, person_id, data)
    values (gen_random_uuid()::text, c, m, pid, jsonb_build_object('meetingId', m, 'personId', pid, 'method', 'welcome', 'at', now()));
  end if;
  insert into activity_log (church_id, actor_id, action, target_table, target_id) values (c, pid, 'filled in the welcome form', 'people', pid);
  return jsonb_build_object('status', 'new');
end $$;

-- ---------- Public: event page and registration ----------
create or replace function event_page(p_slug text, p_event text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('church', jsonb_build_object('name', c.name, 'slug', c.slug, 'profile', coalesce(c.profile, '{}'::jsonb)),
         'event', e.data, 'registered', (select coalesce(sum(1 + coalesce((r.data->>'guests')::int, 0)), 0) from registrations r where r.church_id = c.id and r.event_id = e.id and r.data->>'status' = 'confirmed'))
  from churches c join events e on e.church_id = c.id
  where c.slug = p_slug and e.slug = p_event and e.status = 'published'
$$;

create or replace function register_event(p_slug text, p_event text, p_reg jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c uuid; e events; taken int; cap int; st text; tk text; rid text := gen_random_uuid()::text; pid uuid;
        key text := right(regexp_replace(coalesce(p_reg->>'phone', ''), '\D', '', 'g'), 10);
begin
  if length(key) < 10 then raise exception 'Enter a valid phone number'; end if;
  if length(trim(coalesce(p_reg->>'name', ''))) < 2 then raise exception 'Enter your name'; end if;
  select id into c from churches where slug = p_slug;
  select * into e from events where church_id = c and slug = p_event and status = 'published';
  if e.id is null then raise exception 'This event is not open for registration'; end if;
  if e.data->>'closesAt' is not null and now() > (e.data->>'closesAt')::timestamptz then raise exception 'Registration has closed'; end if;
  if exists (select 1 from registrations where church_id = c and event_id = e.id and right(regexp_replace(data->>'phone', '\D', '', 'g'), 10) = key) then
    select data->>'ticket' into tk from registrations where church_id = c and event_id = e.id and right(regexp_replace(data->>'phone', '\D', '', 'g'), 10) = key limit 1;
    return jsonb_build_object('status', 'already', 'ticket', tk);
  end if;
  select coalesce(sum(1 + coalesce((data->>'guests')::int, 0)), 0) into taken from registrations where church_id = c and event_id = e.id and data->>'status' = 'confirmed';
  cap := nullif(e.data->>'capacity', '')::int;
  st := case when coalesce((e.data->>'needsApproval')::boolean, false) then 'pending'
             when cap is not null and taken + 1 + coalesce((p_reg->>'guests')::int, 0) > cap then 'waitlist' else 'confirmed' end;
  tk := upper(substr(regexp_replace(e.slug, '[^a-z]', '', 'g'), 1, 4)) || '-' || upper(substr(md5(random()::text), 1, 5));
  select id into pid from people where church_id = c and right(regexp_replace(phone, '\D', '', 'g'), 10) = key limit 1;
  insert into registrations (id, church_id, event_id, person_id, data)
  values (rid, c, e.id, pid, p_reg || jsonb_build_object('id', rid, 'eventId', e.id, 'personId', pid, 'ticket', tk, 'status', st, 'checkins', '[]'::jsonb, 'at', now()));
  return jsonb_build_object('status', st, 'ticket', tk);
end $$;

-- ---------- The Traqi owner dashboard ----------
create table if not exists platform_owners (user_id uuid primary key references auth.users on delete cascade);
alter table platform_owners enable row level security;
-- No policies: only the functions below read it. Add yourself once in the SQL editor:
--   insert into platform_owners select id from auth.users where email = 'you@example.com';

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_owners where user_id = auth.uid())
$$;

create or replace function owner_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_owner() then raise exception 'Not allowed'; end if;
  return jsonb_build_object(
    'churches', coalesce((select jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'slug', c.slug, 'country', c.country, 'created_at', c.created_at,
        'people', (select count(*) from people p where p.church_id = c.id),
        'members', (select count(*) from people p where p.church_id = c.id and p.stage not in ('first_timer') and not p.is_child),
        'staff', (select count(*) from people p where p.church_id = c.id and p.user_id is not null),
        'active_week', (select count(distinct a.actor_id) from activity_log a where a.church_id = c.id and a.at > now() - interval '7 days'),
        'last_active', (select max(a.at) from activity_log a where a.church_id = c.id),
        'checkins', (select count(*) from attendance_records r where r.church_id = c.id),
        'followups', (select count(*) from followup_contacts f where f.church_id = c.id),
        'classes', (select count(*) from programmes x where x.church_id = c.id),
        'events', (select count(*) from events x where x.church_id = c.id),
        'messages', (select count(*) from announcements x where x.church_id = c.id)
      ) order by c.created_at desc) from churches c), '[]'::jsonb),
    'feedback', coalesce((select jsonb_agg(jsonb_build_object('church', c.name, 'text', f.data->>'text', 'screen', f.data->>'screen', 'at', f.data->>'at') order by f.updated_at desc)
                          from app_feedback f join churches c on c.id = f.church_id), '[]'::jsonb)
  );
end $$;

grant execute on function redeem_invite(text) to authenticated;
grant execute on function church_page(text) to anon, authenticated;
grant execute on function checkin_public(text, text, text) to anon, authenticated;
grant execute on function welcome_v2(text, text, text, text, text, text, text, boolean, jsonb) to anon, authenticated;
grant execute on function event_page(text, text) to anon, authenticated;
grant execute on function register_event(text, text, jsonb) to anon, authenticated;
grant execute on function is_owner() to authenticated;
grant execute on function owner_stats() to authenticated;

-- The Media head can create events by default (approval still needs a pastor).
update roles set permissions = array_append(permissions, 'events.manage') where key = 'media' and not ('events.manage' = any (permissions));
