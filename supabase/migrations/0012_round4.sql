-- Round 4: faster sign-in, who does what at services, automatic follow-up, challenges, invitations,
-- fund requests and counselling. Safe to run more than once.

-- ---------- Faster sign-in: link the account and return its churches in one trip ----------
create or replace function start_session() returns table (person_id uuid, church_id uuid)
language plpgsql security definer set search_path = public as $$
declare em text;
begin
  if auth.uid() is null then return; end if;
  select lower(email) into em from auth.users where id = auth.uid();
  if em is not null then
    update people set user_id = auth.uid()
     where user_id is null and lower(email) = em
       and not exists (select 1 from people p2 where p2.church_id = people.church_id and p2.user_id = auth.uid());
  end if;
  return query select p.id, p.church_id from people p where p.user_id = auth.uid();
end $$;
grant execute on function start_session() to authenticated;

-- Loading recent attendance quickly
create index if not exists attendance_records_recent on attendance_records (church_id, updated_at);

-- ---------- Roles: new defaults ----------
alter table roles drop constraint if exists roles_key_check;
alter table roles add constraint roles_key_check
  check (key in ('lead', 'pastor', 'admin', 'dept', 'followup', 'care', 'usher', 'media', 'worker', 'member', 'finance', 'financelead', 'custom'));

-- Headcount: the head usher (and assistants they choose). Check-in: media and follow-up. Admin: roll call of leaders.
create or replace function round4_role_defaults(k text, perms text[]) returns text[]
language sql immutable as $$
  select array(select distinct x from unnest(
    case k
      when 'usher' then array_remove(array_remove(perms, 'attendance.record'), 'checkin.code') || array['headcount.record']
      when 'followup' then perms || array['checkin.code']
      when 'media' then perms || array['checkin.code']
      when 'admin' then array_remove(perms, 'checkin.code') || array['rollcall.leaders']
      else perms end) x)
$$;

update roles set permissions = round4_role_defaults(key, permissions)
 where is_default and key in ('usher', 'followup', 'media', 'admin')
   and not (permissions @> case key when 'usher' then array['headcount.record'] when 'admin' then array['rollcall.leaders'] else array['checkin.code'] end);

-- New churches: tidy the defaults as they're created, and add the finance roles
create or replace function round4_new_roles() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_default then new.permissions := round4_role_defaults(new.key, new.permissions); end if;
  if new.key = 'member' and new.is_default then
    insert into roles (church_id, key, name, description, level, is_default, permissions)
    select new.church_id, v.k, v.n, v.d, v.l, true, v.p::text[] from (values
      ('financelead', 'Finance lead', 'Leads the finance team: enters income, reviews and pays fund requests', 4, '{finance.view,finance.transfers,finance.review,finance.approve}'),
      ('finance', 'Finance team', 'Bursar, treasurer, financial secretary or accountant', 5, '{finance.view,finance.transfers,finance.review}')) v(k, n, d, l, p)
    where not exists (select 1 from roles r where r.church_id = new.church_id and r.key = v.k);
  end if;
  return new;
end $$;
drop trigger if exists round4_new_roles on roles;
create trigger round4_new_roles before insert on roles for each row execute function round4_new_roles();

-- Churches that already exist get the finance roles too
insert into roles (church_id, key, name, description, level, is_default, permissions)
select c.id, 'financelead', 'Finance lead', 'Leads the finance team: enters income, reviews and pays fund requests', 4, true, '{finance.view,finance.transfers,finance.review,finance.approve}'
  from churches c where not exists (select 1 from roles r where r.church_id = c.id and r.key = 'financelead');
insert into roles (church_id, key, name, description, level, is_default, permissions)
select c.id, 'finance', 'Finance team', 'Bursar, treasurer, financial secretary or accountant', 5, true, '{finance.view,finance.transfers,finance.review}'
  from churches c where not exists (select 1 from roles r where r.church_id = c.id and r.key = 'finance');

-- Assistants: the head usher can hand headcount to an assistant; media and follow-up heads can hand over check-in
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
        (p = 'headcount' and perm = 'headcount.record') or
        (p = 'checkin' and perm = 'checkin.code') or
        (p = 'followup.assign' and perm in ('followup.assign', 'followup.log', 'people.contacts')))
  )
$$;

drop policy if exists "record headcounts" on headcounts;
create policy "record headcounts" on headcounts for all
  using (has_perm(church_id, 'headcount.record') or has_perm(church_id, 'attendance.record'))
  with check (has_perm(church_id, 'headcount.record') or has_perm(church_id, 'attendance.record'));

-- Check-in codes live on the service: media and follow-up can set them; the admin takes the leaders' roll call
drop policy if exists "take roll call" on meetings;
create policy "take roll call" on meetings for update using (
  has_perm(church_id, 'groups.manage') or has_perm(church_id, 'roles.manage') or has_perm(church_id, 'checkin.code')
  or has_perm(church_id, 'headcount.record') or has_perm(church_id, 'rollcall.leaders'));

-- ---------- Follow-up: helpers, who sees first-timers, automatic assignment ----------
alter table followup_cases add column if not exists helper_ids uuid[];

-- Leads of departments with these tags, and (with_assistants) their assistants
create or replace function heads_tag(c uuid, tags text[], with_assistants boolean) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members gm join groups g on g.id = gm.group_id
                 where gm.church_id = c and gm.person_id = my_person(c) and gm.is_leader and g.tags && tags)
    or (with_assistants and exists (
      select 1 from groups g, jsonb_array_elements(coalesce(g.extra->'assistants', '[]'::jsonb)) a
      where g.church_id = c and g.tags && tags and (a->>'personId')::uuid = my_person(c)))
$$;

-- The follow-up team: as picked by the follow-up head, otherwise the follow-up department
create or replace function follow_team(c uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  with g as (select * from groups where church_id = c and 'followup' = any (tags) order by created_at limit 1)
  select x::uuid from g, jsonb_array_elements_text(g.extra->'followup'->'team') x where jsonb_typeof(g.extra->'followup'->'team') = 'array'
  union
  select gm.person_id from g join group_members gm on gm.group_id = g.id
   where not exists (select 1 from g where jsonb_typeof(g.extra->'followup'->'team') = 'array' and jsonb_array_length(g.extra->'followup'->'team') > 0)
$$;

-- First-timer details: pastors, follow-up / Membership / outreach leads and assistants, and the follow-up team
create or replace function sees_cases(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_pastor(c) or has_perm(c, 'followup.assign')
      or heads_tag(c, array['followup', 'membership', 'outreach'], true)
      or my_person(c) in (select follow_team(c))
$$;

drop policy if exists "see cases" on followup_cases;
create policy "see cases" on followup_cases for select using (
  sees_cases(church_id) or assignee_id = my_person(church_id) or my_person(church_id) = any (coalesce(helper_ids, '{}')));
drop policy if exists "manage cases" on followup_cases;
create policy "manage cases" on followup_cases for all using (
  has_perm(church_id, 'followup.assign') or heads_tag(church_id, array['followup'], true)
  or assignee_id = my_person(church_id) or my_person(church_id) = any (coalesce(helper_ids, '{}'))
  or (is_pastor(church_id) and created_at < now() - interval '48 hours'));
drop policy if exists "log contacts" on followup_contacts;
create policy "log contacts" on followup_contacts for insert with check (
  by_id = my_person(church_id) and (has_perm(church_id, 'followup.log') or sees_cases(church_id)
    or exists (select 1 from followup_cases f where f.id = case_id and (f.assignee_id = my_person(f.church_id) or my_person(f.church_id) = any (coalesce(f.helper_ids, '{}'))))));

-- Pick the best person on the team: same gender, living nearby, comes often, fewest open cases, not away.
create or replace function best_follower(c uuid, for_person uuid, pool uuid[] default null) returns uuid
language sql stable security definer set search_path = public as $$
  with me as (select gender, lower(coalesce(location, '')) as loc from people where id = for_person),
  team as (select unnest(coalesce(pool, array(select follow_team(c)))) as id),
  scored as (
    select t.id,
      (case when p.gender = me.gender then 4 else 0 end)
      + (case when me.loc <> '' and lower(coalesce(p.location, '')) <> '' and (lower(p.location) like '%' || split_part(me.loc, ',', 1) || '%' or me.loc like '%' || split_part(lower(p.location), ',', 1) || '%') then 1.6 else 0 end)
      + 3 * least(1, (select count(*) from attendance_records a where a.church_id = c and a.person_id = t.id and a.updated_at > now() - interval '90 days')::numeric / 12)
      - 0.8 * (select count(*) from followup_cases f where f.church_id = c and f.assignee_id = t.id and f.stage in ('new', 'contacted', 'visited'))
      - (case when exists (select 1 from absences w where w.church_id = c and w.person_id = t.id
                            and (w.data->>'from') <= current_date::text and (w.data->>'to') >= current_date::text) then 100 else 0 end)
      + random() * 0.01 as score
    from team t join people p on p.id = t.id and p.church_id = c, me
    where t.id <> for_person
  )
  select id from scored order by score desc limit 1
$$;

create or replace function auto_assign_case() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.assignee_id is null then new.assignee_id := best_follower(new.church_id, new.person_id); end if;
  return new;
end $$;
drop trigger if exists auto_assign_case on followup_cases;
create trigger auto_assign_case before insert on followup_cases for each row execute function auto_assign_case();

-- Outreach and challenge contacts: assigned to the follow-up department straight away
create or replace function auto_assign_contact() returns trigger
language plpgsql security definer set search_path = public as $$
declare fu uuid[];
begin
  if new.assignee_id is null then
    select array_agg(gm.person_id) into fu from group_members gm join groups g on g.id = gm.group_id
     where g.church_id = new.church_id and 'followup' = any (g.tags);
    select best_follower(new.church_id, new.by_id, coalesce(fu, array(select follow_team(new.church_id)))) into new.assignee_id;
    if new.assignee_id is not null then new.data := jsonb_set(new.data, '{assigneeId}', to_jsonb(new.assignee_id::text)); end if;
  end if;
  return new;
end $$;
drop trigger if exists auto_assign_contact on outreach_contacts;
create trigger auto_assign_contact before insert on outreach_contacts for each row execute function auto_assign_contact();

-- ---------- Soul-winning challenges ----------
create table if not exists challenges (
  id text not null,
  church_id uuid not null references churches on delete cascade,
  data jsonb not null,
  by_id uuid,
  participant_ids uuid[],
  updated_at timestamptz not null default now(),
  primary key (church_id, id)
);
alter table challenges enable row level security;
create or replace function challenge_staff(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_pastor(c) or has_perm(c, 'roles.manage') or outreach_staff(c) or heads_tag(c, array['outreach', 'evangelism'], true)
$$;
drop policy if exists "read challenges" on challenges;
create policy "read challenges" on challenges for select using (is_church_member(church_id));
drop policy if exists "run challenges" on challenges;
create policy "run challenges" on challenges for all using (challenge_staff(church_id)) with check (challenge_staff(church_id));
-- Joining by link: a member may add only themselves
create or replace function join_challenge(c uuid, ch text) returns void
language sql security definer set search_path = public as $$
  update challenges set participant_ids = array(select distinct unnest(coalesce(participant_ids, '{}') || my_person(c))),
         data = jsonb_set(data, '{participantIds}', to_jsonb(array(select distinct unnest(coalesce(participant_ids, '{}') || my_person(c))::text))),
         updated_at = now()
   where church_id = c and id = ch and is_church_member(c)
$$;
grant execute on function join_challenge(uuid, text) to authenticated;

-- ---------- Invite the church ----------
create table if not exists church_invites (
  id text not null,
  church_id uuid not null references churches on delete cascade,
  data jsonb not null,
  by_id uuid,
  audience text,
  updated_at timestamptz not null default now(),
  primary key (church_id, id)
);
alter table church_invites enable row level security;
drop policy if exists "send invites" on church_invites;
create policy "send invites" on church_invites for insert with check (is_church_member(church_id) and by_id = my_person(church_id));
drop policy if exists "read invites" on church_invites;
create policy "read invites" on church_invites for select using (by_id = my_person(church_id) or is_pastor(church_id) or has_perm(church_id, 'roles.manage'));
drop policy if exists "handle invites" on church_invites;
create policy "handle invites" on church_invites for update using (is_pastor(church_id) or has_perm(church_id, 'roles.manage'));

-- ---------- Fund requests and spending reports ----------
create table if not exists fund_requests (
  id text not null,
  church_id uuid not null references churches on delete cascade,
  data jsonb not null,
  by_id uuid,
  group_id uuid,
  stage text,
  updated_at timestamptz not null default now(),
  primary key (church_id, id)
);
alter table fund_requests enable row level security;
create or replace function finance_staff(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_pastor(c) or has_perm(c, 'finance.review') or has_perm(c, 'roles.manage')
$$;
drop policy if exists "ask for funds" on fund_requests;
create policy "ask for funds" on fund_requests for insert with check (is_church_member(church_id) and (by_id = my_person(church_id) or finance_staff(church_id)
  or exists (select 1 from events e where e.church_id = fund_requests.church_id and e.id = fund_requests.data->>'eventId'
             and my_person(e.church_id)::text in (e.data->'committee'->>'headId', e.data->'committee'->>'assistantId'))));
drop policy if exists "read funds" on fund_requests;
create policy "read funds" on fund_requests for select using (
  by_id = my_person(church_id) or finance_staff(church_id)
  or (group_id is not null and exists (select 1 from group_members gm where gm.group_id = fund_requests.group_id and gm.person_id = my_person(fund_requests.church_id) and gm.is_leader))
  or exists (select 1 from events e where e.church_id = fund_requests.church_id and e.id = fund_requests.data->>'eventId'
             and my_person(e.church_id)::text in (e.data->'committee'->>'headId', e.data->'committee'->>'assistantId')));
drop policy if exists "move funds" on fund_requests;
create policy "move funds" on fund_requests for update using (
  by_id = my_person(church_id) or finance_staff(church_id)
  or exists (select 1 from events e where e.church_id = fund_requests.church_id and e.id = fund_requests.data->>'eventId'
             and my_person(e.church_id)::text in (e.data->'committee'->>'headId', e.data->'committee'->>'assistantId')));

-- ---------- Counselling ----------
-- The pastor's chosen helpers see requests and his schedule so they can book, forward or refer.
-- What the person wrote is readable only by them, the handler and the pastor (helpers: only while it's new).
create table if not exists counsel_requests (
  id text not null,
  church_id uuid not null references churches on delete cascade,
  data jsonb not null,
  person_id uuid,
  handler_id uuid,
  status text,
  updated_at timestamptz not null default now(),
  primary key (church_id, id)
);
alter table counsel_requests enable row level security;
create or replace function counsel_helper(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from churches ch, jsonb_array_elements(coalesce(ch.profile->'counselling'->'delegates', '[]'::jsonb)) d
                 where ch.id = c and (d->>'personId')::uuid = my_person(c) and d->'perms' ? 'manage')
$$;
create or replace function counsel_pastor(c uuid, branch text) returns boolean
language sql stable security definer set search_path = public as $$
  select case when branch is null then is_lead(c)
    else exists (select 1 from role_assignments ra join roles r on r.id = ra.role_id
                 where ra.church_id = c and ra.person_id = my_person(c) and r.key = 'pastor' and ra.scope_type = 'branch' and ra.scope_ref = branch)
         or (is_lead(c) and not exists (select 1 from role_assignments ra join roles r on r.id = ra.role_id
                 where ra.church_id = c and r.key = 'pastor' and ra.scope_type = 'branch' and ra.scope_ref = branch)) end
$$;
-- What the person shares, kept apart: helpers see the request and the schedule, but read it only while it's new.
create table if not exists counsel_private (
  id text not null,
  church_id uuid not null references churches on delete cascade,
  request_id text not null,
  body text not null,
  primary key (church_id, id)
);
alter table counsel_private enable row level security;
drop policy if exists "share privately" on counsel_private;
create policy "share privately" on counsel_private for insert with check (exists (
  select 1 from counsel_requests r where r.church_id = counsel_private.church_id and r.id = counsel_private.request_id and r.person_id = my_person(r.church_id)));
drop policy if exists "read privately" on counsel_private;
create policy "read privately" on counsel_private for select using (exists (
  select 1 from counsel_requests r where r.church_id = counsel_private.church_id and r.id = counsel_private.request_id
    and (r.person_id = my_person(r.church_id) or r.handler_id = my_person(r.church_id) or counsel_pastor(r.church_id, r.data->>'branchId')
         or (r.status = 'new' and r.data->>'branchId' is null and counsel_helper(r.church_id)))));

drop policy if exists "ask for counselling" on counsel_requests;
create policy "ask for counselling" on counsel_requests for insert with check (is_church_member(church_id) and person_id = my_person(church_id));
drop policy if exists "read counselling" on counsel_requests;
create policy "read counselling" on counsel_requests for select using (
  person_id = my_person(church_id) or handler_id = my_person(church_id) or counsel_pastor(church_id, data->>'branchId')
  or (data->>'branchId' is null and counsel_helper(church_id)));
drop policy if exists "handle counselling" on counsel_requests;
create policy "handle counselling" on counsel_requests for update using (
  person_id = my_person(church_id) or handler_id = my_person(church_id) or counsel_pastor(church_id, data->>'branchId')
  or (data->>'branchId' is null and counsel_helper(church_id)));
