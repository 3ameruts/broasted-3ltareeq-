-- بروستد عالطريق: «حار ولا عادي» لكل صنف بالأقسام اللي بتختارها من لوحة التحكم. بيعتمد على 02 و 13 و 16 و 17. آمن تشغّله أكثر من مرة.
-- الاختيار بيتسجّل مع كل صنف بالطلب، وبيطلع للكول سنتر وبالفاتورة وبالتتبّع. ما بيغيّر السعر.
-- ملاحظة: هالملف بيعيد تعريف create_order و cc_edit_order و get_order و printer_next. إذا رجعت شغّلت 13 أو 16 أو 17، أعد تشغيل هالملف.

alter table public.order_items add column if not exists spice text check (spice in ('regular', 'hot'));
alter table public.order_settings add column if not exists spice_categories text[] not null default '{broasted,tender,combo,sandwiches}';

-- بعد ما تنحفظ الأصناف: حار/عادي لكل سطر حسب ترتيبه بالطلب. صنف بقسم فيه اختيار وما انبعت اختيار = عادي.
create or replace function public.apply_spice(p_order uuid, p_items jsonb)
returns void language sql volatile security definer set search_path = public as $$
  with wanted as (
    select t.n, t.v->>'spice' as s from jsonb_array_elements(p_items) with ordinality t(v, n)
  ), rows as (
    select i.id, i.item_id, row_number() over (order by i.id) as n from public.order_items i where i.order_id = p_order
  )
  update public.order_items i set spice = case
      when w.s in ('regular', 'hot') and m.category_id = any (s.spice_categories) then w.s
      when m.category_id = any (s.spice_categories) then 'regular' end
  from rows r
  left join wanted w on w.n = r.n
  left join public.menu_items() m on m.item_id = r.item_id
  cross join public.order_settings s
  where s.id = 1 and i.id = r.id;
$$;
revoke execute on function public.apply_spice(uuid, jsonb) from public, anon, authenticated;

create or replace function public.create_order(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare g jsonb; r jsonb;
begin
  g := public.order_guard(p);
  if g is not null then return g; end if;
  r := public.apply_delivery_zone(p, public.create_order_core(p));
  if (r->>'ok')::boolean and not coalesce((r->>'repeat')::boolean, false) then
    perform public.apply_spice((select id from public.orders where tracking_token = r->>'token'), p->'items');
  end if;
  return r;
end $$;
revoke execute on function public.create_order(jsonb) from public;
grant execute on function public.create_order(jsonb) to anon, authenticated;

create or replace function public.cc_edit_order(p_order uuid, p_items jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare o public.orders; r jsonb;
begin
  o := public.agent_order(p_order);
  if o.status not in ('new', 'accepted') then return jsonb_build_object('ok', false, 'error', 'bad_status', 'status', o.status); end if;
  if o.claimed_by is distinct from auth.uid() and not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'taken', 'name', o.claimed_name);
  end if;
  r := public.price_items(p_items, o.branch_id);
  if not (r->>'ok')::boolean then return r; end if;
  delete from public.order_items where order_id = o.id;
  insert into public.order_items (order_id, item_id, name, unit_price, qty, options, note, line_total)
  select o.id, l->>'item_id', l->>'name', (l->>'unit_price')::numeric, (l->>'qty')::int, l->'options', l->>'note', (l->>'line_total')::numeric
  from jsonb_array_elements(r->'lines') with ordinality t(l, n) order by n;
  perform public.apply_spice(o.id, p_items);
  update public.orders set subtotal = (r->>'total')::numeric, edited_by = public.agent_name(), edited_at = now() where id = o.id;
  return jsonb_build_object('ok', true, 'subtotal', (r->>'total')::numeric);
end $$;
revoke execute on function public.cc_edit_order(uuid, jsonb) from public, anon;
grant execute on function public.cc_edit_order(uuid, jsonb) to authenticated;

-- صفحة التتبّع والطابعة: حار/عادي مع كل صنف
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
    'items', (select coalesce(jsonb_agg(jsonb_build_object('name', i.name, 'qty', i.qty, 'options', i.options, 'spice', i.spice,
                                                          'note', i.note, 'line_total', i.line_total) order by i.id), '[]')
              from public.order_items i where i.order_id = o.id))
  from public.orders o
  join public.order_branches b on b.id = o.branch_id
  cross join public.order_settings s
  where o.tracking_token = p_token and s.id = 1 and length(p_token) = 32;
$$;

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
    'items', (select coalesce(jsonb_agg(jsonb_build_object('name', i.name, 'qty', i.qty, 'options', i.options, 'spice', i.spice, 'note', i.note, 'line_total', i.line_total) order by i.id), '[]')
              from public.order_items i where i.order_id = o.id)));
end $$;

select spice_categories as "الأقسام اللي فيها حار/عادي" from public.order_settings where id = 1;
