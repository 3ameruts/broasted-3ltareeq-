-- بروستد عالطريق: طلب مفتوح واحد لكل رقم. بيعتمد على 02-orders.sql. آمن تشغّله أكثر من مرة.
-- إذا الزبون عنده طلب لسا ما انأكّد (من آخر 3 ساعات)، ما بيقدر يبعت طلب ثاني لحد ما يتأكّد أو ينلغى.
-- إعادة إرسال نفس الطلب (نفس idempotency_key) بتضل ترجع نفس الطلب عادي.

-- الدالة الأصلية بتصير create_order_core، والجديدة بتفحص قبلها (أول مرة بس)
do $$ begin
  if not exists (select 1 from pg_proc where proname = 'create_order_core' and pronamespace = 'public'::regnamespace) then
    alter function public.create_order(jsonb) rename to create_order_core;
  end if;
end $$;
revoke execute on function public.create_order_core(jsonb) from public, anon, authenticated;

create or replace function public.create_order(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_key uuid; v_phone text := public.normalize_phone(p->>'phone');
begin
  begin v_key := (p->>'idempotency_key')::uuid; exception when others then v_key := null; end;
  if v_phone is not null and exists (
    select 1 from public.orders
    where customer_phone = v_phone and status = 'new' and created_at > now() - interval '3 hours'
      and idempotency_key is distinct from v_key
  ) then
    return jsonb_build_object('ok', false, 'error', 'open_order');
  end if;
  return public.create_order_core(p);
end $$;
revoke execute on function public.create_order(jsonb) from public;
grant execute on function public.create_order(jsonb) to anon, authenticated;
