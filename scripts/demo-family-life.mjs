/**
 * Builds traqi-demo-add-family-life.sql: adds the Family Life demo content to a Graceville demo that is
 * ALREADY in the database, without removing it or touching anything people changed while testing.
 *
 * It reads the Family Life records from the freshly built traqi-demo-church.sql, and because every demo build
 * gives people new random ids, the SQL it writes finds each person in the live demo by name and phone instead.
 *
 * Run: node scripts/demo-family-life.mjs   (after: npx vitest run scripts/demo-church.test.ts)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const IN = process.env.DEMO_IN ?? join(root, "traqi-demo-church.sql");
const OUT = process.env.FAMILY_OUT ?? join(root, "traqi-demo-add-family-life.sql");
const src = readFileSync(IN, "utf8");

// ---------- read every data block in the demo file ----------
const tables = {};
for (const m of src.matchAll(/insert into (\w+) \(([^)]*)\)[^$]*\$demo\$([\s\S]*?)\$demo\$/g)) {
  const data = JSON.parse(m[3]);
  (tables[m[1]] ??= []).push(...(Array.isArray(data) ? data : [data]));
}
const baseDate = src.match(/current_date - date '(\d{4}-\d{2}-\d{2})'/)?.[1];
if (!baseDate) throw new Error("Could not find the demo's date in " + IN);
const churchNew = tables.churches[0].id;

// ---------- the Family Life records ----------
const famGroup = tables.groups.find((g) => g.name === "Family Life" && !g.branch_id);
const famHead = tables.group_members.find((gm) => gm.group_id === famGroup.id && gm.is_leader).person_id;
const programmes = tables.programmes.filter((p) => p.data.owner === "family");
const progIds = new Set(programmes.map((p) => p.id));
const sessions = tables.class_sessions.filter((s) => progIds.has(s.programme_id));
const sessionIds = new Set(sessions.map((s) => s.id));
// ids from the new build may already be used by other records in the live demo, so these get their own prefix
const enrolments = tables.enrolments.filter((e) => progIds.has(e.programme_id)).map((e) => ({ ...e, id: `fl-${e.id}`, data: { ...e.data, id: `fl-${e.id}` } }));
const attendance = tables.attendance_records.filter((a) => Array.isArray(a) && sessionIds.has(a[1])).map((a) => ({
  id: `fl-${a[0]}`, church_id: churchNew, meeting_id: a[1], person_id: a[2], data: { id: `fl-${a[0]}`, meetingId: a[1], personId: a[2], method: a[3], at: a[4] } }));
const counsel = tables.counsel_requests.filter((c) => c.handler_id === famHead && c.status === "referred");
const counselPrivate = tables.counsel_private.filter((c) => counsel.some((x) => x.id === c.request_id));
const rsvps = tables.meeting_rsvps.filter((r) => r.data.meetingId === "dm-fam1");
const deptMeetings = (famGroup.extra?.meetings ?? []).filter((m) => m.id === "dm-fam1");
const couples = tables.events.find((e) => e.id === "ev-couples");
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
const eventPatch = couples ? pick(couples.data, ["goals", "objectives", "targetBudget", "regTarget", "committee"]) : {};
const eventQuestions = couples ? (couples.data.questions ?? []).filter((q) => q.id === "gender" || q.id === "diet") : [];

// Marital status for every adult, and the new married couples' homes
const marital = tables.people.filter((p) => p.custom?.marital).map((p) => [p.id, pick(p.custom, ["marital", "maritalOther"])]);
const homes = tables.households.map((h) => ({ id: h.id, name: h.name, members: tables.people.filter((p) => p.household_id === h.id && !p.is_child).map((p) => [p.id, p.anniversary ?? null]) }))
  .filter((h) => h.members.length >= 2);

// ---------- who to find in the live demo ----------
const payload = { programmes, sessions, enrolments, attendance, counsel, counselPrivate, rsvps, deptMeetings, eventPatch, eventQuestions };
const peopleById = new Map(tables.people.map((p) => [p.id, p]));
const needed = new Set([...JSON.stringify(payload).matchAll(/"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/g)].map((m) => m[1]).filter((id) => peopleById.has(id)));
needed.add(famHead);
const optional = new Set([...marital.map(([id]) => id), ...homes.flatMap((h) => h.members.map(([id]) => id))].filter((id) => !needed.has(id)));
const who = (id, must) => { const p = peopleById.get(id); return [id, p.first_name, p.last_name, p.phone ?? "", must]; };
const people = [...[...needed].map((id) => who(id, true)), ...[...optional].map((id) => who(id, false))];

const q = (x) => {
  const body = JSON.stringify(x);
  if (body.includes("$fl$")) throw new Error("data contains the quote mark");
  return `$fl$${body}$fl$`;
};

const sql = `-- =====================================================================
-- Graceville demo: add the Family Life content to the demo that is ALREADY in your database.
-- Nothing is deleted, no other account changes, and anything you edited while testing is kept.
--
-- Adds: marital status for adults who don't have one, ${homes.length} married couples' homes and anniversaries
-- (only for people not already in a home), the Marriage Preparation and Parenting with Purpose courses
-- with their classes, couples and attendance, a marriage case referred to the Family Life head,
-- the Couples' Dinner goals and committee (only what the event doesn't already have),
-- and the monthly Family Life team meeting with two replies.
--
-- Run AFTER database rounds 5, 6 and 7. Safe to run more than once.
-- For the Family Life head's sign-in, also run traqi-demo-add-family-life-login.sql.
-- Built from traqi-demo-church.sql of ${baseDate} by scripts/demo-family-life.mjs.
-- =====================================================================

begin;
set local search_path = public, extensions;

-- Move dates forward to today, the same way the demo does
drop table if exists pg_temp._demo_shift;
create temp table _demo_shift as select (((current_date - date '${baseDate}') / 7) * 7)::int as d;
create or replace function pg_temp.shift(j jsonb) returns jsonb language plpgsql as $f$
declare d int := (select d from _demo_shift); k text; v jsonb; out jsonb; s text;
begin
  if d = 0 then return j; end if;
  case jsonb_typeof(j)
    when 'object' then out := '{}'; for k, v in select * from jsonb_each(j) loop out := out || jsonb_build_object(k, pg_temp.shift(v)); end loop; return out;
    when 'array' then select coalesce(jsonb_agg(pg_temp.shift(x) order by n), '[]') into out from jsonb_array_elements(j) with ordinality t(x, n); return out;
    when 'string' then
      s := j #>> '{}';
      if s ~ '^\\d{4}-\\d{2}-\\d{2}T' then return to_jsonb(to_char((s::timestamptz + make_interval(days => d)) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')); end if;
      if s ~ '^\\d{4}-\\d{2}-\\d{2}$' then return to_jsonb(to_char(s::date + d, 'YYYY-MM-DD')); end if;
      return j;
    else return j;
  end case;
end $f$;

-- ---------- Match the demo file's people to the people in your demo, by name and phone ----------
drop table if exists pg_temp._fl_map;
create temp table _fl_map (new_id text primary key, old_id uuid, first_name text, last_name text, phone text, must boolean);
insert into _fl_map (new_id, first_name, last_name, phone, must)
select x->>0, x->>1, x->>2, x->>3, (x->>4)::boolean from jsonb_array_elements(${q(people)}::jsonb) x;

do $$
declare c uuid; missing text;
begin
  select id into c from churches where slug = 'graceville';
  if c is null then raise exception 'The Graceville demo is not in this database. Run traqi-demo-church.sql instead.'; end if;
  if to_regclass('public.meeting_rsvps') is null then raise exception 'Run database rounds 5, 6 and 7 first.'; end if;

  -- Same name and phone; otherwise the only person with that name
  update _fl_map m set old_id = (select p.id from people p where p.church_id = c and p.first_name = m.first_name and p.last_name = m.last_name
    and regexp_replace(coalesce(p.phone, ''), '\\D', '', 'g') = regexp_replace(m.phone, '\\D', '', 'g') limit 1);
  update _fl_map m set old_id = (select min(p.id::text)::uuid from people p where p.church_id = c and p.first_name = m.first_name and p.last_name = m.last_name
    having count(*) = 1) where old_id is null;

  select string_agg(first_name || ' ' || last_name, ', ') into missing from _fl_map where must and old_id is null;
  if missing is not null then raise exception 'These people are not in your Graceville demo, so nothing was added: %', missing; end if;
  delete from _fl_map where old_id is null;

  -- The church and the Family Life department
  insert into _fl_map (new_id, old_id, must) values ('${churchNew}', c, true);
  insert into _fl_map (new_id, old_id, must)
  select '${famGroup.id}', g.id, true from groups g where g.church_id = c and g.name = 'Family Life' and g.branch_id is null limit 1;
  if not exists (select 1 from _fl_map where new_id = '${famGroup.id}') then raise exception 'There is no Family Life department in your Graceville demo.'; end if;
end $$;

-- Swap the demo file's ids for yours, and move the dates to today
create or replace function pg_temp.fl(j jsonb) returns jsonb language plpgsql as $f$
declare t text := j::text; r record;
begin
  for r in select new_id, old_id from pg_temp._fl_map loop
    if position(r.new_id in t) > 0 then t := replace(t, '"' || r.new_id || '"', '"' || r.old_id || '"'); end if;
  end loop;
  return pg_temp.shift(t::jsonb);
end $f$;

-- ---------- Marital status (only for people who don't have one yet) ----------
update people p set custom = coalesce(p.custom, '{}'::jsonb) || (x->1)
  from jsonb_array_elements(${q(marital)}::jsonb) x join _fl_map m on m.new_id = x->>0
 where p.id = m.old_id and coalesce(p.custom->>'marital', '') = '';

-- ---------- Married couples' homes (only when neither of them is in a home yet) ----------
do $$
declare c uuid := (select id from churches where slug = 'graceville'); h jsonb; ids uuid[]; hid uuid;
begin
  for h in select * from jsonb_array_elements(${q(homes)}::jsonb) loop
    select array_agg(m.old_id) into ids from jsonb_array_elements(h->'members') x join _fl_map m on m.new_id = x->>0;
    if coalesce(array_length(ids, 1), 0) <> jsonb_array_length(h->'members') then continue; end if;
    if exists (select 1 from people where id = any (ids) and household_id is not null) then continue; end if;
    hid := gen_random_uuid();
    insert into households (id, church_id, name) values (hid, c, h->>'name');
    update people p set household_id = hid,
           anniversary = coalesce(p.anniversary, (pg_temp.shift(to_jsonb(x->>1)) #>> '{}')::date)
      from jsonb_array_elements(h->'members') x join _fl_map m on m.new_id = x->>0
     where p.id = m.old_id;
  end loop;
end $$;

-- ---------- The Family Life courses, their classes, couples and attendance ----------
insert into programmes (id, church_id, data)
select id, church_id, data from jsonb_populate_recordset(null::programmes, pg_temp.fl(${q(programmes)}::jsonb))
on conflict do nothing;
insert into class_sessions (id, church_id, programme_id, data)
select id, church_id, programme_id, data from jsonb_populate_recordset(null::class_sessions, pg_temp.fl(${q(sessions)}::jsonb))
on conflict do nothing;
insert into enrolments (id, church_id, person_id, programme_id, data)
select id, church_id, person_id, programme_id, data from jsonb_populate_recordset(null::enrolments, pg_temp.fl(${q(enrolments)}::jsonb))
on conflict do nothing;
insert into attendance_records (id, church_id, meeting_id, person_id, data)
select id, church_id, meeting_id, person_id, data from jsonb_populate_recordset(null::attendance_records, pg_temp.fl(${q(attendance)}::jsonb))
on conflict do nothing;

-- ---------- A marriage case the lead pastor referred to the Family Life head ----------
insert into counsel_requests (id, church_id, person_id, handler_id, status, data)
select id, church_id, person_id, handler_id, status, data from jsonb_populate_recordset(null::counsel_requests, pg_temp.fl(${q(counsel)}::jsonb))
on conflict do nothing;
insert into counsel_private (id, church_id, request_id, body)
select id, church_id, request_id, body from jsonb_populate_recordset(null::counsel_private, pg_temp.fl(${q(counselPrivate)}::jsonb))
on conflict do nothing;

-- ---------- The Family Life team meeting and who's coming ----------
update groups g set extra = jsonb_set(coalesce(g.extra, '{}'::jsonb), '{meetings}',
       coalesce(g.extra->'meetings', '[]'::jsonb) || pg_temp.fl(${q(deptMeetings)}::jsonb))
 where g.id = (select old_id from _fl_map where new_id = '${famGroup.id}')
   and not exists (select 1 from jsonb_array_elements(coalesce(g.extra->'meetings', '[]'::jsonb)) x where x->>'id' = 'dm-fam1');
insert into meeting_rsvps (id, church_id, person_id, kind, ref_id, data)
select id, church_id, person_id, kind, ref_id, data from jsonb_populate_recordset(null::meeting_rsvps, pg_temp.fl(${q(rsvps)}::jsonb))
on conflict do nothing;

-- ---------- The Couples' Dinner: goals, targets and committee (what the event already has is kept) ----------
select set_config('request.jwt.claim.sub', coalesce((select id::text from auth.users where email = 'lead.pastor@graceville.example'), ''), true);
update events e set data = pg_temp.fl(${q(eventPatch)}::jsonb) || e.data
 where e.church_id = (select id from churches where slug = 'graceville') and e.id = 'ev-couples';
update events e set data = jsonb_set(e.data, '{questions}', coalesce(e.data->'questions', '[]'::jsonb) || coalesce((
         select jsonb_agg(x) from jsonb_array_elements(${q(eventQuestions)}::jsonb) x
          where not exists (select 1 from jsonb_array_elements(coalesce(e.data->'questions', '[]'::jsonb)) y where y->>'id' = x->>'id')), '[]'::jsonb))
 where e.church_id = (select id from churches where slug = 'graceville') and e.id = 'ev-couples';
select set_config('request.jwt.claim.sub', '', true);

commit;

do $$ begin raise notice 'Family Life is ready: % courses, % couples in courses, % married homes.',
  (select count(*) from programmes p join churches c on c.id = p.church_id where c.slug = 'graceville' and p.data->>'owner' = 'family'),
  (select count(*) / 2 from enrolments e join churches c on c.id = e.church_id where c.slug = 'graceville' and e.data ? 'partnerId'),
  (select count(*) from households h join churches c on c.id = h.church_id where c.slug = 'graceville'); end $$;
`;
writeFileSync(OUT, sql);
console.log(`Wrote ${OUT}: ${programmes.length} courses, ${sessions.length} classes, ${enrolments.length} enrolments, ${attendance.length} attendance, ${counsel.length} case(s), ${homes.length} homes, ${marital.length} marital statuses, ${people.length} people to match.`);
