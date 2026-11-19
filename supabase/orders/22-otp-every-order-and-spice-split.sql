-- بروستد عالطريق: كود الواتساب مع كل طلب، طلب مفتوح واحد لحد الاستلام، وتقسيم حار/عادي. بيعتمد على 11 و 17 و 19 و 21. آمن تشغّله أكثر من مرة.
-- 1) كود مع كل طلب: الكود بيعطي «تصريح» لطلب واحد، صالح 15 دقيقة، وبينحرق أول ما الطلب ينسجّل. ما في جهاز «متذكّر».
-- 2) طلب مفتوح واحد: أي طلب جديد (لآخر 24 ساعة) أو مؤكَّد أو جاهز بيمنع طلب ثاني لنفس الرقم، من أي فرع، لحد ما ينسجّل «تم الاستلام»
--    (أو ينلغى، أو «لم يتم الاستلام»). الطلبات المؤكدة بتنسكّر لحالها بعد الساعات المحددة بالإعدادات (17).
-- 3) تقسيم الحار: البروستد من 12 قطعة وطالع بمضاعفات الـ 4 (مثلاً 8 حار و 4 عادي)، والتندر من 8 قطع وطالع بأي عدد.
--    عدد القطع بينقرأ من اسم الصنف («وجبة 12 قطعة»)، والقواعد بـ order_settings.spice_split.
-- ملاحظة: هالملف بيعيد تعريف active_order و order_guard و create_order و cc_edit_order و apply_spice و get_order و printer_next و cleanup_otp.
--          إذا رجعت شغّلت 17 أو 19 أو 21، أعد تشغيل هالملف بعدهم.

-- ── الإعدادات والأعمدة ──
alter table public.order_settings add column if not exists spice_split jsonb not null
  default '{"broasted": {"step": 4, "min": 12}, "tender": {"step": 1, "min": 8}}';
alter table public.order_items add column if not exists spice_hot smallint check (spice_hot between 1 and 99);
alter table public.order_items add column if not exists spice_regular smallint check (spice_regular between 1 and 99);
alter table public.order_items drop constraint if exists order_items_spice_check;
alter table public.order_items add constraint order_items_spice_check check (spice in ('regular', 'hot', 'mixed'));
alter table public.order_items drop constraint if exists order_items_spice_mixed_check;
alter table public.order_items add constraint order_items_spice_mixed_check
  check ((spice = 'mixed') = (spice_hot is not null and spice_regular is not null));

-- عدد القطع من اسم الصنف: «وجبة 12 قطعة بروستد» = 12، «وجبة 8 قطع تندر» = 8، غير هيك 0
create or replace function public.spice_pieces(p_name text)
returns int language sql immutable set search_path = public as $$
  select coalesce((regexp_match(coalesce(p_name, ''), '([0-9]+)\s*(قطعة|قطع)'))[1]::int, 0);
$$;

-- قاعدة التقسيم لصنف: {pieces, step} أو null إذا الصنف ما بيتقسّم
create or replace function public.spice_rule(p_item text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('pieces', public.spice_pieces(m.name), 'step', (s.spice_split->m.category_id->>'step')::int)
  from public.menu_items() m cross join public.order_settings s
  where s.id = 1 and m.item_id = p_item
    and s.spice_split ? m.category_id
    and m.category_id = any (s.spice_categories)
    and public.spice_pieces(m.name) >= (s.spice_split->m.category_id->>'min')::int
    and public.spice_pieces(m.name) > (s.spice_split->m.category_id->>'step')::int;
$$;

-- فحص التقسيم قبل ما ينسجّل أي إشي: «مقسوم» بس على صنف بيتقسّم، وعدد الحار بين 1 والقطع ناقص 1، وبمضاعفات الخطوة
create or replace function public.spice_ok(p_items jsonb)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare line jsonb; r jsonb; v_hot int;
begin
  if jsonb_typeof(p_items) <> 'array' then return true; end if;   -- باقي فحوصات الأصناف بمكانها
  for line in select * from jsonb_array_elements(p_items) loop
    if line->>'spice' = 'mixed' then
      r := public.spice_rule(line->>'item_id');
      if r is null then return false; end if;
      begin v_hot := (line->>'hot')::int; exception when others then return false; end;
      if v_hot is null or v_hot < 1 or v_hot >= (r->>'pieces')::int or v_hot % (r->>'step')::int <> 0 then return false; end if;
    elsif line ? 'spice' and line->>'spice' not in ('regular', 'hot') and line->'spice' <> 'null'::jsonb then
      return false;
    end if;
  end loop;
  return true;
end $$;

-- ── طلب مفتوح واحد لحد الاستلام ──
create or replace function public.active_order(p_phone text, p_key uuid default null)
returns public.orders language sql stable security definer set search_path = public as $$
  select o.* from public.orders o, public.order_settings s
  where s.id = 1 and o.customer_phone = public.normalize_phone(p_phone)
    and o.idempotency_key is distinct from p_key
    and ((o.status = 'new' and o.created_at > now() - interval '24 hours')
      or (o.status in ('accepted', 'ready') and coalesce(o.accepted_at, o.created_at) > now() - make_interval(hours => s.auto_complete_hours)))
  order by o.created_at desc limit 1;
$$;

-- ── الفحوصات قبل الطلب: طلب مفتوح، التقسيم، وكود الواتساب لهالطلب ──
create or replace function public.order_guard(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_key uuid; v_phone text := public.normalize_phone(p->>'phone'); v_hash text; a public.orders;
begin
  begin v_key := (p->>'idempotency_key')::uuid; exception when others then v_key := null; end;
  if v_phone is null then return null; end if;
  a := public.active_order(v_phone, v_key);
  if a.id is not null then
    return jsonb_build_object('ok', false, 'error', 'open_order', 'number', a.number,
      'branch', (select name from public.order_branches where id = a.branch_id), 'status', a.status);
  end if;
  if not public.spice_ok(p->'items') then return jsonb_build_object('ok', false, 'error', 'bad_spice'); end if;
  if ((select require_otp from public.order_settings where id = 1)
       or v_phone = any (select unnest(test_phones) from public.whatsapp_config where id = 1))
     and not exists (select 1 from public.orders where idempotency_key = v_key) then
    v_hash := public.otp_hash(v_phone, coalesce(p->>'device', ''));
    -- تصريح لهالطلب: من كود انكتب صح خلال آخر 15 دقيقة، وما انستعمل لطلب قبل
    if not exists (select 1 from public.phone_devices where token_hash = v_hash and created_at > now() - interval '15 minutes') then
      return jsonb_build_object('ok', false, 'error', 'verify_phone');
    end if;
  end if;
  return null;
end $$;
revoke execute on function public.order_guard(jsonb), public.spice_ok(jsonb), public.spice_rule(text) from public, anon, authenticated;

-- بعد ما تنحفظ الأصناف: عادي / حار / مقسوم لكل سطر حسب ترتيبه بالطلب
create or replace function public.apply_spice(p_order uuid, p_items jsonb)
returns void language sql volatile security definer set search_path = public as $$
  with wanted as (
    select t.n, t.v->>'spice' as s, case when t.v->>'hot' ~ '^[0-9]{1,2}$' then (t.v->>'hot')::int end as hot
    from jsonb_array_elements(p_items) with ordinality t(v, n)
  ), rows as (
    select i.id, i.item_id, row_number() over (order by i.id) as n from public.order_items i where i.order_id = p_order
  ), d as (
    select r.id, w.s, w.hot, coalesce(m.category_id = any (s.spice_categories), false) as asks, public.spice_rule(r.item_id) as rule
    from rows r
    left join wanted w on w.n = r.n
    left join public.menu_items() m on m.item_id = r.item_id
    cross join public.order_settings s
    where s.id = 1
  )
  update public.order_items i set
    spice = case when not d.asks then null
                 when d.s = 'mixed' and d.rule is not null then 'mixed'
                 when d.s = 'hot' then 'hot'
                 else 'regular' end,
    spice_hot = case when d.asks and d.s = 'mixed' and d.rule is not null then d.hot end,
    spice_regular = case when d.asks and d.s = 'mixed' and d.rule is not null then (d.rule->>'pieces')::int - d.hot end
  from d where i.id = d.id;
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
    -- التصريح بينحرق: الطلب الجاي بدو كود جديد
    if p->>'device' is not null and public.normalize_phone(p->>'phone') is not null then
      delete from public.phone_devices where token_hash = public.otp_hash(public.normalize_phone(p->>'phone'), p->>'device');
    end if;
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
  if not public.spice_ok(p_items) then return jsonb_build_object('ok', false, 'error', 'bad_spice'); end if;
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

-- صفحة التتبّع والطابعة: التقسيم مع كل صنف
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
                                                          'spice_hot', i.spice_hot, 'spice_regular', i.spice_regular,
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
    'items', (select coalesce(jsonb_agg(jsonb_build_object('name', i.name, 'qty', i.qty, 'options', i.options, 'spice', i.spice,
                'spice_hot', i.spice_hot, 'spice_regular', i.spice_regular, 'note', i.note, 'line_total', i.line_total) order by i.id), '[]')
              from public.order_items i where i.order_id = o.id)));
end $$;

-- التصاريح اللي ما انستعملت بتنمسح بعد يوم
create or replace function public.cleanup_otp()
returns void language sql volatile security definer set search_path = public as $$
  delete from public.otp_requests where expires_at < now() - interval '1 day';
  delete from public.otp_log where sent_at < now() - interval '2 days';
  delete from public.phone_devices where created_at < now() - interval '1 day';
$$;
revoke execute on function public.cleanup_otp() from public, anon, authenticated;

select spice_split as "قواعد تقسيم الحار",
  (select count(*) from public.menu_items() m where public.spice_rule(m.item_id) is not null) as "أصناف بتتقسّم"
from public.order_settings where id = 1;
