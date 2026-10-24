-- بروستد عالطريق: إعداد قاعدة البيانات للوحة التحكم
-- الصقه كامل بـ Supabase → SQL Editor → Run. آمن تشغّله أكتر من مرة.
-- قبل التشغيل: غيّر الإيميل بآخر الملف لإيميلك.

-- 1. محتوى الموقع (صف واحد فيه كل المنيو والنصوص والصور)
create table if not exists public.site_content (
  id int primary key default 1 check (id = 1),
  content jsonb not null,
  updated_at timestamptz not null default now()
);

-- 2. الإيميلات المسموحلها تعدّل
create table if not exists public.admins (
  email text primary key
);

alter table public.site_content enable row level security;
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "site content is public" on public.site_content;
create policy "site content is public" on public.site_content
  for select using (true);

drop policy if exists "admins insert content" on public.site_content;
create policy "admins insert content" on public.site_content
  for insert to authenticated with check (public.is_admin());

drop policy if exists "admins update content" on public.site_content;
create policy "admins update content" on public.site_content
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- 3. الصور اللي بترفعها من لوحة التحكم (عامة للقراءة)
insert into storage.buckets (id, name, public)
values ('site-images', 'site-images', true)
on conflict (id) do update set public = true;

drop policy if exists "admins upload site images" on storage.objects;
create policy "admins upload site images" on storage.objects
  for insert to authenticated with check (bucket_id = 'site-images' and public.is_admin());

drop policy if exists "admins update site images" on storage.objects;
create policy "admins update site images" on storage.objects
  for update to authenticated using (bucket_id = 'site-images' and public.is_admin());

drop policy if exists "admins delete site images" on storage.objects;
create policy "admins delete site images" on storage.objects
  for delete to authenticated using (bucket_id = 'site-images' and public.is_admin());

-- 4. ⬇️ غيّر هالإيميل لإيميلك (نفس الإيميل اللي رح تعمل فيه حساب الدخول)
insert into public.admins (email) values ('your-email@example.com')
on conflict do nothing;
