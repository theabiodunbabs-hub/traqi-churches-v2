-- Adds ONE sign-in to the Graceville demo that is already in your database: the Family Life head.
-- Nothing is deleted and no other account or record is changed.
-- Email: family.life@graceville.example   Password: Graceville@2026
-- Safe to run more than once: if the sign-in is already there, it only re-links it.

do $$
declare
  c uuid;
  pid uuid;
  uid uuid;
  n int;
  col text;
begin
  select id into c from churches where slug = 'graceville';
  if c is null then raise exception 'The Graceville demo is not in this database. Run traqi-demo-church.sql instead.'; end if;

  -- The person who leads the Family Life department
  select count(distinct gm.person_id) into n
    from group_members gm join groups g on g.id = gm.group_id
   where g.church_id = c and g.name = 'Family Life' and gm.is_leader;
  if n = 1 then
    select gm.person_id into pid
      from group_members gm join groups g on g.id = gm.group_id
     where g.church_id = c and g.name = 'Family Life' and gm.is_leader;
  else
    -- Fall back to the demo's Family Life head by name
    select count(*) into n from people where church_id = c and first_name = 'Ronke' and last_name = 'Adeyemi';
    if n <> 1 then raise exception 'Could not find exactly one Family Life head in Graceville (found %). Nothing was changed.', n; end if;
    select id into pid from people where church_id = c and first_name = 'Ronke' and last_name = 'Adeyemi';
  end if;

  -- The sign-in (reuse it if it already exists)
  select id into uid from auth.users where email = 'family.life@graceville.example';
  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', 'family.life@graceville.example',
            crypt('Graceville@2026', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
            '{"demo":"graceville","role":"Family Life head"}', now(), now());
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text,
            jsonb_build_object('sub', uid::text, 'email', 'family.life@graceville.example', 'email_verified', true), 'email', now(), now(), now());
  end if;

  -- Supabase needs these blank, not empty, for password sign-in to work
  for col in select column_name from information_schema.columns where table_schema = 'auth' and table_name = 'users'
    and column_name in ('confirmation_token', 'recovery_token', 'email_change_token_new', 'email_change', 'email_change_token_current',
                        'phone_change', 'phone_change_token', 'reauthentication_token') loop
    execute format('update auth.users set %I = coalesce(%I, '''') where id = $1', col, col) using uid;
  end loop;

  -- Link the sign-in to the person, but never take over someone already linked to another account
  update people set user_id = uid where id = pid and (user_id is null or user_id = uid);
  if not found then raise exception 'That person is already linked to a different sign-in. Nothing was changed.'; end if;

  raise notice 'Family Life sign-in ready: family.life@graceville.example is linked to person %.', pid;
end $$;
