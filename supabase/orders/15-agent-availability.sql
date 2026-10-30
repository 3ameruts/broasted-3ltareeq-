-- بروستد عالطريق: الكول سنتر بيتحكم بالأصناف المتوفرة وإيقاف الفروع. بيعتمد على 02 و 09. آمن تشغّله أكثر من مرة.
-- نفس أدوات شاشة الفرع، بس الـ Agent بيقدر عليها لكل الفروع. وكل تغيير بيتسجّل مين عمله.

alter table public.item_availability add column if not exists updated_by text;

-- تصليح أمان: موظف بدون فرع (أو أي حساب مسجّل ما إله دور) كان «my_branch() = null» بيخلّي الفحص يمرق.
-- هلأ اللي ما إله صلاحية واضحة بيترفض. (نفس الدوال من 09 بالفحص المصحّح)
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

create or replace function public.availability_actor()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select name from public.call_center_agents where user_id = auth.uid()),
                  case when public.is_admin() then 'المدير' else 'الفرع' end);
$$;
revoke execute on function public.availability_actor() from public, anon, authenticated;

create or replace function public.set_item_availability(p_item text, p_mode text, p_branch text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_branch text := coalesce(p_branch, public.my_branch()); v_until timestamptz; s public.order_settings;
begin
  if v_branch is null or not coalesce(public.is_admin() or public.is_agent() or v_branch = public.my_branch(), false) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.order_branches where id = v_branch) then return jsonb_build_object('ok', false, 'error', 'bad_branch'); end if;
  if not exists (select 1 from public.menu_items() where item_id = p_item) then
    return jsonb_build_object('ok', false, 'error', 'bad_item');
  end if;
  if p_mode = 'on' then
    delete from public.item_availability where branch_id = v_branch and item_id = p_item;
    return jsonb_build_object('ok', true);
  end if;
  select * into s from public.order_settings where id = 1;
  v_until := case p_mode
    when 'hour' then now() + interval '1 hour'
    -- بكرة = أول فتحة جاية للطلبات (12 الظهر بتوقيت عمّان)
    when 'tomorrow' then ((public.business_date() + 1 + s.open_time) at time zone 'Asia/Amman')
    when 'manual' then null
  end;
  if p_mode not in ('hour', 'tomorrow', 'manual') then return jsonb_build_object('ok', false, 'error', 'bad_mode'); end if;
  insert into public.item_availability (branch_id, item_id, until, updated_by) values (v_branch, p_item, v_until, public.availability_actor())
  on conflict (branch_id, item_id) do update set until = excluded.until, updated_at = now(), updated_by = excluded.updated_by;
  return jsonb_build_object('ok', true, 'until', v_until);
end $$;

create or replace function public.pause_branch(p_minutes int, p_branch text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_branch text := coalesce(p_branch, public.my_branch());
begin
  if v_branch is null or not coalesce(public.is_admin() or public.is_agent() or v_branch = public.my_branch(), false) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.order_branches set paused_until = case when p_minutes is null then null
    else now() + make_interval(mins => least(greatest(p_minutes, 1), 24 * 60)) end
  where id = v_branch;
  return jsonb_build_object('ok', found);
end $$;

select count(*) as "أصناف موقوفة حالياً" from public.item_availability where until is null or until > now();
