-- بروستد عالطريق: الطباعة التلقائية عن طريق كمبيوتر الكاشير (الوسيط). بيعتمد على 02-orders.sql. آمن تشغّله أكثر من مرة.
-- كل فرع إله رمز سري واحد؛ برنامج الوسيط بيستعمله بس لسحب طلبات فرعه وتأكيد طباعتها. ما بيقدر يشوف إشي ثاني.

alter table public.orders add column if not exists print_claimed_at timestamptz;

create table if not exists public.printer_tokens (
  branch_id text primary key references public.order_branches (id),
  token text not null unique check (length(token) = 40),
  last_seen timestamptz,
  created_at timestamptz not null default now()
);
alter table public.printer_tokens enable row level security;
revoke all on public.printer_tokens from anon, authenticated;
grant select on public.printer_tokens to authenticated;
drop policy if exists "admins see printers" on public.printer_tokens;
create policy "admins see printers" on public.printer_tokens for select to authenticated using (public.is_admin());

-- المدير بيولّد رمز جديد لفرع (الرمز القديم بيبطل فوراً)
create or replace function public.new_printer_token(p_branch text)
returns text language plpgsql volatile security definer set search_path = public as $$
declare t text := 'p' || replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 7);
begin
  -- session_user is postgres only in the SQL editor; API calls arrive as authenticator
  if not (public.is_admin() or (auth.uid() is null and session_user in ('postgres', 'supabase_admin'))) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  insert into public.printer_tokens (branch_id, token) values (p_branch, t)
  on conflict (branch_id) do update set token = excluded.token, last_seen = null;
  return t;
end $$;

create or replace function public.printer_branch(p_token text)
returns text language sql volatile security definer set search_path = public as $$
  update public.printer_tokens set last_seen = now() where token = p_token and length(p_token) = 40 returning branch_id;
$$;

-- الطلب الجاي للطباعة: الأقدم اللي ما انطبع. إذا الوسيط سحب طلب وما أكّد خلال دقيقة، بيرجع ينعطى.
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
    'cliq_alias', case when o.pay_method = 'cliq' then s.cliq_alias end,
    'warn', (select count(*) from public.orders x where x.customer_phone = o.customer_phone and x.status in ('rejected', 'no_show')),
    'items', (select coalesce(jsonb_agg(jsonb_build_object('name', i.name, 'qty', i.qty, 'options', i.options, 'note', i.note, 'line_total', i.line_total) order by i.id), '[]')
              from public.order_items i where i.order_id = o.id)));
end $$;

-- تأكيد الطباعة (مرة وحدة؛ تكرار التأكيد ما بيغيّر إشي)
create or replace function public.printer_done(p_token text, p_order uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_branch text := public.printer_branch(p_token);
begin
  if v_branch is null then return jsonb_build_object('ok', false, 'error', 'bad_token'); end if;
  update public.orders set printed_at = coalesce(printed_at, now()), print_count = print_count + case when printed_at is null then 1 else 0 end
  where id = p_order and branch_id = v_branch;
  return jsonb_build_object('ok', found);
end $$;

-- إشارة «أنا شغّال» من الوسيط كل دقيقة، حتى لو ما في طلبات
create or replace function public.printer_ping(p_token text)
returns jsonb language sql volatile security definer set search_path = public as $$
  select jsonb_build_object('ok', public.printer_branch(p_token) is not null);
$$;

-- صفحة التتبع: بتعرف إذا الطلب وصل الفرع وانطبع
create or replace function public.get_order(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'number', o.number, 'code', b.code, 'branch', b.name, 'status', o.status, 'type', o.type,
    'name', o.customer_name,
    'phone', left(o.customer_phone, 3) || '****' || right(o.customer_phone, 3),
    'pay_method', o.pay_method, 'subtotal', o.subtotal, 'reject_reason', o.reject_reason,
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

revoke execute on function public.new_printer_token(text), public.printer_branch(text), public.printer_next(text),
  public.printer_done(text, uuid), public.printer_ping(text) from public, anon, authenticated;
grant execute on function public.printer_next(text), public.printer_done(text, uuid), public.printer_ping(text) to anon, authenticated;
grant execute on function public.new_printer_token(text) to authenticated;
grant execute on function public.get_order(text) to anon, authenticated;

-- رموز الفروع: بتطلع بنتيجة هالاستعلام، كل فرع إله رمز. انسخ رمز الفرع لملف إعداد الوسيط على كمبيوتر الكاشير.
do $$ declare b record; begin
  for b in select id from public.order_branches loop
    if not exists (select 1 from public.printer_tokens where branch_id = b.id) then perform public.new_printer_token(b.id); end if;
  end loop;
end $$;
select b.name as "الفرع", t.token as "رمز الطابعة" from public.printer_tokens t join public.order_branches b on b.id = t.branch_id order by b.id;
