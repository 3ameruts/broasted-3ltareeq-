-- بروستد عالطريق: أدوات لوحة التحكم. بيعتمد على 02 و 09. آمن تشغّله أكثر من مرة.
-- 1) نسخة من محتوى الموقع (المنيو والنصوص) مع كل حفظ، وبتقدر ترجع لأي نسخة.  2) الأرقام المحظورة.  3) الـ Agents.

-- ───────────── 1) نسخ محتوى الموقع ─────────────
create table if not exists public.site_content_history (
  id bigserial primary key,
  content jsonb not null,
  saved_at timestamptz not null default now(),
  saved_by text
);
alter table public.site_content_history enable row level security;
revoke all on public.site_content_history from anon, authenticated;
grant select on public.site_content_history to authenticated;
drop policy if exists "admins see history" on public.site_content_history;
create policy "admins see history" on public.site_content_history for select to authenticated using (public.is_admin());

-- كل حفظ بينحفظ نسخة؛ بيضل آخر 60 نسخة (حوالي شهرين لو حفظت كل يوم)
create or replace function public.keep_content_version()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.content = old.content then return new; end if;
  insert into public.site_content_history (content, saved_by) values (new.content, auth.jwt() ->> 'email');
  delete from public.site_content_history where id not in (select id from public.site_content_history order by id desc limit 60);
  return new;
end $$;
drop trigger if exists site_content_versions on public.site_content;
create trigger site_content_versions after insert or update on public.site_content
  for each row execute function public.keep_content_version();
-- أول نسخة: المحتوى الحالي
insert into public.site_content_history (content, saved_by)
select content, 'أول نسخة' from public.site_content
where id = 1 and not exists (select 1 from public.site_content_history);

-- ───────────── 2) الأرقام المحظورة: مين حظر ─────────────
create or replace function public.admin_blocked()
returns table (phone text, reason text, branch text, blocked_by text, blocked_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  return query
  select p.phone, p.reason, b.name,
         coalesce(a.name, u.email::text, 'المدير'), p.blocked_at
  from public.blocked_phones p
  left join public.order_branches b on b.id = p.branch_id
  left join public.call_center_agents a on a.user_id = p.blocked_by
  left join auth.users u on u.id = p.blocked_by
  order by p.blocked_at desc;
end $$;

-- ───────────── 3) الـ Agents ─────────────
create or replace function public.admin_agents()
returns table (user_id uuid, email text, name text, active boolean, today int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  return query
  select a.user_id, u.email::text, a.name, a.active,
         (select count(*)::int from public.orders o where o.accepted_by = a.user_id and o.business_date = public.business_date())
  from public.call_center_agents a join auth.users u on u.id = a.user_id
  order by a.active desc, a.created_at;
end $$;

-- ربط مستخدم موجود (أو انعمل هسّا من لوحة التحكم) كـ Agent
create or replace function public.admin_add_agent(p_email text, p_name text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v uuid;
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 40 then return jsonb_build_object('ok', false, 'error', 'bad_name'); end if;
  select id into v from auth.users where lower(email) = lower(btrim(p_email));
  if v is null then return jsonb_build_object('ok', false, 'error', 'no_user'); end if;
  insert into public.call_center_agents (user_id, name) values (v, btrim(p_name))
  on conflict (user_id) do update set name = excluded.name, active = true;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_update_agent(p_user uuid, p_name text, p_active boolean)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 40 then return jsonb_build_object('ok', false, 'error', 'bad_name'); end if;
  update public.call_center_agents set name = btrim(p_name), active = p_active where user_id = p_user;
  return jsonb_build_object('ok', found);
end $$;

revoke execute on function public.keep_content_version(), public.admin_blocked(), public.admin_agents(),
  public.admin_add_agent(text, text), public.admin_update_agent(uuid, text, boolean) from public, anon;
grant execute on function public.admin_blocked(), public.admin_agents(), public.admin_add_agent(text, text),
  public.admin_update_agent(uuid, text, boolean) to authenticated;

select (select count(*) from public.site_content_history) as "نسخ المحتوى",
       (select count(*) from public.blocked_phones) as "أرقام محظورة",
       (select count(*) from public.call_center_agents) as "Agents";
