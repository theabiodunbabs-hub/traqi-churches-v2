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
