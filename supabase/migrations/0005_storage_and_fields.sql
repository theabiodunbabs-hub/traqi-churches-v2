-- Traqi for Churches: file storage for logos, photos and flyers, and extra fields on people.
-- Safe to run more than once.

-- ---------- Extra details churches record about people ----------
alter table people add column if not exists custom jsonb not null default '{}';

-- ---------- Storage: one public bucket, a folder per church ----------
-- Files are stored as <church id>/<kind>/<random name>.webp
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/webp', 'image/png', 'image/jpeg'];

-- Anyone can view (logos and flyers appear on public pages)
drop policy if exists "media is public" on storage.objects;
create policy "media is public" on storage.objects for select using (bucket_id = 'media');

-- People in a church can add files to their own church's folder only
drop policy if exists "upload to my church" on storage.objects;
create policy "upload to my church" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and is_church_member(((storage.foldername(name))[1])::uuid));

-- Admins and the person who uploaded can remove files
drop policy if exists "remove my church files" on storage.objects;
create policy "remove my church files" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (owner = auth.uid() or has_perm(((storage.foldername(name))[1])::uuid, 'roles.manage')));

-- ---------- Extra details from the welcome form ----------
-- A first-timer answers the church's extra questions after service. Only fields the church marked
-- "on the welcome form" are accepted, only for someone whose first visit was in the last 7 days,
-- and nothing is read back.
create or replace function welcome_custom(p_slug text, p_phone text, p_answers jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare c uuid; allowed jsonb; key text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10); clean jsonb := '{}';
  k text; v jsonb;
begin
  if length(key) < 10 or p_answers is null or jsonb_typeof(p_answers) <> 'object' then return; end if;
  select id, coalesce(profile->'customFields', '[]') into c, allowed from churches where slug = p_slug;
  if c is null then return; end if;
  for k, v in select * from jsonb_each(p_answers) loop
    if exists (select 1 from jsonb_array_elements(allowed) f where f->>'id' = k and coalesce((f->>'onWelcome')::boolean, false))
       and jsonb_typeof(v) = 'string' and length(v #>> '{}') <= 200 then
      clean := clean || jsonb_build_object(k, v);
    end if;
  end loop;
  update people set custom = coalesce(custom, '{}') || clean
  where church_id = c and right(regexp_replace(phone, '\D', '', 'g'), 10) = key and first_visit >= current_date - 7;
end $$;
grant execute on function welcome_custom(text, text, jsonb) to anon, authenticated;
