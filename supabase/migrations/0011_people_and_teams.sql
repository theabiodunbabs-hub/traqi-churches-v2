-- Round 3: people and teams.
-- Join requests go to each department's head; roll call by heads and the admin; outreach contacts; new-role notices.
-- Safe to run more than once.

-- ---------- New roles: when a role took effect, so the person sees "You have a new role" ----------
alter table role_assignments add column if not exists given_at timestamptz;

-- ---------- Requests to join a department: the head decides ----------
alter table placements add column if not exists reply text;

-- The head of the department (or of the department a unit belongs to) decides.
-- Pastors also see and decide, for when a request has waited or a department has no head.
create or replace function decides_placement(c uuid, g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_pastor(c)
    or exists (select 1 from group_members gm where gm.church_id = c and gm.person_id = my_person(c) and gm.is_leader and gm.group_id = g)
    or exists (select 1 from groups u join group_members gm on gm.group_id = u.parent_id
               where u.id = g and gm.church_id = c and gm.person_id = my_person(c) and gm.is_leader)
$$;

drop policy if exists "see own or handle" on placements;
create policy "see own or handle" on placements for select
  using (person_id = my_person(church_id) or handles_placement(church_id) or decides_placement(church_id, group_id));
drop policy if exists "decide placements" on placements;
create policy "decide placements" on placements for update
  using (handles_placement(church_id) or decides_placement(church_id, group_id));

-- ---------- Roll call ----------
-- Heads save roll call on the service itself, and add or take back "came by roll call" attendance.
drop policy if exists "take roll call" on meetings;
create policy "take roll call" on meetings for update using (has_perm(church_id, 'groups.manage') or has_perm(church_id, 'roles.manage'));

drop policy if exists "check in" on attendance_records;
create policy "check in" on attendance_records for insert with check (
  person_id = my_person(church_id) or has_perm(church_id, 'attendance.record') or has_perm(church_id, 'classes.manage')
  or has_perm(church_id, 'events.manage') or has_perm(church_id, 'groups.manage') or has_perm(church_id, 'roles.manage'));
drop policy if exists "correct attendance" on attendance_records;
create policy "correct attendance" on attendance_records for update using (
  has_perm(church_id, 'attendance.record') or has_perm(church_id, 'classes.manage') or has_perm(church_id, 'groups.manage') or has_perm(church_id, 'roles.manage'));
drop policy if exists "undo roll call" on attendance_records;
create policy "undo roll call" on attendance_records for delete using (
  data->>'method' = 'rollcall' and (has_perm(church_id, 'attendance.record') or has_perm(church_id, 'groups.manage') or has_perm(church_id, 'roles.manage')));

-- ---------- Outreach ----------
create table if not exists outreaches (
  id text not null,
  church_id uuid not null references churches on delete cascade,
  data jsonb not null,
  by_id uuid,
  updated_at timestamptz not null default now(),
  primary key (church_id, id)
);
alter table outreaches enable row level security;

create table if not exists outreach_contacts (
  id text not null,
  church_id uuid not null references churches on delete cascade,
  data jsonb not null,
  by_id uuid,
  assignee_id uuid,
  phone text,
  updated_at timestamptz not null default now(),
  primary key (church_id, id)
);
alter table outreach_contacts enable row level security;
create index if not exists outreach_contacts_phone on outreach_contacts (church_id, phone);

-- Follow-up and outreach staff: follow-up roles, pastors, and heads of the follow-up or outreach departments
create or replace function outreach_staff(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_pastor(c) or has_perm(c, 'followup.assign')
    or exists (select 1 from group_members gm join groups g on g.id = gm.group_id
               where gm.church_id = c and gm.person_id = my_person(c) and gm.is_leader
                 and ('followup' = any (g.tags) or 'outreach' = any (g.tags)))
$$;

drop policy if exists "read outreaches" on outreaches;
create policy "read outreaches" on outreaches for select using (is_church_member(church_id));
drop policy if exists "plan outreaches" on outreaches;
create policy "plan outreaches" on outreaches for all using (outreach_staff(church_id)) with check (outreach_staff(church_id));

-- Anyone in the church adds people they met; staff and the person following up see them
drop policy if exists "add contacts" on outreach_contacts;
create policy "add contacts" on outreach_contacts for insert with check (is_church_member(church_id) and by_id = my_person(church_id));
drop policy if exists "read contacts" on outreach_contacts;
create policy "read contacts" on outreach_contacts for select using (
  by_id = my_person(church_id) or assignee_id = my_person(church_id) or outreach_staff(church_id) or has_perm(church_id, 'followup.log'));
drop policy if exists "work contacts" on outreach_contacts;
create policy "work contacts" on outreach_contacts for update using (
  by_id = my_person(church_id) or assignee_id = my_person(church_id) or outreach_staff(church_id));
