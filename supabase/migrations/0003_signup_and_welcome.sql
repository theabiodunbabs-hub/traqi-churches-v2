-- Traqi for Churches: sign-up, account linking and the public welcome form.
-- These run with the database owner's rights, so each one checks its own rules.

-- 1. A signed-in user creates a church and becomes its lead pastor ----------------
create or replace function create_church(
  p_name text, p_slug text, p_country text, p_currency text, p_time_zone text,
  p_template text, p_goal int,
  p_first text, p_last text, p_gender text, p_phone text, p_email text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  c uuid;
  me uuid;
  lead_role uuid;
  v_slug text := lower(regexp_replace(coalesce(p_slug, p_name), '[^a-zA-Z0-9]+', '-', 'g'));
  g_training uuid; g_media uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if length(trim(p_name)) < 3 then raise exception 'Church name is too short'; end if;
  v_slug := trim(both '-' from left(v_slug, 34));
  if length(v_slug) < 2 then v_slug := 'church'; end if;
  if exists (select 1 from churches ch where ch.slug = v_slug) then
    v_slug := v_slug || '-' || substr(md5(random()::text), 1, 4);
  end if;

  insert into churches (name, slug, country, currency, time_zone, template, attendance_goal)
  values (trim(p_name), v_slug, p_country, p_currency, p_time_zone, coalesce(p_template, 'pentecostal'), p_goal)
  returning id into c;

  insert into people (church_id, first_name, last_name, gender, phone, email, stage, user_id, tracked, first_visit, consent_at, consent_via)
  values (c, trim(p_first), trim(p_last), p_gender, trim(p_phone), nullif(trim(p_email), ''), 'leader', auth.uid(), true, current_date, now(), 'staff')
  returning id into me;

  -- Default roles (same as the app's DEFAULT_ROLES)
  insert into roles (church_id, key, name, description, level, is_default, permissions) values
    (c, 'lead', 'Lead pastor', 'Sees everything, assigns oversight, approves corrections', 1, true,
      '{people.view,people.edit,people.contacts,care.view,followup.assign,followup.log,groups.manage,attendance.record,checkin.code,finance.approve,finance.transfers,finance.view,classes.manage,events.manage,messages.bulk,roles.manage,sheets.connect,activity.view,billing.manage}'),
    (c, 'pastor', 'Pastorate', 'Resident and associate pastors; oversee their assigned areas', 2, true,
      '{people.view,people.edit,people.contacts,care.view,followup.assign,followup.log,groups.manage,attendance.record,classes.manage,events.manage,messages.bulk}'),
    (c, 'admin', 'Admin', 'Setup, records, events, communication and classes', 3, true,
      '{people.view,people.edit,people.contacts,followup.assign,followup.log,groups.manage,attendance.record,checkin.code,classes.manage,events.manage,messages.bulk,roles.manage,sheets.connect,activity.view,billing.manage}'),
    (c, 'dept', 'Department leader', 'Leads a department or unit and its people', 4, true,
      '{people.view,people.edit,people.contacts,groups.manage,attendance.record,messages.bulk}'),
    (c, 'followup', 'Follow-up lead', 'Receives and assigns first-timers', 4, true, '{followup.assign,followup.log,people.contacts}'),
    (c, 'care', 'Care leader', 'Leaders who read care notes', 4, true, '{care.view}'),
    (c, 'usher', 'Head usher', 'Submits service cash counts; can delegate', 4, true, '{finance.count,attendance.record}'),
    (c, 'media', 'Media head', 'Sets the check-in code for each service', 4, true, '{checkin.code}'),
    (c, 'worker', 'Worker', 'Serves in a department; handles tasks assigned to them', 5, true, '{followup.log}'),
    (c, 'member', 'Member', 'Their own profile, household, classes and events', 6, true, '{}');

  select id into lead_role from roles where church_id = c and key = 'lead';
  insert into role_assignments (church_id, person_id, role_id, scope_type) values (c, me, lead_role, 'church');

  -- Recommended departments
  if coalesce(p_template, 'pentecostal') = 'pentecostal' then
    insert into groups (church_id, name, kind, purpose, tags) values (c, 'Faculty of Training', 'department', 'Foundation school, discipleship and every training course', '{training}') returning id into g_training;
    insert into groups (church_id, name, kind, purpose, tags, supervisor_id) values (c, 'Children', 'department', 'Children''s church', '{children}', g_training);
    insert into groups (church_id, name, kind, purpose, tags) values
      (c, 'Mission and Outreach / Follow-up', 'department', 'Outreach and first-timer follow-up', '{followup}'),
      (c, 'Membership Ministry', 'department', 'Settles new members and links them to the right department', '{membership,followup}');
    insert into groups (church_id, name, kind, purpose, tags) values (c, 'Media', 'department', 'Everything media in the church', '{media}') returning id into g_media;
    insert into groups (church_id, name, kind, purpose, parent_id) values
      (c, 'Camera', 'unit', 'Videography and photography', g_media),
      (c, 'Projection', 'unit', 'Screens and slides during service', g_media),
      (c, 'Light', 'unit', 'Stage and auditorium lighting', g_media),
      (c, 'Online church and live streaming', 'unit', 'The online church and every live stream', g_media),
      (c, 'Content and social media', 'unit', 'Content, design and social media pages', g_media);
    insert into groups (church_id, name, kind, purpose, tags) values
      (c, 'Choir', 'department', 'Worship and music', '{}'),
      (c, 'Technical', 'department', 'Sound', '{}'),
      (c, 'Welfare', 'department', 'The welfare arm of the church', '{welfare}'),
      (c, 'Ushering', 'department', 'Ushers, headcounts and offering counts', '{ushering}'),
      (c, 'Protocol', 'department', 'Protocol duties', '{}'),
      (c, 'Setup and Facility Management', 'department', 'Setting up and caring for the venue', '{}');
  end if;

  insert into activity_log (church_id, actor_id, action) values (c, me, 'created ' || trim(p_name) || ' on Traqi');
  return c;
end $$;

-- 2. Link a signed-in account (email/password or Google) to the person the church already has ---
create or replace function claim_person() returns int
language plpgsql security definer set search_path = public as $$
declare
  em text;
  n int;
begin
  if auth.uid() is null then return 0; end if;
  select lower(email) into em from auth.users where id = auth.uid();
  if em is null then return 0; end if;
  update people set user_id = auth.uid()
   where user_id is null and lower(email) = em
     and not exists (select 1 from people p2 where p2.church_id = people.church_id and p2.user_id = auth.uid());
  get diagnostics n = row_count;
  return n;
end $$;

-- 3. The public welcome form: anyone can add themselves as a first-timer -----------
create or replace function welcome_first_timer(
  p_slug text, p_first text, p_last text, p_gender text, p_phone text, p_location text, p_heard text, p_consent boolean
) returns text
language plpgsql security definer set search_path = public as $$
declare
  c uuid;
  pid uuid;
  who uuid;
  key text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
begin
  if not coalesce(p_consent, false) then raise exception 'Consent is required'; end if;
  if length(key) < 10 then raise exception 'Enter a valid phone number'; end if;
  if length(trim(coalesce(p_first, ''))) = 0 or length(trim(coalesce(p_last, ''))) = 0 then raise exception 'Enter your name'; end if;
  if p_gender not in ('M', 'F') then raise exception 'Choose male or female'; end if;

  select id into c from churches where slug = p_slug;
  if c is null then raise exception 'Church not found'; end if;

  if exists (select 1 from people where church_id = c and right(regexp_replace(phone, '\D', '', 'g'), 10) = key) then
    return 'back';
  end if;

  insert into people (church_id, first_name, last_name, gender, phone, whatsapp, location, heard_from, stage, tracked, first_visit, last_seen, consent_at, consent_via)
  values (c, trim(p_first), trim(p_last), p_gender, trim(p_phone), trim(p_phone), nullif(trim(p_location), ''), nullif(p_heard, ''), 'first_timer', true, current_date, current_date, now(), 'welcome-form')
  returning id into pid;

  -- Lightest open load on the follow-up team, neighbours first
  select gm.person_id into who
    from group_members gm
    join groups g on g.id = gm.group_id and 'followup' = any (g.tags)
    left join people tp on tp.id = gm.person_id
   where gm.church_id = c
   group by gm.person_id, tp.location
   order by (tp.location is not null and lower(tp.location) = lower(coalesce(p_location, ''))) desc,
            (select count(*) from followup_cases fc where fc.assignee_id = gm.person_id and fc.stage in ('new', 'contacted', 'visited')) asc
   limit 1;

  insert into followup_cases (church_id, person_id, assignee_id) values (c, pid, who);
  insert into activity_log (church_id, actor_id, action, target_table, target_id)
  values (c, pid, 'filled in the welcome form', 'people', pid);
  return 'new';
end $$;

-- 4. Public church name for the welcome page (nothing else is exposed) --------------
create or replace function church_public(p_slug text) returns table (name text, slug text)
language sql stable security definer set search_path = public as $$
  select ch.name, ch.slug from churches ch where ch.slug = p_slug
$$;

grant execute on function create_church(text, text, text, text, text, text, int, text, text, text, text, text) to authenticated;
grant execute on function claim_person() to authenticated;
grant execute on function welcome_first_timer(text, text, text, text, text, text, text, boolean) to anon, authenticated;
grant execute on function church_public(text) to anon, authenticated;
