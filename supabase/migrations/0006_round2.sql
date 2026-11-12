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
