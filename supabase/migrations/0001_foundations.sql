-- Traqi for Churches: stage 1 foundations
-- Every church-owned row carries church_id, and row-level security only
-- returns rows for churches the signed-in user belongs to.

create extension if not exists "pgcrypto";

-- Churches (tenants) -------------------------------------------------------
create table churches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  country text not null default 'Nigeria',
  currency text not null default 'NGN',
  time_zone text not null default 'Africa/Lagos',
  logo_url text,
  brand_color text,
  plan text not null default 'trial',
  trial_ends_at timestamptz not null default now() + interval '60 days',
  created_at timestamptz not null default now()
);

-- People and households ---------------------------------------------------
create type journey_stage as enum ('first_timer', 'returning', 'discipleship', 'member', 'worker', 'leader');

create table households (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references churches on delete cascade,
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

create table people (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references churches on delete cascade,
  first_name text not null,
  last_name text not null,
  gender text not null check (gender in ('M', 'F')),
  phone text not null,
  whatsapp text,
  email text,
  birthday date,           -- full date: day, month and year
  location text,
  occupation text,
  photo_url text,
  stage journey_stage not null default 'first_timer',
  household_id uuid references households on delete set null,
  household_role text check (household_role in ('head', 'spouse', 'child', 'other')),
  is_child boolean not null default false,
  first_visit date,
  last_seen date,
  custom jsonb not null default '{}',
  user_id uuid references auth.users on delete set null, -- set when the person has a login
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (church_id, phone)
);
create index people_church_stage on people (church_id, stage);

-- Departments, units and other groups --------------------------------------
create table groups (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references churches on delete cascade,
  name text not null,
  kind text not null check (kind in ('department', 'unit', 'fellowship', 'ministry')),
  purpose text,
  parent_id uuid references groups on delete cascade,      -- unit inside a department
  supervisor_id uuid references groups on delete set null, -- e.g. Children under Faculty of Training
  overseer_id uuid references people on delete set null,   -- overseeing pastor
  tags text[] not null default '{}',                       -- followup, membership, training, ushering, media, welfare, children
  created_at timestamptz not null default now()
);

create table group_members (
  group_id uuid not null references groups on delete cascade,
  person_id uuid not null references people on delete cascade,
  church_id uuid not null references churches on delete cascade,
  is_leader boolean not null default false,
  joined_at date not null default current_date,
  primary key (group_id, person_id)
);

-- Roles, permissions and scopes ---------------------------------------------
create table roles (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references churches on delete cascade,
  key text,                         -- 'lead', 'pastor', 'admin' ... for default roles
  name text not null,
  description text,
  level int not null default 4,
  is_default boolean not null default false,
  permissions text[] not null default '{}',
  unique (church_id, name)
);

create table role_assignments (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references churches on delete cascade,
  person_id uuid not null references people on delete cascade,
  role_id uuid not null references roles on delete cascade,
  scope_type text not null check (scope_type in ('church', 'groups', 'self')),
  scope_group_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (person_id, role_id)
);

-- Care notes: 'care' follows roles; 'confidential' is lead pastor only unless shared
create table care_notes (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references churches on delete cascade,
  person_id uuid not null references people on delete cascade,
  level text not null check (level in ('care', 'confidential')),
  body text not null,
  author_id uuid not null references people,
  shared_with uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Follow-up -----------------------------------------------------------------
create table followup_cases (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references churches on delete cascade,
  person_id uuid not null references people on delete cascade,
  assignee_id uuid references people on delete set null,
  stage text not null default 'new' check (stage in ('new', 'contacted', 'visited', 'returned', 'in_class', 'member', 'unreachable', 'closed')),
  due_at timestamptz not null default now() + interval '48 hours',
  escalation_level int not null default 0, -- 0 worker, 1 follow-up lead, 2 overseeing pastor, 3 lead pastor
  created_at timestamptz not null default now()
);

create table followup_contacts (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references churches on delete cascade,
  case_id uuid not null references followup_cases on delete cascade,
  by_id uuid not null references people,
  method text not null check (method in ('call', 'whatsapp', 'visit')),
  outcome text not null,
  at timestamptz not null default now()
);

-- Activity log (append-only) ---------------------------------------------------
create table activity_log (
  id bigint generated always as identity primary key,
  church_id uuid not null references churches on delete cascade,
  actor_id uuid references people,
  action text not null,
  target_table text,
  target_id uuid,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);

-- Access helpers ---------------------------------------------------------------
-- The signed-in user's person record in a church
create or replace function my_person(c uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from people where church_id = c and user_id = auth.uid() limit 1
$$;

create or replace function is_church_member(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from people where church_id = c and user_id = auth.uid())
$$;

-- Does the signed-in user hold a permission anywhere in this church?
create or replace function has_perm(c uuid, perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from role_assignments ra join roles r on r.id = ra.role_id
    where ra.church_id = c and ra.person_id = my_person(c)
      and (perm = any (r.permissions) or r.key = 'lead')
  )
$$;

create or replace function is_lead(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from role_assignments ra join roles r on r.id = ra.role_id
    where ra.church_id = c and ra.person_id = my_person(c) and r.key = 'lead'
  )
$$;

-- Row-level security -----------------------------------------------------------
alter table churches enable row level security;
alter table households enable row level security;
alter table people enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table roles enable row level security;
alter table role_assignments enable row level security;
alter table care_notes enable row level security;
alter table followup_cases enable row level security;
alter table followup_contacts enable row level security;
alter table activity_log enable row level security;

create policy "members see their church" on churches for select using (is_church_member(id));
create policy "admins edit their church" on churches for update using (has_perm(id, 'roles.manage'));

-- People: staff with people.view see the church; everyone sees themselves.
-- Finer scoping (department leaders see only their departments) is applied in
-- the app's queries on top of this hard tenant wall.
create policy "see people" on people for select
  using (is_church_member(church_id) and (has_perm(church_id, 'people.view') or user_id = auth.uid()
         or has_perm(church_id, 'followup.log')));
create policy "edit people" on people for update
  using (has_perm(church_id, 'people.edit') or user_id = auth.uid());
create policy "add people" on people for insert
  with check (has_perm(church_id, 'people.edit') or has_perm(church_id, 'followup.assign'));

create policy "see households" on households for all using (is_church_member(church_id));
create policy "see groups" on groups for select using (is_church_member(church_id));
create policy "manage groups" on groups for all using (has_perm(church_id, 'groups.manage'));
create policy "see group members" on group_members for select using (is_church_member(church_id));
create policy "manage group members" on group_members for all using (has_perm(church_id, 'groups.manage'));

create policy "see roles" on roles for select using (is_church_member(church_id));
create policy "manage roles" on roles for all using (has_perm(church_id, 'roles.manage'));
create policy "see assignments" on role_assignments for select using (is_church_member(church_id));
create policy "manage assignments" on role_assignments for all using (has_perm(church_id, 'roles.manage'));

create policy "read care notes" on care_notes for select using (
  case level
    when 'confidential' then is_lead(church_id) or my_person(church_id) = any (shared_with)
    else has_perm(church_id, 'care.view')
  end or author_id = my_person(church_id));
create policy "write care notes" on care_notes for insert
  with check (has_perm(church_id, 'care.view') and author_id = my_person(church_id));
create policy "share confidential notes" on care_notes for update using (is_lead(church_id));

create policy "see cases" on followup_cases for select using (
  has_perm(church_id, 'followup.assign') or assignee_id = my_person(church_id));
create policy "manage cases" on followup_cases for all using (
  has_perm(church_id, 'followup.assign') or assignee_id = my_person(church_id));
create policy "see contacts" on followup_contacts for select using (is_church_member(church_id));
create policy "log contacts" on followup_contacts for insert
  with check (has_perm(church_id, 'followup.log') and by_id = my_person(church_id));

create policy "read activity" on activity_log for select using (has_perm(church_id, 'activity.view'));
create policy "write activity" on activity_log for insert with check (is_church_member(church_id));
-- No update or delete policies: the log is append-only.
