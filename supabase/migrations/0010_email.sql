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
