-- Round 2, part 2: assistants, approvals, journey confirmations.
-- Safe to run more than once.

-- Assistants act inside their department with the abilities their head chose.
-- groups.extra->'assistants' = [{ "personId": "...", "title": "...", "perms": ["rollcall", ...] }]
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
        (p = 'followup.assign' and perm in ('followup.assign', 'followup.log', 'people.contacts')))
  )
$$;

create or replace function has_perm(c uuid, perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from role_assignments ra join roles r on r.id = ra.role_id
    where ra.church_id = c and ra.person_id = my_person(c)
      and (perm = any (r.permissions) or r.key = 'lead')
      and (ra.pending is null or ra.pending->>'action' = 'remove')
      and (ra.until is null or ra.until > now())
  ) or assistant_has(c, perm)
$$;

-- Role changes: admins propose, pastors approve. Someone may withdraw a request they made.
create or replace function role_change_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if is_pastor(old.church_id) then return old; end if;
    if old.pending->>'action' = 'give' and (old.pending->>'byId')::uuid = my_person(old.church_id) then return old; end if;
    raise exception 'A pastor needs to approve removing a role';
  end if;
  if is_pastor(new.church_id) then return new; end if;
  -- A brand-new church: the founder's first role goes in as it is
  if tg_op = 'INSERT' and not exists (select 1 from role_assignments where church_id = new.church_id) then return new; end if;
  -- Joining a church gives you the Member role for your own record; nothing to approve
  if tg_op = 'INSERT' and new.person_id = my_person(new.church_id)
     and exists (select 1 from roles r where r.id = new.role_id and r.key = 'member') then return new; end if;
  if tg_op = 'INSERT' then
    new.pending := jsonb_build_object('byId', my_person(new.church_id), 'at', now(), 'action', 'give');
    return new;
  end if;
  -- An update by a non-pastor may only ask for a removal
  if new.role_id is distinct from old.role_id or new.scope_type is distinct from old.scope_type or new.scope_group_ids is distinct from old.scope_group_ids or new.scope_ref is distinct from old.scope_ref
     or new.until is distinct from old.until
     or (old.pending is not null and new.pending is distinct from old.pending)
     or (new.pending is not null and new.pending->>'action' <> 'remove') then
    raise exception 'Only a pastor can approve a role change';
  end if;
  return new;
end $$;
drop trigger if exists role_change_guard on role_assignments;
create trigger role_change_guard before insert or update or delete on role_assignments for each row execute function role_change_guard();

-- Churches created while an earlier version of this check was in place: the founder's own role is active.
update role_assignments ra set pending = null
where ra.pending is not null and ra.pending->>'action' = 'give' and (ra.pending->>'byId')::uuid = ra.person_id
  and exists (select 1 from roles r where r.id = ra.role_id and r.key in ('lead', 'member'))
  and (exists (select 1 from roles r where r.id = ra.role_id and r.key = 'member') or not exists (select 1 from role_assignments x join roles r on r.id = x.role_id where x.church_id = ra.church_id and r.key in ('lead', 'pastor') and x.pending is null));

-- Only the lead pastor hands out sensitive abilities.
create or replace function role_perm_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  sensitive text[] := array['care.view', 'finance.count', 'finance.approve', 'finance.transfers', 'finance.view', 'roles.manage', 'billing.manage'];
  before_s text[]; after_s text[];
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  -- A brand-new church setting up its roles (no one holds a role yet)
  if tg_op <> 'DELETE' and not exists (select 1 from role_assignments where church_id = new.church_id) then return new; end if;
  if tg_op = 'DELETE' then
    if old.is_default then raise exception 'Built-in roles can be renamed but not deleted'; end if;
    return old;
  end if;
  select coalesce(array_agg(x order by x), '{}') into after_s from unnest(new.permissions) x where x = any (sensitive);
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(x order by x), '{}') into before_s from unnest(old.permissions) x where x = any (sensitive);
    if new.key is distinct from old.key or new.is_default is distinct from old.is_default then raise exception 'That can''t be changed'; end if;
  else
    before_s := '{}';
  end if;
  if after_s is distinct from before_s and not exists (
    select 1 from role_assignments ra join roles r on r.id = ra.role_id
    where ra.church_id = new.church_id and ra.person_id = my_person(new.church_id) and r.key = 'lead') then
    raise exception 'Only the lead pastor can change that';
  end if;
  return new;
end $$;
drop trigger if exists role_perm_guard on roles;
create trigger role_perm_guard before insert or update or delete on roles for each row execute function role_perm_guard();

-- People can't mark themselves confirmed for a stage, or change their probation or availability for follow-up
create or replace function people_self_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or has_perm(new.church_id, 'people.edit') then return new; end if;
  if new.stage is distinct from old.stage or new.confirmed_at is distinct from old.confirmed_at
     or new.is_leader is distinct from old.is_leader or new.tracked is distinct from old.tracked
     or new.joined_via is distinct from old.joined_via or new.branch_id is distinct from old.branch_id
     or new.inactive is distinct from old.inactive or new.user_id is distinct from old.user_id
     or (new.extra->'probation') is distinct from (old.extra->'probation')
     or (new.extra->'awaitingStage') is distinct from (old.extra->'awaitingStage')
     or (new.extra->'possibleMatchId') is distinct from (old.extra->'possibleMatchId') then
    raise exception 'Only church staff can change that';
  end if;
  return new;
end $$;
