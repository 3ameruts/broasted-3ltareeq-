-- بروستد عالطريق: مناطق التوصيل وأسعارها لكل فرع. بيعتمد على 05 و 09 و 10 و 11. آمن تشغّله أكثر من مرة.
-- الزبون بيختار منطقته من قائمة الفرع وبيشوف سعر التوصيل والمجموع. إذا منطقته مش بالقائمة (أو الفرع ما إله أسعار)
-- الطلب بيمشي زي قبل والتوصيل بيتحدد بالاتصال. الكول سنتر بيقدر يعدّل سعر التوصيل.
-- ملاحظة: إذا رجعت شغّلت 11 بعد هالملف، أعد تشغيل هالملف.

create table if not exists public.delivery_zones (
  id bigserial primary key,
  branch_id text not null references public.order_branches (id),
  name text not null check (char_length(name) between 1 and 60),
  aliases text[] not null default '{}',
  fee numeric(6,2) not null check (fee between 0 and 20),
  active boolean not null default true,
  unique (branch_id, name)
);
-- بعض المناطق سعرها «من – لـ» (حسب وين بالزبط): fee = من، fee_max = لـ. الزبون بيشوف المدى والكول سنتر بيثبّت السعر.
alter table public.delivery_zones add column if not exists fee_max numeric(6,2) check (fee_max between 0 and 20);
alter table public.delivery_zones drop constraint if exists delivery_zones_range;
alter table public.delivery_zones add constraint delivery_zones_range check (fee_max is null or fee_max > fee);
alter table public.delivery_zones enable row level security;
revoke all on public.delivery_zones from anon, authenticated;
grant select on public.delivery_zones to anon, authenticated;
grant insert, update, delete on public.delivery_zones to authenticated;
grant usage on sequence public.delivery_zones_id_seq to authenticated;
drop policy if exists "zones public" on public.delivery_zones;
create policy "zones public" on public.delivery_zones for select using (active or public.is_admin());
drop policy if exists "admins manage zones" on public.delivery_zones;
create policy "admins manage zones" on public.delivery_zones for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.orders add column if not exists delivery_zone text;
alter table public.orders add column if not exists delivery_fee numeric(6,2) check (delivery_fee between 0 and 50);
alter table public.orders add column if not exists fee_set_by text;
alter table public.orders add column if not exists delivery_range text;

-- الطلب: نفس فحوصات 10 و 11، وبعد ما ينعمل الطلب بنثبّت منطقة التوصيل وسعرها (من قاعدة البيانات، مش من المتصفح)
create or replace function public.create_order(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_key uuid; v_phone text := public.normalize_phone(p->>'phone'); v_hash text; r jsonb; z public.delivery_zones; v_zone bigint;
begin
  begin v_key := (p->>'idempotency_key')::uuid; exception when others then v_key := null; end;
  if v_phone is not null and exists (
    select 1 from public.orders
    where customer_phone = v_phone and status = 'new' and created_at > now() - interval '3 hours'
      and idempotency_key is distinct from v_key
  ) then
    return jsonb_build_object('ok', false, 'error', 'open_order');
  end if;
  if v_phone is not null and ((select require_otp from public.order_settings where id = 1)
       or v_phone = any (select unnest(test_phones) from public.whatsapp_config where id = 1))
     and not exists (select 1 from public.orders where idempotency_key = v_key) then
    v_hash := public.otp_hash(v_phone, coalesce(p->>'device', ''));
    if not exists (select 1 from public.phone_devices where token_hash = v_hash) then
      return jsonb_build_object('ok', false, 'error', 'verify_phone');
    end if;
    update public.phone_devices set last_used_at = now() where token_hash = v_hash;
  end if;

  r := public.create_order_core(p);
  if (r->>'ok')::boolean and p->>'type' = 'delivery' and coalesce((r->>'repeat')::boolean, false) = false then
    begin v_zone := (p->>'zone_id')::bigint; exception when others then v_zone := null; end;
    select * into z from public.delivery_zones where id = v_zone and branch_id = p->>'branch_id' and active;
    if found and z.fee_max is null then
      update public.orders set delivery_zone = z.name, delivery_fee = z.fee where tracking_token = r->>'token';
      r := r || jsonb_build_object('delivery_fee', z.fee);
    elsif found then  -- سعر «من – لـ»: المنطقة معروفة والسعر النهائي بيثبّته الكول سنتر
      update public.orders set delivery_zone = z.name, delivery_range = trim(to_char(z.fee, 'FM990.00')) || ' – ' || trim(to_char(z.fee_max, 'FM990.00'))
      where tracking_token = r->>'token';
    end if;
  end if;
  return r;
end $$;
revoke execute on function public.create_order(jsonb) from public;
grant execute on function public.create_order(jsonb) to anon, authenticated;

-- الكول سنتر (أو المدير): تعديل سعر التوصيل، أو null = بالاتصال
create or replace function public.cc_set_fee(p_order uuid, p_fee numeric)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare o public.orders;
begin
  o := public.agent_order(p_order);
  if o.type <> 'delivery' then return jsonb_build_object('ok', false, 'error', 'not_delivery'); end if;
  if p_fee is not null and (p_fee < 0 or p_fee > 50) then return jsonb_build_object('ok', false, 'error', 'bad_fee'); end if;
  update public.orders set delivery_fee = round(p_fee, 2), fee_set_by = public.agent_name() where id = o.id;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.cc_set_fee(uuid, numeric) from public, anon;
grant execute on function public.cc_set_fee(uuid, numeric) to authenticated;

-- صفحة التتبّع: سعر التوصيل والمنطقة
create or replace function public.get_order(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'number', o.number, 'code', b.code, 'branch', b.name, 'status', o.status, 'type', o.type,
    'name', o.customer_name,
    'phone', left(o.customer_phone, 3) || '****' || right(o.customer_phone, 3),
    'pay_method', o.pay_method, 'subtotal', o.subtotal, 'reject_reason', o.reject_reason,
    'delivery_fee', o.delivery_fee, 'delivery_zone', o.delivery_zone, 'delivery_range', o.delivery_range,
    'created_at', o.created_at, 'accepted_at', o.accepted_at, 'ready_at', o.ready_at, 'delivered_at', o.delivered_at,
    'printed_at', o.printed_at,
    'contact_phone', s.phone,
    'cliq_alias', case when o.pay_method = 'cliq' then s.cliq_alias end,
    'cliq_name', case when o.pay_method = 'cliq' then s.cliq_name end,
    'items', (select coalesce(jsonb_agg(jsonb_build_object('name', i.name, 'qty', i.qty, 'options', i.options,
                                                          'note', i.note, 'line_total', i.line_total) order by i.id), '[]')
              from public.order_items i where i.order_id = o.id))
  from public.orders o
  join public.order_branches b on b.id = o.branch_id
  cross join public.order_settings s
  where o.tracking_token = p_token and s.id = 1 and length(p_token) = 32;
$$;

-- الطابعة: سعر التوصيل بالفاتورة
create or replace function public.printer_next(p_token text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_branch text := public.printer_branch(p_token); o public.orders; s public.order_settings; b public.order_branches;
begin
  if v_branch is null then return jsonb_build_object('ok', false, 'error', 'bad_token'); end if;
  select * into o from public.orders
  where branch_id = v_branch and printed_at is null and status in ('new', 'accepted')
    and created_at > now() - interval '1 day'
    and (print_claimed_at is null or print_claimed_at < now() - interval '60 seconds')
  order by created_at
  limit 1 for update skip locked;
  if not found then return jsonb_build_object('ok', true, 'order', null); end if;
  update public.orders set print_claimed_at = now() where id = o.id;
  select * into s from public.order_settings where id = 1;
  select * into b from public.order_branches where id = v_branch;
  return jsonb_build_object('ok', true, 'order', jsonb_build_object(
    'id', o.id, 'number', o.number, 'branch', b.name, 'type', o.type, 'created_at', o.created_at,
    'name', o.customer_name, 'phone', o.customer_phone, 'address', o.address, 'location', o.location, 'note', o.note,
    'pay_method', o.pay_method, 'change_for', o.change_for, 'subtotal', o.subtotal,
    'delivery_fee', o.delivery_fee, 'delivery_zone', o.delivery_zone, 'delivery_range', o.delivery_range,
    'cliq_alias', case when o.pay_method = 'cliq' then s.cliq_alias end,
    'warn', (select count(*) from public.orders x where x.customer_phone = o.customer_phone and x.status in ('rejected', 'no_show')),
    'items', (select coalesce(jsonb_agg(jsonb_build_object('name', i.name, 'qty', i.qty, 'options', i.options, 'note', i.note, 'line_total', i.line_total) order by i.id), '[]')
              from public.order_items i where i.order_id = o.id)));
end $$;

-- ───────────── إضافة المناطق ─────────────
-- الأسهل من لوحة التحكم ← الطلب الأونلاين ← مناطق التوصيل (بتلصق القائمة: كل سطر «المنطقة - السعر»).
select b.name as "الفرع", count(z.id) as "عدد المناطق"
from public.order_branches b left join public.delivery_zones z on z.branch_id = b.id
group by b.id, b.name order by b.id;
