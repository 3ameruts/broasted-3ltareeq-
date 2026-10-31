-- بروستد عالطريق: الكول سنتر. بيعتمد على 02-orders.sql. آمن تشغّله أكثر من مرة.
-- الـ Agent بيشوف طلبات كل الفروع، بيستلم الطلب (بينقفل باسمه)، وبعدها لازم يا يأكّده على POS الفرع (مع رقم فاتورة الـ POS)
-- يا يلغيه. ما بيقدر يرجّعه للقائمة؛ المدير بس بيقدر يفك القفل (مثلاً إذا الـ Agent روّح وطلبه معلّق).

-- ───────────── حسابات الـ Agents ─────────────
create table if not exists public.call_center_agents (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.call_center_agents enable row level security;
revoke all on public.call_center_agents from anon, authenticated;
grant select on public.call_center_agents to authenticated;

create or replace function public.is_agent()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.call_center_agents where user_id = auth.uid() and active);
$$;
revoke execute on function public.is_agent() from public, anon;
grant execute on function public.is_agent() to authenticated;

drop policy if exists "agents and admins see agents" on public.call_center_agents;
create policy "agents and admins see agents" on public.call_center_agents for select to authenticated
  using (public.is_admin() or public.is_agent());

-- ───────────── الطلب: مين استلمه ومين أكّده ─────────────
alter table public.orders add column if not exists claimed_by uuid;
alter table public.orders add column if not exists claimed_name text;
alter table public.orders add column if not exists claimed_at timestamptz;
alter table public.orders add column if not exists confirmed_name text;
alter table public.orders add column if not exists confirmed_at timestamptz;
alter table public.orders add column if not exists pos_ref text check (char_length(pos_ref) <= 40);

-- الـ Agents بيشوفوا طلبات كل الفروع (والتحديث المباشر بيمشي على نفس الصلاحية)
drop policy if exists "branch sees own orders" on public.orders;
create policy "branch sees own orders" on public.orders for select to authenticated
  using (public.is_admin() or public.is_agent() or branch_id = public.my_branch());
drop policy if exists "branch sees own order items" on public.order_items;
create policy "branch sees own order items" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id
                 and (public.is_admin() or public.is_agent() or o.branch_id = public.my_branch())));

-- نفس فحص شاشة الفرع، والـ Agent مسموح إله على كل الفروع (بيشمل رفض الطلب وتنبيه الرقم)
create or replace function public.staff_order(p_order uuid)
returns public.orders language plpgsql volatile security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  if not found or not coalesce(public.is_admin() or public.is_agent() or o.branch_id = public.my_branch(), false) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return o;
end $$;

create or replace function public.phone_history(p_order uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order;
  if not found or not coalesce(public.is_admin() or public.is_agent() or o.branch_id = public.my_branch(), false) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return jsonb_build_object('bad', (select count(*) from public.orders
    where customer_phone = o.customer_phone and status in ('rejected', 'no_show') and id <> o.id));
end $$;

-- الطلب للكول سنتر بس (مش لموظف الفرع)
create or replace function public.agent_order(p_order uuid)
returns public.orders language plpgsql volatile security definer set search_path = public as $$
declare o public.orders;
begin
  if not (public.is_agent() or public.is_admin()) then raise exception 'not_allowed' using errcode = '42501'; end if;
  return public.staff_order(p_order);
end $$;

create or replace function public.agent_name()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select name from public.call_center_agents where user_id = auth.uid()), 'عامر');
$$;

-- استلام الطلب: بينقفل باسم الـ Agent. إذا حدا ثاني ماسكه بيرجع «مع فلان».
create or replace function public.cc_claim(p_order uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare o public.orders;
begin
  o := public.agent_order(p_order);
  if o.status <> 'new' then return jsonb_build_object('ok', false, 'error', 'bad_status', 'status', o.status); end if;
  if o.claimed_by is not null and o.claimed_by <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'taken', 'name', o.claimed_name);
  end if;
  update public.orders set claimed_by = auth.uid(), claimed_name = public.agent_name(), claimed_at = now() where id = o.id;
  return jsonb_build_object('ok', true);
end $$;

-- فك القفل ورجوع الطلب للقائمة: المدير بس
create or replace function public.cc_release(p_order uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare o public.orders;
begin
  o := public.agent_order(p_order);
  if not public.is_admin() then return jsonb_build_object('ok', false, 'error', 'not_allowed'); end if;
  update public.orders set claimed_by = null, claimed_name = null, claimed_at = null where id = o.id and status = 'new';
  return jsonb_build_object('ok', true);
end $$;

-- تأكيد الطلب بعد إدخاله على POS الفرع: الزبون بيشوف «تم تأكيد طلبك»
create or replace function public.cc_confirm(p_order uuid, p_pos_ref text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare o public.orders;
begin
  o := public.agent_order(p_order);
  if o.status = 'accepted' and o.confirmed_at is not null then return jsonb_build_object('ok', true, 'repeat', true); end if;
  if o.status <> 'new' then return jsonb_build_object('ok', false, 'error', 'bad_status', 'status', o.status); end if;
  if o.claimed_by is not null and o.claimed_by <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'taken', 'name', o.claimed_name);
  end if;
  update public.orders set status = 'accepted', accepted_at = now(), accepted_by = auth.uid(),
    claimed_by = auth.uid(), claimed_name = public.agent_name(), claimed_at = coalesce(claimed_at, now()),
    confirmed_name = public.agent_name(), confirmed_at = now(), pos_ref = left(nullif(btrim(p_pos_ref), ''), 40)
  where id = o.id;
  return jsonb_build_object('ok', true);
end $$;

-- إلغاء الطلب من الكول سنتر (الزبون لغى، أو رفض بسبب): بس اللي ماسكه أو المدير
create or replace function public.cc_cancel(p_order uuid, p_reason text, p_block boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare o public.orders;
begin
  o := public.agent_order(p_order);
  if o.status <> 'new' then return jsonb_build_object('ok', false, 'error', 'bad_status', 'status', o.status); end if;
  if o.claimed_by is not null and o.claimed_by <> auth.uid() and not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'taken', 'name', o.claimed_name);
  end if;
  update public.orders set status = 'rejected', reject_reason = left(nullif(btrim(p_reason), ''), 120),
    claimed_by = coalesce(claimed_by, auth.uid()), claimed_name = coalesce(claimed_name, public.agent_name()), claimed_at = coalesce(claimed_at, now()),
    confirmed_name = public.agent_name(), confirmed_at = now()
  where id = o.id;
  if p_block then
    insert into public.blocked_phones (phone, reason, branch_id, blocked_by)
    values (o.customer_phone, left(p_reason, 120), o.branch_id, auth.uid()) on conflict (phone) do nothing;
  end if;
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.agent_order(uuid), public.agent_name(), public.cc_claim(uuid), public.cc_release(uuid),
  public.cc_confirm(uuid, text), public.cc_cancel(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.cc_claim(uuid), public.cc_release(uuid), public.cc_confirm(uuid, text), public.cc_cancel(uuid, text, boolean) to authenticated;

-- ───────────── مدة الاحتفاظ بالطلبات (توفير مساحة) ─────────────
-- الطلبات الأقدم من keep_days بتنحذف كل يوم الصبح، وبيضل ملخص المبيعات اليومي لكل فرع.
alter table public.order_settings add column if not exists keep_days int not null default 90 check (keep_days between 7 and 365);

create or replace function public.cleanup_orders()
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  insert into public.daily_sales (business_date, branch_id, orders, delivered, total, cash, cliq)
  select business_date, branch_id, count(*), count(*) filter (where status = 'delivered'),
         coalesce(sum(subtotal) filter (where status = 'delivered'), 0),
         coalesce(sum(subtotal) filter (where status = 'delivered' and paid_method = 'cash'), 0),
         coalesce(sum(subtotal) filter (where status = 'delivered' and paid_method = 'cliq'), 0)
  from public.orders where business_date < public.business_date() - 1
  group by business_date, branch_id
  on conflict (business_date, branch_id) do nothing;
  delete from public.orders
  where created_at < now() - make_interval(days => (select keep_days from public.order_settings where id = 1));
end $$;
revoke execute on function public.cleanup_orders() from public, anon, authenticated;

-- ───────────── إضافة Agent ─────────────
-- 1) Supabase → Authentication → Users → Add user (إيميل وكلمة سر للـ Agent، وفعّل Auto Confirm)
-- 2) غيّر الإيميل والاسم تحت وشغّل السطرين:
--   insert into public.call_center_agents (user_id, name)
--   select id, 'أحمد' from auth.users where email = 'agent1@example.com'
--   on conflict (user_id) do update set name = excluded.name, active = true;
-- إيقاف Agent:  update public.call_center_agents set active = false where name = 'أحمد';

select u.email as "الإيميل", a.name as "الاسم", a.active as "فعّال"
from public.call_center_agents a join auth.users u on u.id = a.user_id order by a.created_at;
