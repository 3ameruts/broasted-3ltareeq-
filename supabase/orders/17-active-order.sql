-- بروستد عالطريق: طلب واحد شغّال لكل زبون، وإغلاق تلقائي للطلبات المؤكدة. بيعتمد على 02 و 09 و 10 و 11 و 13. آمن تشغّله أكثر من مرة.
-- 1) الزبون اللي عنده طلب شغّال (جديد أو مؤكد، من أي فرع) ما بيقدر يطلب طلب ثاني، وبتطلعله رسالة فيها رقم طلبه وفرعه.
-- 2) الطلب المؤكد بيصير «انسلّم» لحاله بعد مدة (من لوحة التحكم، افتراضياً 3 ساعات)، لأنو الكول سنتر برّا الفروع.
-- 3) الكول سنتر بيقدر يكبس «تم الاستلام» عشان الزبون يقدر يطلب من جديد.
-- من هون ورايح create_order مقسوم لأجزاء: order_guard (الفحوصات قبل) ← create_order_core ← apply_delivery_zone (بعد).

alter table public.order_settings add column if not exists auto_complete_hours int not null default 3 check (auto_complete_hours between 1 and 24);
alter table public.orders add column if not exists delivered_by text;

-- طلب الزبون الشغّال (إذا في): جديد، أو مؤكد لسا ما انسلّم وما مرّ عليه وقت الإغلاق التلقائي
create or replace function public.active_order(p_phone text, p_key uuid default null)
returns public.orders language sql stable security definer set search_path = public as $$
  select o.* from public.orders o, public.order_settings s
  where s.id = 1 and o.customer_phone = public.normalize_phone(p_phone)
    and o.idempotency_key is distinct from p_key
    and ((o.status = 'new' and o.created_at > now() - interval '3 hours')
      or (o.status in ('accepted', 'ready') and coalesce(o.accepted_at, o.created_at) > now() - make_interval(hours => s.auto_complete_hours)))
  order by o.created_at desc limit 1;
$$;

-- الفحوصات قبل الطلب: طلب شغّال، وتأكيد الرقم بالواتساب (إذا شغّال)
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
  if ((select require_otp from public.order_settings where id = 1)
       or v_phone = any (select unnest(test_phones) from public.whatsapp_config where id = 1))
     and not exists (select 1 from public.orders where idempotency_key = v_key) then
    v_hash := public.otp_hash(v_phone, coalesce(p->>'device', ''));
    if not exists (select 1 from public.phone_devices where token_hash = v_hash) then
      return jsonb_build_object('ok', false, 'error', 'verify_phone');
    end if;
    update public.phone_devices set last_used_at = now() where token_hash = v_hash;
  end if;
  return null;
end $$;

-- بعد الطلب: منطقة التوصيل وسعرها (إذا الحساب حسب المنطقة شغّال)
create or replace function public.apply_delivery_zone(p jsonb, r jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare z public.delivery_zones; v_zone bigint;
begin
  if not (r->>'ok')::boolean or p->>'type' <> 'delivery' or coalesce((r->>'repeat')::boolean, false)
     or not (select zones_enabled from public.order_settings where id = 1) then
    return r;
  end if;
  begin v_zone := (p->>'zone_id')::bigint; exception when others then v_zone := null; end;
  select * into z from public.delivery_zones where id = v_zone and branch_id = p->>'branch_id' and active;
  if found and z.fee_max is null then
    update public.orders set delivery_zone = z.name, delivery_fee = z.fee where tracking_token = r->>'token';
    return r || jsonb_build_object('delivery_fee', z.fee);
  elsif found then
    update public.orders set delivery_zone = z.name, delivery_range = trim(to_char(z.fee, 'FM990.00')) || ' – ' || trim(to_char(z.fee_max, 'FM990.00'))
    where tracking_token = r->>'token';
  end if;
  return r;
end $$;

create or replace function public.create_order(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare g jsonb;
begin
  g := public.order_guard(p);
  if g is not null then return g; end if;
  return public.apply_delivery_zone(p, public.create_order_core(p));
end $$;

revoke execute on function public.active_order(text, uuid), public.order_guard(jsonb), public.apply_delivery_zone(jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.create_order(jsonb) from public;
grant execute on function public.create_order(jsonb) to anon, authenticated;

-- «تم الاستلام» من الكول سنتر (أو المدير)
create or replace function public.cc_mark_delivered(p_order uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare o public.orders;
begin
  o := public.agent_order(p_order);
  if o.status = 'delivered' then return jsonb_build_object('ok', true, 'repeat', true); end if;
  if o.status not in ('accepted', 'ready') then return jsonb_build_object('ok', false, 'error', 'bad_status', 'status', o.status); end if;
  update public.orders set status = 'delivered', delivered_at = now(), delivered_by = public.agent_name() where id = o.id;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.cc_mark_delivered(uuid) from public, anon;
grant execute on function public.cc_mark_delivered(uuid) to authenticated;

-- الإغلاق التلقائي: كل ربع ساعة
create or replace function public.auto_complete_orders()
returns int language plpgsql volatile security definer set search_path = public as $$
declare n int;
begin
  update public.orders o set status = 'delivered', delivered_at = now(), delivered_by = 'تلقائي'
  from public.order_settings s
  where s.id = 1 and o.status in ('accepted', 'ready')
    and coalesce(o.accepted_at, o.created_at) < now() - make_interval(hours => s.auto_complete_hours);
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.auto_complete_orders() from public, anon, authenticated;

do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'auto-complete-orders';
  perform cron.schedule('auto-complete-orders', '*/15 * * * *', 'select public.auto_complete_orders()');
exception when others then
  raise notice 'pg_cron مش متوفر: الإغلاق التلقائي ما انجدول. (%)', sqlerrm;
end $$;

-- «الأكثر طلباً 🔥»: أكثر الأصناف انطلبت آخر 30 يوم (بدون الجانبيات والصوصات). أرقام عامة بس، بدون أي بيانات زباين.
create or replace function public.best_sellers(p_limit int default 5)
returns setof text language sql stable security definer set search_path = public as $$
  select i.item_id from public.order_items i
  join public.orders o on o.id = i.order_id
  join public.menu_items() m on m.item_id = i.item_id
  cross join public.order_settings s
  where s.id = 1 and o.status not in ('rejected', 'no_show') and o.created_at > now() - interval '30 days'
    and m.category_id not in ('sides', coalesce(s.sauce_category, 'sauces'))
  group by i.item_id having sum(i.qty) >= 3
  order by sum(i.qty) desc limit least(greatest(p_limit, 1), 10);
$$;
revoke execute on function public.best_sellers(int) from public;
grant execute on function public.best_sellers(int) to anon, authenticated;

select auto_complete_hours as "الإغلاق التلقائي بعد (ساعات)" from public.order_settings where id = 1;
