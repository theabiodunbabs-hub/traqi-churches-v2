-- Round 9: members from every channel, removing entries with a reason, a smarter first-timer form,
-- the worker and head rules, and the new event pages. Safe to run more than once.

-- ---------- Everyone who joined by themselves is a Member ----------
-- People who joined before round 8 were put on the first stage (e.g. First-timer). Move them to Member,
-- so they see "Are you a worker? Choose your department".
update people p set stage = member_stage(p.church_id)
 where p.joined_via = 'search' and p.user_id is not null
   and (p.stage in ('first_timer', 'returning')
        or p.stage in (select s->>'key' from churches c, jsonb_array_elements(coalesce(c.profile->'journey'->'stages', '[]'::jsonb)) s
                        where c.id = p.church_id and s->>'kind' = 'visitor'));

-- ---------- Removed entries are erased 30 days after removal (the reason stays in the activity log) ----------
create or replace function purge_removed_people() returns int
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select id, church_id from people
            where extra->'removed'->>'at' is not null and (extra->'removed'->>'at')::timestamptz < now() - interval '30 days' loop
    begin
      update activity_log set actor_id = null where actor_id = r.id;
      delete from people where id = r.id;
      n := n + 1;
    exception when others then
      -- Something still points at this person (e.g. notes they wrote): keep it hidden instead
      null;
    end;
  end loop;
  return n;
end $$;
revoke all on function purge_removed_people() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then grant execute on function purge_removed_people() to service_role; end if;
end $$;

-- ---------- Smarter first-timer form: do we already have this number? ----------
-- Says only whether the number is known (as Sunday check-in already does), never who it is.
create or replace function welcome_known(p_slug text, p_phone text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from people p join churches c on c.id = p.church_id
                  where c.slug = p_slug and length(right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10)) = 10
                    and right(regexp_replace(p.phone, '\D', '', 'g'), 10) = right(regexp_replace(p_phone, '\D', '', 'g'), 10)
                    and p.extra->'removed' is null)
$$;
grant execute on function welcome_known(text, text) to anon, authenticated;
