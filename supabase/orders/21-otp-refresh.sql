-- بروستد عالطريق: تأكيد الرقم بالواتساب بيتجدّد. بيعتمد على 11 و 17. آمن تشغّله أكثر من مرة.
-- 1) الجهاز المأكّد بيضل مأكّد عدد أيام (افتراضياً 30). بعدها أول طلب بيطلب كود جديد. 0 = ما بيتجدّد.
-- 2) لما الطلب ينسجّل «لم يتم الاستلام»، أو ينلغى لأنه «ما ردّ على الاتصال» أو «طلب وهمي»،
--    الرقم بينتسى على كل الأجهزة، فالطلب الجاي بيطلب كود (والرقم المفصول ما بيوصله كود).
-- ملاحظة: هالملف بيعيد تعريف order_guard من 17. إذا رجعت شغّلت 17، أعد تشغيل هالملف بعده.

alter table public.order_settings add column if not exists otp_days int not null default 30 check (otp_days between 0 and 365);

-- الفحوصات قبل الطلب: طلب شغّال، وتأكيد الرقم بالواتساب (إذا شغّال) مع مدة الصلاحية
create or replace function public.order_guard(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_key uuid; v_phone text := public.normalize_phone(p->>'phone'); v_hash text; v_days int; a public.orders; d public.phone_devices;
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
    select otp_days into v_days from public.order_settings where id = 1;
    select * into d from public.phone_devices where token_hash = v_hash;
    if found and v_days > 0 and d.created_at < now() - make_interval(days => v_days) then
      delete from public.phone_devices where token_hash = v_hash;   -- انتهت المدة: بدو كود جديد
      return jsonb_build_object('ok', false, 'error', 'verify_phone');
    end if;
    if not found then return jsonb_build_object('ok', false, 'error', 'verify_phone'); end if;
    update public.phone_devices set last_used_at = now() where token_hash = v_hash;
  end if;
  return null;
end $$;
revoke execute on function public.order_guard(jsonb) from public, anon, authenticated;

-- الرقم ما ردّ أو ما استلم: انسى تأكيده على كل الأجهزة
create or replace function public.forget_unreachable_phone()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status
     and (new.status = 'no_show' or (new.status = 'rejected' and new.reject_reason in ('ما ردّ على الاتصال', 'طلب وهمي'))) then
    delete from public.phone_devices where phone = new.customer_phone;
  end if;
  return new;
end $$;
revoke execute on function public.forget_unreachable_phone() from public, anon, authenticated;
drop trigger if exists orders_forget_phone on public.orders;
create trigger orders_forget_phone after update of status on public.orders
  for each row execute function public.forget_unreachable_phone();

select otp_days as "أيام صلاحية التأكيد", (select count(*) from public.phone_devices) as "أجهزة مأكّدة"
from public.order_settings where id = 1;
