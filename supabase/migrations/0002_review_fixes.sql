-- Traqi for Churches: additions from the design review
-- Run after 0001_foundations.sql

-- Church settings
alter table churches add column if not exists attendance_goal int;
alter table churches add column if not exists template text not null default 'pentecostal' check (template in ('pentecostal', 'blank'));

-- People: whose attendance we actually record, how they heard, and their consent
alter table people add column if not exists tracked boolean not null default false;
alter table people add column if not exists heard_from text;
alter table people add column if not exists consent_at timestamptz;
alter table people add column if not exists consent_via text check (consent_via in ('welcome-form', 'update-link', 'staff', 'import'));
alter table people add column if not exists missed_in_a_row int not null default 0;

-- Roles carry a type, so rules don't depend on one church's names
alter table roles alter column key set default 'custom';
alter table roles add constraint roles_key_check
  check (key in ('lead', 'pastor', 'admin', 'dept', 'followup', 'care', 'usher', 'media', 'worker', 'member', 'custom'));

-- Follow-up contacts record whether the person was actually reached
alter table followup_contacts add column if not exists reached boolean;

-- Members asking to join a department, handled by Membership Ministry
create table if not exists placements (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references churches on delete cascade,
  person_id uuid not null references people on delete cascade,
  group_id uuid not null references groups on delete cascade,
  note text,
  status text not null default 'open' check (status in ('open', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  decided_by uuid references people,
  decided_at timestamptz
);
alter table placements enable row level security;

-- Membership Ministry leaders and pastors handle placements
create or replace function handles_placement(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from role_assignments ra join roles r on r.id = ra.role_id
    where ra.church_id = c and ra.person_id = my_person(c) and r.key in ('lead', 'pastor')
  ) or exists (
    select 1 from group_members gm join groups g on g.id = gm.group_id
    where gm.church_id = c and gm.person_id = my_person(c) and gm.is_leader and 'membership' = any (g.tags)
  )
$$;

create policy "ask to join" on placements for insert with check (person_id = my_person(church_id));
create policy "see own or handle" on placements for select using (person_id = my_person(church_id) or handles_placement(church_id));
create policy "decide placements" on placements for update using (handles_placement(church_id));
