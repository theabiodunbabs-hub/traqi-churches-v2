-- =====================================================================
-- Traqi for Churches: database update, round 2
-- Covers everything after step 3: v1 features, photo storage and extra
-- fields, joining and starting churches, roles and approvals, journey,
-- prayer requests, downloads log, events v2, and email.
--
-- Run it once in Supabase: SQL Editor, New query, paste all, Run.
-- It is safe to run again if anything stops halfway.
-- =====================================================================


-- ---------------------------------------------------------------- 0004_v1_features
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

-- ---------------------------------------------------------------- 0005_storage_and_fields
-- Traqi for Churches: file storage for logos, photos and flyers, and extra fields on people.
-- Safe to run more than once.

-- ---------- Extra details churches record about people ----------
alter table people add column if not exists custom jsonb not null default '{}';

-- ---------- Storage: one public bucket, a folder per church ----------
-- Files are stored as <church id>/<kind>/<random name>.webp
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/webp', 'image/png', 'image/jpeg'];

-- Anyone can view (logos and flyers appear on public pages)
drop policy if exists "media is public" on storage.objects;
create policy "media is public" on storage.objects for select using (bucket_id = 'media');

-- People in a church can add files to their own church's folder only
drop policy if exists "upload to my church" on storage.objects;
create policy "upload to my church" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and is_church_member(((storage.foldername(name))[1])::uuid));

-- Admins and the person who uploaded can remove files
drop policy if exists "remove my church files" on storage.objects;
create policy "remove my church files" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (owner = auth.uid() or has_perm(((storage.foldername(name))[1])::uuid, 'roles.manage')));

-- ---------- Extra details from the welcome form ----------
-- A first-timer answers the church's extra questions after service. Only fields the church marked
-- "on the welcome form" are accepted, only for someone whose first visit was in the last 7 days,
-- and nothing is read back.
create or replace function welcome_custom(p_slug text, p_phone text, p_answers jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare c uuid; allowed jsonb; key text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10); clean jsonb := '{}';
  k text; v jsonb;
begin
  if length(key) < 10 or p_answers is null or jsonb_typeof(p_answers) <> 'object' then return; end if;
  select id, coalesce(profile->'customFields', '[]') into c, allowed from churches where slug = p_slug;
  if c is null then return; end if;
  for k, v in select * from jsonb_each(p_answers) loop
    if exists (select 1 from jsonb_array_elements(allowed) f where f->>'id' = k and coalesce((f->>'onWelcome')::boolean, false))
       and jsonb_typeof(v) = 'string' and length(v #>> '{}') <= 200 then
      clean := clean || jsonb_build_object(k, v);
    end if;
  end loop;
  update people set custom = coalesce(custom, '{}') || clean
  where church_id = c and right(regexp_replace(phone, '\D', '', 'g'), 10) = key and first_visit >= current_date - 7;
end $$;
grant execute on function welcome_custom(text, text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------- 0006_round2
-- Traqi for Churches, round 2: joining and starting churches, each church's own journey,
-- roles with approval and end dates, assistants, follow-up settings, branches and downloads.
-- Safe to run more than once.

create extension if not exists pg_trgm;

-- ===================================================================
-- Columns
-- ===================================================================
alter table churches add column if not exists verified boolean not null default false;
alter table churches add column if not exists city text;

-- Stages are now each church's own words, so the stage is plain text
alter table people alter column stage drop default;
alter table people alter column stage type text using stage::text;
alter table people alter column stage set default 'first_timer';
alter table people add column if not exists confirmed_at timestamptz;
alter table people add column if not exists joined_via text;
alter table people add column if not exists branch_id text;
alter table people add column if not exists extra jsonb not null default '{}';
-- Families often share one phone, so a phone number no longer has to be unique in a church
alter table people drop constraint if exists people_church_id_phone_key;
create index if not exists people_phone on people (church_id, phone);
alter table people drop constraint if exists people_consent_via_check;
alter table people add constraint people_consent_via_check check (consent_via in ('welcome-form', 'update-link', 'staff', 'import', 'joined', 'self'));
-- Everyone already in a church is confirmed
update people set confirmed_at = coalesce(created_at, now()) where confirmed_at is null and coalesce(joined_via, '') <> 'search';

alter table groups add column if not exists branch_id text;
alter table groups add column if not exists extra jsonb not null default '{}';

alter table role_assignments drop constraint if exists role_assignments_scope_type_check;
alter table role_assignments add constraint role_assignments_scope_type_check check (scope_type in ('church', 'groups', 'self', 'branch', 'region'));
alter table role_assignments add column if not exists scope_ref text;
alter table role_assignments add column if not exists until timestamptz;
alter table role_assignments add column if not exists pending jsonb;

-- ===================================================================
-- Permissions ignore roles waiting for approval and roles that have ended
-- ===================================================================
create or replace function has_perm(c uuid, perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from role_assignments ra join roles r on r.id = ra.role_id
    where ra.church_id = c and ra.person_id = my_person(c)
      and (perm = any (r.permissions) or r.key = 'lead')
      and (ra.pending is null or ra.pending->>'action' = 'remove')
      and (ra.until is null or ra.until > now())
  )
$$;

create or replace function is_pastor(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from role_assignments ra join roles r on r.id = ra.role_id
                  where ra.church_id = c and ra.person_id = my_person(c) and r.key in ('lead', 'pastor')
                    and (ra.pending is null or ra.pending->>'action' = 'remove') and (ra.until is null or ra.until > now()))
$$;

-- An admin's role changes wait for a pastor: new roles arrive marked pending, and only pastors remove roles.
create or replace function role_change_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if; -- set-up scripts and the database itself
  if tg_op = 'DELETE' then
    if not is_pastor(old.church_id) then raise exception 'A pastor needs to approve removing a role'; end if;
    return old;
  end if;
  if not is_pastor(new.church_id) then
    if tg_op = 'INSERT' then
      new.pending := jsonb_build_object('byId', my_person(new.church_id), 'at', now(), 'action', 'give');
    elsif new.pending is distinct from old.pending and (old.pending is not null and new.pending is null) then
      raise exception 'Only a pastor can approve a role change';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists role_change_guard on role_assignments;
create trigger role_change_guard before insert or update or delete on role_assignments for each row execute function role_change_guard();

-- People editing their own record can't change their stage, confirmation, leader mark or probation
create or replace function people_self_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or has_perm(new.church_id, 'people.edit') then return new; end if;
  if new.stage is distinct from old.stage or new.confirmed_at is distinct from old.confirmed_at
     or new.is_leader is distinct from old.is_leader or new.tracked is distinct from old.tracked
     or new.joined_via is distinct from old.joined_via or new.branch_id is distinct from old.branch_id
     or new.inactive is distinct from old.inactive or new.user_id is distinct from old.user_id
     or (new.extra->'probation') is distinct from (old.extra->'probation')
     or (new.extra->'possibleMatchId') is distinct from (old.extra->'possibleMatchId') then
    raise exception 'Only church staff can change that';
  end if;
  return new;
end $$;
drop trigger if exists people_self_guard on people;
create trigger people_self_guard before update on people for each row execute function people_self_guard();

-- ===================================================================
-- Finding a church
-- ===================================================================
-- "Christ Apostolic Church" → "cac"; filler words are skipped
create or replace function church_acronym(n text) returns text
language sql immutable as $$
  select coalesce(string_agg(left(w, 1), ''), '') from unnest(regexp_split_to_array(lower(regexp_replace(n, '[^a-zA-Z0-9 ]', ' ', 'g')), '\s+')) w
  where w <> '' and w not in ('the', 'of', 'and', 'in', 'for', 'a', 'an')
$$;
create or replace function church_words(n text) returns text
language sql immutable as $$
  select trim(regexp_replace(lower(n), '\m(the|church|churches|ministries|ministry|international|chapel|assembly|centre|center|of|and|incorporated|inc|global)\M', ' ', 'g'))
$$;

create or replace function search_churches(q text) returns table (
  id uuid, name text, slug text, city text, state text, address text, logo text, color text, verified boolean,
  branches jsonb, score real
) language sql stable security definer set search_path = public as $$
  with t as (select lower(trim(coalesce(q, ''))) as q)
  select c.id, c.name, c.slug, coalesce(c.city, c.profile->>'city'), c.profile->>'state', c.profile->>'address',
         c.profile->>'logo', c.profile->>'color', c.verified,
         coalesce((select jsonb_agg(jsonb_build_object('id', b->>'id', 'name', b->>'name', 'city', b->>'city', 'address', b->>'address'))
                   from jsonb_array_elements(coalesce(c.profile->'branches', '[]')) b), '[]'),
         greatest(
           case when church_acronym(c.name) = t.q then 1.0 when church_acronym(c.name) like t.q || '%' then 0.8 else 0 end,
           case when lower(c.name) like '%' || t.q || '%' then 0.9 else 0 end,
           case when c.slug = t.q then 1.0 else 0 end,
           similarity(church_words(c.name), t.q), word_similarity(t.q, lower(c.name)),
           similarity(lower(coalesce(c.city, c.profile->>'city', '')), t.q) * 0.6
         )::real as score
  from churches c, t
  where length(t.q) >= 2
  order by score desc, c.verified desc, c.name
  limit 30
$$;
-- Only results that genuinely match
create or replace function find_churches(q text) returns setof jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(s) from search_churches(q) s where s.score >= 0.3 limit 10
$$;
grant execute on function find_churches(text) to anon, authenticated;

-- Words the app uses for its own pages can't be church addresses
create or replace function slug_reserved(s text) returns boolean language sql immutable as $$
  select s = any (array['today','people','first-timers','welfare','attendance','classes','events','departments','finance','messages','settings',
    'activity','owner','login','signup','start','join','welcome','update','display','checkin','invite','api','c','e','admin','help','about',
    'pricing','privacy','terms','support','traqi','app','www','mail','static','public','auth','dashboard'])
$$;
create or replace function slug_available(s text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v text := trim(both '-' from lower(regexp_replace(coalesce(s, ''), '[^a-zA-Z0-9]+', '-', 'g'))); taken boolean;
begin
  if length(v) < 2 then return jsonb_build_object('ok', false, 'reason', 'Too short'); end if;
  if length(v) > 40 then return jsonb_build_object('ok', false, 'reason', 'Too long'); end if;
  if slug_reserved(v) then return jsonb_build_object('ok', false, 'reason', 'Reserved', 'suggest', jsonb_build_array(v || '-church')); end if;
  select exists (select 1 from churches where slug = v) into taken;
  if taken then
    return jsonb_build_object('ok', false, 'reason', 'Taken', 'suggest',
      (select jsonb_agg(x) from (select v || '-' || n as x from unnest(array['lagos','church','ng','1']) n where not exists (select 1 from churches where slug = v || '-' || n)) y));
  end if;
  return jsonb_build_object('ok', true, 'slug', v);
end $$;

-- ===================================================================
-- Starting a church (replaces create_church for new sign-ups)
-- ===================================================================
create or replace function create_church_v2(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  c uuid; me uuid; v_slug text; r_lead uuid; r_role uuid; g jsonb; gid uuid; u jsonb; role_key text := coalesce(p->>'role', 'lead');
  chk jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if length(trim(coalesce(p->>'name', ''))) < 3 then raise exception 'Church name is too short'; end if;
  if length(trim(coalesce(p->'profile'->>'address', ''))) < 5 then raise exception 'Add your church address'; end if;
  chk := slug_available(p->>'slug');
  if not (chk->>'ok')::boolean then raise exception 'That web address is not available'; end if;
  v_slug := chk->>'slug';

  insert into churches (name, slug, country, currency, time_zone, template, attendance_goal, profile, city)
  values (trim(p->>'name'), v_slug, coalesce(p->>'country', 'Nigeria'), coalesce(p->>'currency', 'NGN'), coalesce(p->>'timeZone', 'Africa/Lagos'),
          'pentecostal', nullif(p->>'goal', '')::int, coalesce(p->'profile', '{}'), p->'profile'->>'city')
  returning id into c;

  insert into people (church_id, first_name, last_name, gender, phone, email, stage, user_id, tracked, first_visit, consent_at, consent_via, confirmed_at, joined_via, is_leader)
  values (c, trim(p->'me'->>'firstName'), trim(p->'me'->>'lastName'), p->'me'->>'gender', trim(p->'me'->>'phone'), nullif(trim(p->'me'->>'email'), ''),
          coalesce(p->'profile'->'journey'->'stages'->-1->>'key', 'leader'), auth.uid(), true, current_date, now(), 'staff', now(), 'staff', true)
  returning id into me;

  insert into roles (church_id, key, name, description, level, is_default, permissions) values
    (c, 'lead', 'Lead pastor', 'Sees everything, assigns oversight, approves corrections', 1, true,
      '{people.view,people.edit,people.contacts,care.view,followup.assign,followup.log,groups.manage,attendance.record,checkin.code,finance.approve,finance.transfers,finance.view,classes.manage,events.manage,messages.bulk,roles.manage,activity.view,billing.manage}'),
    (c, 'pastor', 'Pastorate', 'Resident and associate pastors; oversee their assigned areas', 2, true,
      '{people.view,people.edit,people.contacts,care.view,followup.assign,followup.log,groups.manage,attendance.record,classes.manage,events.manage,messages.bulk}'),
    (c, 'admin', 'Admin', 'Setup, records, events, communication and classes', 3, true,
      '{people.view,people.edit,people.contacts,followup.assign,followup.log,groups.manage,attendance.record,checkin.code,classes.manage,events.manage,messages.bulk,roles.manage,activity.view,billing.manage}'),
    (c, 'dept', 'Department leader', 'Leads a department or unit and its people', 4, true,
      '{people.view,people.edit,people.contacts,groups.manage,attendance.record,messages.bulk}'),
    (c, 'followup', 'Follow-up lead', 'Receives and assigns first-timers', 4, true, '{followup.assign,followup.log,people.contacts}'),
    (c, 'care', 'Care leader', 'Leaders who read care notes', 4, true, '{care.view}'),
    (c, 'usher', 'Head usher', 'Records attendance and offering counts', 5, true, '{attendance.record,checkin.code,finance.count}'),
    (c, 'media', 'Media head', 'Creates events and shares them', 5, true, '{events.manage}'),
    (c, 'worker', 'Worker', 'Serves in a department', 6, true, '{}'),
    (c, 'member', 'Member', 'Belongs to the church', 7, true, '{}');

  select r.id into r_lead from roles r where r.church_id = c and r.key = 'lead';
  select r.id into r_role from roles r where r.church_id = c and r.key = case when role_key in ('pastor', 'admin') then role_key else 'lead' end;
  -- The person starting the church holds full rights until they hand over the lead pastor role
  insert into role_assignments (church_id, person_id, role_id, scope_type) values (c, me, r_lead, 'church');
  if r_role <> r_lead then insert into role_assignments (church_id, person_id, role_id, scope_type) values (c, me, r_role, 'church'); end if;

  -- Departments and their units, as chosen (and edited) at sign-up
  for g in select * from jsonb_array_elements(coalesce(p->'departments', '[]')) loop
    insert into groups (church_id, name, kind, purpose, tags) values (c, g->>'name', 'department', coalesce(g->>'purpose', ''),
      coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(g->'tags', '[]')) x), '{}')) returning id into gid;
    for u in select * from jsonb_array_elements(coalesce(g->'units', '[]')) loop
      insert into groups (church_id, name, kind, parent_id, purpose) values (c, u->>'name', 'unit', gid, '');
    end loop;
  end loop;

  insert into activity_log (church_id, actor_id, action) values (c, me, 'created ' || trim(p->>'name') || ' on Traqi');
  return c;
end $$;
grant execute on function create_church_v2(jsonb) to authenticated;
grant execute on function search_churches(text) to anon, authenticated;
grant execute on function slug_available(text) to anon, authenticated;

-- ===================================================================
-- Joining a church from search
-- ===================================================================
-- The person can use Traqi as a member straight away; the admin confirms them later.
-- A matching phone is noted for the admin only; nothing about the existing record is revealed.
create or replace function join_church(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare c uuid := (p->>'church')::uuid; me uuid; match uuid; v_key text := right(regexp_replace(coalesce(p->>'phone', ''), '\D', '', 'g'), 10);
  first_stage text; r_member uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not exists (select 1 from churches where id = c) then raise exception 'Church not found'; end if;
  if exists (select 1 from people where church_id = c and user_id = auth.uid()) then
    return (select id from people where church_id = c and user_id = auth.uid() limit 1);
  end if;
  if length(trim(coalesce(p->>'firstName', ''))) < 1 or length(trim(coalesce(p->>'lastName', ''))) < 1 then raise exception 'Enter your name'; end if;
  if length(v_key) < 10 then raise exception 'Enter a valid phone number'; end if;
  select id into match from people where church_id = c and user_id is null and right(regexp_replace(phone, '\D', '', 'g'), 10) = v_key limit 1;
  select coalesce(profile->'journey'->'stages'->0->>'key', 'first_timer') into first_stage from churches where id = c;
  insert into people (church_id, first_name, last_name, gender, phone, whatsapp, email, birthday, stage, user_id, tracked, first_visit, consent_at, consent_via, joined_via, branch_id, extra)
  values (c, trim(p->>'firstName'), trim(p->>'lastName'), p->>'gender', trim(p->>'phone'), trim(p->>'phone'), (select email from auth.users where id = auth.uid()),
          nullif(p->>'birthday', '')::date, first_stage, auth.uid(), true, current_date, now(), 'joined', 'search', nullif(p->>'branch', ''),
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

-- The admin merges a new joiner into the record the church already had: the account moves across, the duplicate goes.
create or replace function merge_joiner(p_church uuid, p_new uuid, p_keep uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not has_perm(p_church, 'people.edit') then raise exception 'Not allowed'; end if;
  select user_id into uid from people where id = p_new and church_id = p_church;
  if uid is null then raise exception 'Nothing to merge'; end if;
  if exists (select 1 from people where id = p_keep and church_id = p_church and user_id is not null) then raise exception 'That record already has an account'; end if;
  update people set user_id = null where id = p_new;
  update people set user_id = uid, confirmed_at = coalesce(confirmed_at, now()), extra = extra - 'possibleMatchId' where id = p_keep;
  update attendance_records set person_id = p_keep where person_id = p_new and church_id = p_church;
  delete from role_assignments where person_id = p_new and church_id = p_church;
  delete from people where id = p_new;
  insert into activity_log (church_id, actor_id, action) values (p_church, my_person(p_church), 'merged a new joiner with their existing record');
end $$;
grant execute on function merge_joiner(uuid, uuid, uuid) to authenticated;

-- Every church this account belongs to, for the church switcher
create or replace function my_churches() returns table (id uuid, name text, slug text, logo text, color text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.slug, c.profile->>'logo', c.profile->>'color'
  from churches c where exists (select 1 from people p where p.church_id = c.id and p.user_id = auth.uid())
  order by c.name
$$;
grant execute on function my_churches() to authenticated;

-- The owner's verified tick
create or replace function set_church_verified(p_church uuid, p_verified boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_owner() then raise exception 'Not allowed'; end if;
  update churches set verified = p_verified where id = p_church;
end $$;
grant execute on function set_church_verified(uuid, boolean) to authenticated;

-- Owner view: the address, directions and photo help decide the verified tick
create or replace function owner_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_owner() then raise exception 'Not allowed'; end if;
  return jsonb_build_object(
    'churches', coalesce((select jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'slug', c.slug, 'country', c.country, 'created_at', c.created_at, 'verified', c.verified,
        'level', c.profile->>'level', 'address', c.profile->>'address', 'directions', c.profile->>'directions',
        'city', coalesce(c.city, c.profile->>'city'), 'pin', c.profile->'pin', 'photo', c.profile->>'buildingPhoto',
        'branches', jsonb_array_length(coalesce(c.profile->'branches', '[]')),
        'people', (select count(*) from people p where p.church_id = c.id),
        'members', (select count(*) from people p where p.church_id = c.id and p.stage not in ('first_timer') and not p.is_child),
        'staff', (select count(*) from people p where p.church_id = c.id and p.user_id is not null),
        'unconfirmed', (select count(*) from people p where p.church_id = c.id and p.confirmed_at is null and p.joined_via = 'search'),
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

-- ---------------------------------------------------------------- 0007_roles_journey
-- Round 2, part 2: assistants, approvals, journey confirmations.
-- Safe to run more than once.

-- Assistants act inside their department with the abilities their head chose.
-- groups.extra->'assistants' = [{ "personId": "...", "title": "...", "perms": ["rollcall", ...] }]
create or replace function assistant_has(c uuid, perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from groups g, jsonb_array_elements(coalesce(g.extra->'assistants', '[]'::jsonb)) a
    where g.church_id = c and (a->>'personId')::uuid = my_person(c)
      and exists (select 1 from jsonb_array_elements_text(a->'perms') p where
        (p = 'people.edit' and perm in ('people.view', 'people.edit', 'people.contacts')) or
        (p = 'people.manage' and perm in ('people.view', 'groups.manage')) or
        (p = 'rollcall' and perm in ('people.view', 'attendance.record')) or
        (p = 'message' and perm = 'messages.bulk') or
        (p = 'followup.assign' and perm in ('followup.assign', 'followup.log', 'people.contacts')))
  )
$$;

create or replace function has_perm(c uuid, perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from role_assignments ra join roles r on r.id = ra.role_id
    where ra.church_id = c and ra.person_id = my_person(c)
      and (perm = any (r.permissions) or r.key = 'lead')
      and (ra.pending is null or ra.pending->>'action' = 'remove')
      and (ra.until is null or ra.until > now())
  ) or assistant_has(c, perm)
$$;

-- Role changes: admins propose, pastors approve. Someone may withdraw a request they made.
create or replace function role_change_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if is_pastor(old.church_id) then return old; end if;
    if old.pending->>'action' = 'give' and (old.pending->>'byId')::uuid = my_person(old.church_id) then return old; end if;
    raise exception 'A pastor needs to approve removing a role';
  end if;
  if is_pastor(new.church_id) then return new; end if;
  -- A brand-new church: the founder's first role goes in as it is
  if tg_op = 'INSERT' and not exists (select 1 from role_assignments where church_id = new.church_id) then return new; end if;
  -- Joining a church gives you the Member role for your own record; nothing to approve
  if tg_op = 'INSERT' and new.person_id = my_person(new.church_id)
     and exists (select 1 from roles r where r.id = new.role_id and r.key = 'member') then return new; end if;
  if tg_op = 'INSERT' then
    new.pending := jsonb_build_object('byId', my_person(new.church_id), 'at', now(), 'action', 'give');
    return new;
  end if;
  -- An update by a non-pastor may only ask for a removal
  if new.role_id is distinct from old.role_id or new.scope_type is distinct from old.scope_type or new.scope_group_ids is distinct from old.scope_group_ids or new.scope_ref is distinct from old.scope_ref
     or new.until is distinct from old.until
     or (old.pending is not null and new.pending is distinct from old.pending)
     or (new.pending is not null and new.pending->>'action' <> 'remove') then
    raise exception 'Only a pastor can approve a role change';
  end if;
  return new;
end $$;
drop trigger if exists role_change_guard on role_assignments;
create trigger role_change_guard before insert or update or delete on role_assignments for each row execute function role_change_guard();

-- Churches created while an earlier version of this check was in place: the founder's own role is active.
update role_assignments ra set pending = null
where ra.pending is not null and ra.pending->>'action' = 'give' and (ra.pending->>'byId')::uuid = ra.person_id
  and exists (select 1 from roles r where r.id = ra.role_id and r.key in ('lead', 'member'))
  and (exists (select 1 from roles r where r.id = ra.role_id and r.key = 'member') or not exists (select 1 from role_assignments x join roles r on r.id = x.role_id where x.church_id = ra.church_id and r.key in ('lead', 'pastor') and x.pending is null));

-- Only the lead pastor hands out sensitive abilities.
create or replace function role_perm_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  sensitive text[] := array['care.view', 'finance.count', 'finance.approve', 'finance.transfers', 'finance.view', 'roles.manage', 'billing.manage'];
  before_s text[]; after_s text[];
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  -- A brand-new church setting up its roles (no one holds a role yet)
  if tg_op <> 'DELETE' and not exists (select 1 from role_assignments where church_id = new.church_id) then return new; end if;
  if tg_op = 'DELETE' then
    if old.is_default then raise exception 'Built-in roles can be renamed but not deleted'; end if;
    return old;
  end if;
  select coalesce(array_agg(x order by x), '{}') into after_s from unnest(new.permissions) x where x = any (sensitive);
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(x order by x), '{}') into before_s from unnest(old.permissions) x where x = any (sensitive);
    if new.key is distinct from old.key or new.is_default is distinct from old.is_default then raise exception 'That can''t be changed'; end if;
  else
    before_s := '{}';
  end if;
  if after_s is distinct from before_s and not exists (
    select 1 from role_assignments ra join roles r on r.id = ra.role_id
    where ra.church_id = new.church_id and ra.person_id = my_person(new.church_id) and r.key = 'lead') then
    raise exception 'Only the lead pastor can change that';
  end if;
  return new;
end $$;
drop trigger if exists role_perm_guard on roles;
create trigger role_perm_guard before insert or update or delete on roles for each row execute function role_perm_guard();

-- People can't mark themselves confirmed for a stage, or change their probation or availability for follow-up
create or replace function people_self_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or has_perm(new.church_id, 'people.edit') then return new; end if;
  if new.stage is distinct from old.stage or new.confirmed_at is distinct from old.confirmed_at
     or new.is_leader is distinct from old.is_leader or new.tracked is distinct from old.tracked
     or new.joined_via is distinct from old.joined_via or new.branch_id is distinct from old.branch_id
     or new.inactive is distinct from old.inactive or new.user_id is distinct from old.user_id
     or (new.extra->'probation') is distinct from (old.extra->'probation')
     or (new.extra->'awaitingStage') is distinct from (old.extra->'awaitingStage')
     or (new.extra->'possibleMatchId') is distinct from (old.extra->'possibleMatchId') then
    raise exception 'Only church staff can change that';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------- 0008_prayer_and_downloads
-- Prayer requests and the download log. Safe to run more than once.

create table if not exists prayer_requests (
  id text not null,
  church_id uuid not null references churches on delete cascade,
  data jsonb not null,
  person_id uuid,
  updated_at timestamptz not null default now(),
  primary key (church_id, id)
);
alter table prayer_requests enable row level security;

create table if not exists download_log (
  id text not null,
  church_id uuid not null references churches on delete cascade,
  data jsonb not null,
  by_id uuid,
  updated_at timestamptz not null default now(),
  primary key (church_id, id)
);
alter table download_log enable row level security;

-- Who reads prayer requests: the pastors, Membership Ministry leaders, and anyone the lead pastor added
create or replace function sees_prayers(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_pastor(c)
    or exists (select 1 from groups g join group_members m on m.group_id = g.id
               where g.church_id = c and 'membership' = any (g.tags) and m.person_id = my_person(c) and m.is_leader)
    or exists (select 1 from churches ch where ch.id = c and ch.profile->'prayerViewers' ? my_person(c)::text)
$$;

drop policy if exists "read prayers" on prayer_requests;
create policy "read prayers" on prayer_requests for select using (person_id = my_person(church_id) or sees_prayers(church_id));
drop policy if exists "ask for prayer" on prayer_requests;
create policy "ask for prayer" on prayer_requests for insert with check (person_id = my_person(church_id));
drop policy if exists "update prayers" on prayer_requests;
create policy "update prayers" on prayer_requests for update using (person_id = my_person(church_id) or sees_prayers(church_id));
drop policy if exists "remove prayers" on prayer_requests;
create policy "remove prayers" on prayer_requests for delete using (person_id = my_person(church_id) or is_pastor(church_id));

-- Downloads: anyone in the church can record their own; pastors and the activity-log holders read them
drop policy if exists "log downloads" on download_log;
create policy "log downloads" on download_log for insert with check (by_id = my_person(church_id));
drop policy if exists "read downloads" on download_log;
create policy "read downloads" on download_log for select using (by_id = my_person(church_id) or is_pastor(church_id) or has_perm(church_id, 'activity.view'));

-- ---------------------------------------------------------------- 0009_events_v2
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

-- ---------------------------------------------------------------- 0010_email
-- Email: what the scheduled emails say, who gets them, and a log of every email.
-- Sending stays OFF until EMAIL_SENDING=on is set in Vercel. Safe to run more than once.

create table if not exists email_log (
  id bigserial primary key,
  church_id uuid references churches on delete cascade,
  kind text not null,                -- daily, monday, monthly, event_reminder, test
  to_email text not null,
  subject text not null,
  status text not null,              -- sent, skipped (sending off), failed, capped
  detail text,
  at timestamptz not null default now()
);
create index if not exists email_log_day on email_log (at);
alter table email_log enable row level security;
drop policy if exists "pastors read email log" on email_log;
create policy "pastors read email log" on email_log for select using (church_id is not null and is_pastor(church_id));

-- The numbers an email needs, worked out in the database. Never includes care notes, welfare details or prayer requests.
create or replace function email_summary(c uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  last_sun date; prev_sun date; month_start date := date_trunc('month', (now() at time zone 'Africa/Lagos'))::date;
  res jsonb;
begin
  select max(date) into last_sun from meetings where church_id = c and kind = 'sunday' and date <= (now() at time zone 'Africa/Lagos')::date;
  select max(date) into prev_sun from meetings where church_id = c and kind = 'sunday' and date < last_sun;
  with sun as (select id from meetings where church_id = c and kind = 'sunday' and date = last_sun),
       prev as (select id from meetings where church_id = c and kind = 'sunday' and date = prev_sun),
       hc as (select coalesce(sum((data->>'men')::int + (data->>'women')::int + (data->>'children')::int), 0) n from headcounts where church_id = c and meeting_id in (select id from sun)),
       hp as (select coalesce(sum((data->>'men')::int + (data->>'women')::int + (data->>'children')::int), 0) n from headcounts where church_id = c and meeting_id in (select id from prev)),
       came as (select distinct person_id from attendance_records where church_id = c and meeting_id in (select id from sun)),
       away as (select person_id from absences where church_id = c and last_sun between (data->>'from')::date and (data->>'to')::date),
       missed as (select p.* from people p where p.church_id = c and p.tracked and not p.is_child and p.inactive is null
                   and p.first_visit < last_sun and p.id not in (select person_id from came) and p.id not in (select person_id from away))
  select jsonb_build_object(
    'church', (select jsonb_build_object('name', name, 'slug', slug, 'color', coalesce(profile->>'color', brand_color), 'logo', profile->>'logo') from churches where id = c),
    'lastSunday', last_sun,
    'attendance', (select n from hc), 'attendancePrev', (select n from hp),
    'goal', (select attendance_goal from churches where id = c),
    'missed', jsonb_build_object(
      'leaders', (select count(*) from missed where is_leader or stage = 'leader'),
      'workers', (select count(*) from missed where not is_leader and stage = 'worker'),
      'members', (select count(*) from missed where not is_leader and stage not in ('worker', 'leader'))),
    'quiet', (select count(*) from people where church_id = c and tracked and not is_child and inactive is null and missed_in_a_row >= 3),
    'firstTimersWeek', (select count(*) from followup_cases where church_id = c and created_at > now() - interval '7 days'),
    'firstTimersMonth', (select count(*) from followup_cases where church_id = c and created_at >= month_start),
    'notReached', (select count(*) from followup_cases where church_id = c and stage = 'new'),
    'unassigned', (select count(*) from followup_cases where church_id = c and stage = 'new' and assignee_id is null),
    'joinersWaiting', (select count(*) from people where church_id = c and joined_via = 'search' and confirmed_at is null and inactive is null),
    'roleApprovals', (select count(*) from role_assignments where church_id = c and pending is not null),
    'welfareOpen', (select count(*) from welfare_requests where church_id = c and stage not in ('closed', 'declined', 'given')),
    'prayersWeek', (select count(*) from prayer_requests where church_id = c and (data->>'at')::timestamptz > now() - interval '7 days'),
    'birthdays', coalesce((select jsonb_agg(first_name || ' ' || last_name) from people where church_id = c and birthday is not null and inactive is null
                   and ((extract(doy from make_date(extract(year from now())::int, extract(month from birthday)::int, least(extract(day from birthday)::int, 28))) - extract(doy from now()) + 366)::int % 366) < 7), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('title', e.data->>'title', 'start', e.data->>'start', 'slug', e.slug,
                   'registered', (select count(*) from registrations r where r.church_id = c and r.event_id = e.id and r.data->>'status' = 'confirmed')) order by e.data->>'start')
                   from events e where e.church_id = c and e.status = 'published' and (e.data->>'start')::timestamptz between now() and now() + interval '45 days'), '[]'::jsonb),
    'classesFinishedMonth', (select count(*) from enrolments where church_id = c and data->>'status' = 'completed' and (data->>'completedAt')::date >= month_start),
    'people', (select count(*) from people where church_id = c and not is_child and inactive is null),
    'serving', (select count(*) from people where church_id = c and inactive is null and stage in ('worker', 'leader'))
  ) into res;
  return res;
end $$;
revoke all on function email_summary(uuid) from public, anon, authenticated;

-- Who gets which email: [{ email, firstName, kinds: [...] }]. People can switch emails off in their own settings (prefs.noEmails).
create or replace function email_recipients(c uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  with mine as (
    select p.id, p.email, p.first_name, array_agg(r.key) keys, bool_or(coalesce((p.prefs->>'noNudgeEmail')::boolean, false)) no_daily, bool_or(coalesce((p.prefs->>'noReportEmails')::boolean, false)) no_reports, bool_or('followup.assign' = any (r.permissions) or 'people.edit' = any (r.permissions)) staff
    from people p join role_assignments ra on ra.person_id = p.id and ra.church_id = c and ra.pending is null and (ra.until is null or ra.until > now())
    join roles r on r.id = ra.role_id
    where p.church_id = c and p.email ~ '^\S+@\S+\.\S+$' and p.inactive is null and not coalesce((p.prefs->>'noEmails')::boolean, false)
    group by p.id, p.email, p.first_name)
  select coalesce(jsonb_agg(jsonb_build_object('email', email, 'firstName', first_name, 'personId', id,
           'kinds', to_jsonb(array_remove(array[
              case when 'lead' = any (keys) and not no_reports then 'monday' end,
              case when keys && array['lead', 'admin'] and not no_reports then 'monthly' end,
              case when (keys && array['lead', 'pastor', 'admin'] or staff) and not no_daily then 'daily' end], null)))), '[]'::jsonb)
  from mine
$$;
revoke all on function email_recipients(uuid) from public, anon, authenticated;

-- Event reminders: confirmed registrations with an email, for events that remind by email.
create or replace function email_event_reminders(c uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('event', e.data, 'to', r.data->>'email', 'name', r.data->>'name', 'ticket', r.data->>'ticket')), '[]'::jsonb)
  from events e join registrations r on r.church_id = e.church_id and r.event_id = e.id
  where e.church_id = c and e.status = 'published' and coalesce((e.data->'reminders'->>'email')::boolean, false)
    and r.data->>'status' = 'confirmed' and coalesce(r.data->>'email', '') ~ '^\S+@\S+\.\S+$'
    and exists (select 1 from jsonb_array_elements_text(coalesce(e.data->'reminders'->'daysBefore', '[1]'::jsonb)) d
                where ((e.data->>'start')::timestamptz at time zone 'Africa/Lagos')::date - (now() at time zone 'Africa/Lagos')::date = d::int)
$$;
revoke all on function email_event_reminders(uuid) from public, anon, authenticated;
