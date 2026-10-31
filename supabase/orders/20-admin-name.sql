-- بروستد عالطريق: اسم المدير بالكول سنتر «عامر» بدل «المدير». آمن تشغّله أكثر من مرة.
-- (نفس الدوال من 09 و 15 بالاسم الجديد، وبيصلّح الاسم على الطلبات والأصناف القديمة)

create or replace function public.agent_name()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select name from public.call_center_agents where user_id = auth.uid()), 'عامر');
$$;

create or replace function public.availability_actor()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select name from public.call_center_agents where user_id = auth.uid()),
                  case when public.is_admin() then 'عامر' else 'الفرع' end);
$$;
revoke execute on function public.agent_name(), public.availability_actor() from public, anon, authenticated;

update public.orders set claimed_name = 'عامر' where claimed_name = 'المدير';
update public.orders set confirmed_name = 'عامر' where confirmed_name = 'المدير';
update public.orders set edited_by = 'عامر' where edited_by = 'المدير';
update public.orders set fee_set_by = 'عامر' where fee_set_by = 'المدير';
update public.orders set delivered_by = 'عامر' where delivered_by = 'المدير';
update public.item_availability set updated_by = 'عامر' where updated_by = 'المدير';

select public.agent_name() as "الاسم";
