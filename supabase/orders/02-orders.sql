-- بروستد عالطريق: نظام الطلب الأونلاين (الجداول، الصلاحيات، والدوال)
-- بيعتمد على setup.sql (جدول site_content ودالة is_admin). آمن تشغّله أكثر من مرة.
-- كل الأسعار بتنحسب هون من المنيو المحفوظ بلوحة التحكم؛ المتصفح ما بيبعت أسعار.

-- ───────────── الإعدادات ─────────────
create table if not exists public.order_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default false,          -- مفتاح الطلب الأونلاين كله
  open_time time not null default '12:00',          -- أول وقت للطلب (توقيت عمّان)
  last_order_time time not null default '02:30',    -- آخر وقت للطلب
  phone text not null default '0792892666',
  cliq_alias text,                                  -- بيتعبّى من لوحة التحكم
  cliq_name text,
  sauce_category text not null default 'sauces',    -- أصناف هالقسم بتنضاف كصوصات على أي صنف
  cheese_item_id text,                              -- صنف «شريحة جبنة» من الأصناف الجانبية
  cheese_category text not null default 'sandwiches' -- القسم اللي بتنضاف عليه شريحة الجبنة
);
insert into public.order_settings (id) values (1) on conflict do nothing;

create table if not exists public.order_branches (
  id text primary key,                 -- نفس id الفرع بمحتوى الموقع (b1, b2, b3)
  code text not null unique,           -- اختصار لرقم الطلب الداخلي، مثلاً «درة»
  name text not null,
  accepting boolean not null default true,
  paused_until timestamptz             -- إيقاف مؤقت للطلبات
);

-- موظفين الفروع: كل حساب مربوط بفرع واحد
create table if not exists public.branch_staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  branch_id text not null references public.order_branches (id)
);

-- ───────────── الطلبات ─────────────
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  branch_id text not null references public.order_branches (id),
  business_date date not null,
  number int not null,                                     -- رقم داخلي، بيتصفّر كل يوم لكل فرع
  tracking_token text not null unique,                     -- رمز رابط التتبع (122 بت عشوائي)
  idempotency_key uuid not null unique,                    -- بيمنع تكرار نفس الطلب
  status text not null default 'new'
    check (status in ('new', 'accepted', 'ready', 'delivered', 'rejected', 'no_show')),
  type text not null check (type in ('pickup', 'delivery')),
  customer_name text not null,
  customer_phone text not null,
  address jsonb,
  location jsonb,
  note text,
  pay_method text not null check (pay_method in ('cash', 'cliq')),
  change_for numeric(8, 2),
  subtotal numeric(8, 2) not null,
  reject_reason text,
  accepted_at timestamptz, accepted_by uuid,
  printed_at timestamptz, print_count int not null default 0,
  ready_at timestamptz, delivered_at timestamptz,
  paid_method text check (paid_method in ('cash', 'cliq')),
  paid_ref text, paid_at timestamptz, paid_by uuid,
  created_at timestamptz not null default now(),
  unique (branch_id, business_date, number)
);
create index if not exists orders_branch_status on public.orders (branch_id, status, created_at desc);
create index if not exists orders_phone_time on public.orders (customer_phone, created_at desc);

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  item_id text not null,
  name text not null,
  unit_price numeric(8, 2) not null,
  qty int not null check (qty between 1 and 20),
  options jsonb not null default '[]',     -- [{id, name, price, qty}]
  note text,
  line_total numeric(8, 2) not null
);
create index if not exists order_items_order on public.order_items (order_id);

-- الأصناف غير المتوفرة بكل فرع (وجود الصف = غير متوفر)
create table if not exists public.item_availability (
  branch_id text not null references public.order_branches (id),
  item_id text not null,
  until timestamptz,                       -- null = لحد ما الفرع يرجّعه
  updated_at timestamptz not null default now(),
  primary key (branch_id, item_id)
);

create table if not exists public.blocked_phones (
  phone text primary key,
  reason text,
  branch_id text,
  blocked_by uuid,
  blocked_at timestamptz not null default now()
);

-- ملخص يومي بيضل بعد حذف الطلبات القديمة
create table if not exists public.daily_sales (
  business_date date not null,
  branch_id text not null,
  orders int not null,
  delivered int not null,
  total numeric(10, 2) not null,
  cash numeric(10, 2) not null,
  cliq numeric(10, 2) not null,
  primary key (business_date, branch_id)
);

-- ───────────── الصلاحيات ─────────────
alter table public.order_settings enable row level security;
alter table public.order_branches enable row level security;
alter table public.branch_staff enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.item_availability enable row level security;
alter table public.blocked_phones enable row level security;
alter table public.daily_sales enable row level security;

-- ما حدا بيكتب على الجداول مباشرة؛ كل الكتابة عن طريق الدوال تحت.
revoke all on public.order_settings, public.order_branches, public.branch_staff, public.orders,
  public.order_items, public.item_availability, public.blocked_phones, public.daily_sales
  from anon, authenticated;
grant select on public.order_settings, public.order_branches, public.item_availability to anon, authenticated;
grant select on public.branch_staff, public.orders, public.order_items, public.blocked_phones, public.daily_sales to authenticated;
grant update on public.order_settings to authenticated;

create or replace function public.my_branch()
returns text language sql stable security definer set search_path = public as $$
  select branch_id from public.branch_staff where user_id = auth.uid();
$$;

drop policy if exists "settings public" on public.order_settings;
create policy "settings public" on public.order_settings for select using (true);
drop policy if exists "admins edit settings" on public.order_settings;
create policy "admins edit settings" on public.order_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "branches public" on public.order_branches;
create policy "branches public" on public.order_branches for select using (true);

drop policy if exists "availability public" on public.item_availability;
create policy "availability public" on public.item_availability for select using (true);

drop policy if exists "staff see own row" on public.branch_staff;
create policy "staff see own row" on public.branch_staff for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- كل فرع بيشوف طلباته بس؛ المدير بيشوف الكل
drop policy if exists "branch sees own orders" on public.orders;
create policy "branch sees own orders" on public.orders for select to authenticated
  using (public.is_admin() or branch_id = public.my_branch());

drop policy if exists "branch sees own order items" on public.order_items;
create policy "branch sees own order items" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id
                 and (public.is_admin() or o.branch_id = public.my_branch())));

drop policy if exists "admins see blocked" on public.blocked_phones;
create policy "admins see blocked" on public.blocked_phones for select to authenticated using (public.is_admin());

drop policy if exists "admins see sales" on public.daily_sales;
create policy "admins see sales" on public.daily_sales for select to authenticated
  using (public.is_admin() or branch_id = public.my_branch());

-- ───────────── أدوات مساعدة ─────────────
create or replace function public.amman_now()
returns timestamp language sql stable as $$ select now() at time zone 'Asia/Amman' $$;

-- اليوم التجاري بيبلّش الساعة 6 الصبح، فطلبات بعد نص الليل بتنحسب على نفس اليوم
create or replace function public.business_date()
returns date language sql stable as $$ select (public.amman_now() - interval '6 hours')::date $$;

-- 07XXXXXXXX، أو null إذا الرقم مش أردني صحيح
create or replace function public.normalize_phone(p text)
returns text language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g');
begin
  if d like '00962%' then d := '0' || substr(d, 6);
  elsif d like '962%' then d := '0' || substr(d, 4);
  elsif d like '7%' and length(d) = 9 then d := '0' || d;
  end if;
  return case when d ~ '^07[789][0-9]{7}$' then d end;
end $$;

create or replace function public.ordering_open()
returns boolean language sql stable security definer set search_path = public as $$
  select case when s.open_time <= s.last_order_time
              then public.amman_now()::time between s.open_time and s.last_order_time
              else public.amman_now()::time >= s.open_time or public.amman_now()::time < s.last_order_time end
  from public.order_settings s where s.id = 1;
$$;

-- المنيو من لوحة التحكم: كل صنف مع سعره وقسمه
create or replace function public.menu_items()
returns table (item_id text, name text, price numeric, category_id text)
language sql stable security definer set search_path = public as $$
  select i->>'id', i->>'name', (i->>'price')::numeric, c->>'id'
  from public.site_content sc,
       jsonb_array_elements(sc.content->'categories') c,
       jsonb_array_elements(c->'items') i
  where sc.id = 1;
$$;

create or replace function public.item_unavailable(p_branch text, p_item text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.item_availability a
                 where a.branch_id = p_branch and a.item_id = p_item and (a.until is null or a.until > now()));
$$;

-- ───────────── إنشاء الطلب (الزبون) ─────────────
create or replace function public.create_order(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s public.order_settings;
  b public.order_branches;
  v_key uuid;
  v_phone text;
  v_name text := btrim(coalesce(p->>'name', ''));
  v_type text := p->>'type';
  v_pay text := p->>'pay_method';
  v_note text := nullif(btrim(coalesce(p->>'note', '')), '');
  v_addr jsonb;
  v_loc jsonb;
  v_existing public.orders;
  v_lines jsonb := '[]';
  v_unavailable text[] := '{}';
  v_total numeric := 0;
  line jsonb; opt jsonb;
  m record; om record;
  v_qty int; v_oqty int; v_opts jsonb; v_line_total numeric; v_unit numeric; v_inote text;
  v_number int; v_token text; v_order uuid; v_date date := public.business_date();
  v_change numeric;
begin
  -- نفس الطلب انبعت مرتين (كبستين أو إعادة محاولة بعد انقطاع)؟ رجّع نفس الطلب
  begin v_key := (p->>'idempotency_key')::uuid; exception when others then v_key := null; end;
  if v_key is null then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  select * into v_existing from public.orders where idempotency_key = v_key;
  if found then
    return jsonb_build_object('ok', true, 'token', v_existing.tracking_token, 'number', v_existing.number,
                              'subtotal', v_existing.subtotal, 'repeat', true);
  end if;

  select * into s from public.order_settings where id = 1;
  if not s.enabled then return jsonb_build_object('ok', false, 'error', 'ordering_off'); end if;
  if not public.ordering_open() then return jsonb_build_object('ok', false, 'error', 'closed'); end if;

  select * into b from public.order_branches where id = p->>'branch_id';
  if not found then return jsonb_build_object('ok', false, 'error', 'bad_branch'); end if;
  if not b.accepting or coalesce(b.paused_until > now(), false) then
    return jsonb_build_object('ok', false, 'error', 'branch_paused');
  end if;

  v_phone := public.normalize_phone(p->>'phone');
  if v_phone is null then return jsonb_build_object('ok', false, 'error', 'bad_phone'); end if;
  if char_length(v_name) not between 2 and 60 then return jsonb_build_object('ok', false, 'error', 'bad_name'); end if;
  if v_type not in ('pickup', 'delivery') then return jsonb_build_object('ok', false, 'error', 'bad_type'); end if;
  if v_pay not in ('cash', 'cliq') then return jsonb_build_object('ok', false, 'error', 'bad_payment'); end if;
  begin v_change := nullif(least(greatest(coalesce((p->>'change_for')::numeric, 0), 0), 1000), 0);
  exception when others then v_change := null; end;
  if char_length(coalesce(v_note, '')) > 300 then return jsonb_build_object('ok', false, 'error', 'note_too_long'); end if;

  if exists (select 1 from public.blocked_phones where phone = v_phone) then
    return jsonb_build_object('ok', false, 'error', 'blocked');
  end if;
  if (select count(*) from public.orders where customer_phone = v_phone and created_at > now() - interval '10 minutes') >= 3 then
    return jsonb_build_object('ok', false, 'error', 'too_many');
  end if;

  if v_type = 'delivery' then
    v_addr := jsonb_strip_nulls(jsonb_build_object(
      'area', nullif(btrim(left(p->'address'->>'area', 80)), ''),
      'street', nullif(btrim(left(p->'address'->>'street', 80)), ''),
      'building', nullif(btrim(left(p->'address'->>'building', 60)), ''),
      'floor', nullif(btrim(left(p->'address'->>'floor', 40)), ''),
      'landmark', nullif(btrim(left(p->'address'->>'landmark', 120)), '')));
    if v_addr->>'area' is null or v_addr->>'street' is null or v_addr->>'building' is null then
      return jsonb_build_object('ok', false, 'error', 'bad_address');
    end if;
    -- الموقع الجغرافي اختياري
    begin
      if p->'location' is not null and jsonb_typeof(p->'location') = 'object' then
        v_loc := jsonb_build_object('lat', round((p->'location'->>'lat')::numeric, 6), 'lng', round((p->'location'->>'lng')::numeric, 6));
        if (v_loc->>'lat')::numeric not between -90 and 90 or (v_loc->>'lng')::numeric not between -180 and 180 then v_loc := null; end if;
      end if;
    exception when others then v_loc := null;
    end;
  end if;

  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') not between 1 and 30 then
    return jsonb_build_object('ok', false, 'error', 'bad_items');
  end if;

  for line in select * from jsonb_array_elements(p->'items') loop
    select * into m from public.menu_items() mi where mi.item_id = line->>'item_id';
    if not found or m.price is null then return jsonb_build_object('ok', false, 'error', 'bad_item'); end if;
    begin v_qty := (line->>'qty')::int; exception when others then v_qty := null; end;
    if v_qty is null or v_qty not between 1 and 20 then return jsonb_build_object('ok', false, 'error', 'bad_qty'); end if;
    v_inote := nullif(btrim(coalesce(line->>'note', '')), '');
    if char_length(coalesce(v_inote, '')) > 120 then return jsonb_build_object('ok', false, 'error', 'note_too_long'); end if;
    if public.item_unavailable(b.id, m.item_id) then v_unavailable := v_unavailable || m.name; end if;

    v_opts := '[]'; v_unit := m.price;
    if line->'options' is not null and jsonb_typeof(line->'options') = 'array' then
      if jsonb_array_length(line->'options') > 10 then return jsonb_build_object('ok', false, 'error', 'bad_options'); end if;
      for opt in select * from jsonb_array_elements(line->'options') loop
        select * into om from public.menu_items() mi where mi.item_id = opt->>'id';
        -- الصوصات على كل الأصناف (إلا الصوصات والجانبية نفسها)، والجبنة على السندويشات بس
        if not found or m.category_id in (s.sauce_category, 'sides')
           or not (om.category_id = s.sauce_category or (om.item_id = s.cheese_item_id and m.category_id = s.cheese_category)) then
          return jsonb_build_object('ok', false, 'error', 'bad_options');
        end if;
        begin v_oqty := coalesce((opt->>'qty')::int, 1); exception when others then v_oqty := null; end;
        if v_oqty is null or v_oqty not between 1 and 5 then return jsonb_build_object('ok', false, 'error', 'bad_options'); end if;
        if public.item_unavailable(b.id, om.item_id) then v_unavailable := v_unavailable || om.name; end if;
        v_opts := v_opts || jsonb_build_object('id', om.item_id, 'name', om.name, 'price', om.price, 'qty', v_oqty);
        v_unit := v_unit + om.price * v_oqty;
      end loop;
    end if;

    v_line_total := round(v_unit * v_qty, 2);
    v_total := v_total + v_line_total;
    v_lines := v_lines || jsonb_build_object('item_id', m.item_id, 'name', m.name, 'unit_price', m.price,
                                             'qty', v_qty, 'options', v_opts, 'note', v_inote, 'line_total', v_line_total);
  end loop;

  if cardinality(v_unavailable) > 0 then
    return jsonb_build_object('ok', false, 'error', 'unavailable', 'items', to_jsonb(v_unavailable));
  end if;

  -- رقم داخلي متسلسل لكل فرع ويوم (القفل بيمنع رقمين متشابهين)
  perform pg_advisory_xact_lock(hashtext(b.id || v_date::text));
  -- نفس المفتاح ممكن يكون انحفظ بطلب موازي وإحنا مستنيين القفل
  select * into v_existing from public.orders where idempotency_key = v_key;
  if found then
    return jsonb_build_object('ok', true, 'token', v_existing.tracking_token, 'number', v_existing.number,
                              'subtotal', v_existing.subtotal, 'repeat', true);
  end if;
  select coalesce(max(number), 0) + 1 into v_number from public.orders where branch_id = b.id and business_date = v_date;
  v_token := replace(gen_random_uuid()::text, '-', '');

  insert into public.orders (branch_id, business_date, number, tracking_token, idempotency_key, type,
                             customer_name, customer_phone, address, location, note, pay_method, change_for, subtotal)
  values (b.id, v_date, v_number, v_token, v_key, v_type, v_name, v_phone, v_addr, v_loc, v_note, v_pay,
          case when v_pay = 'cash' then v_change end,
          round(v_total, 2))
  returning id into v_order;

  insert into public.order_items (order_id, item_id, name, unit_price, qty, options, note, line_total)
  select v_order, l->>'item_id', l->>'name', (l->>'unit_price')::numeric, (l->>'qty')::int, l->'options',
         l->>'note', (l->>'line_total')::numeric
  from jsonb_array_elements(v_lines) l;

  return jsonb_build_object('ok', true, 'token', v_token, 'number', v_number, 'subtotal', round(v_total, 2));
end $$;

-- ───────────── صفحة التتبع (الزبون) ─────────────
create or replace function public.get_order(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'number', o.number, 'code', b.code, 'branch', b.name, 'status', o.status, 'type', o.type,
    'name', o.customer_name,
    'phone', left(o.customer_phone, 3) || '****' || right(o.customer_phone, 3),
    'pay_method', o.pay_method, 'subtotal', o.subtotal, 'reject_reason', o.reject_reason,
    'created_at', o.created_at, 'accepted_at', o.accepted_at, 'ready_at', o.ready_at, 'delivered_at', o.delivered_at,
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

-- ───────────── شاشة الفرع (الموظفين) ─────────────
-- بيرجّع الطلب إذا المستخدم من نفس الفرع أو مدير، وبيقفل الصف لحد آخر العملية
create or replace function public.staff_order(p_order uuid)
returns public.orders language plpgsql volatile security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order for update;
  if not found or not coalesce(public.is_admin() or o.branch_id = public.my_branch(), false) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return o;
end $$;

-- قبول الطلب. print = true مرة وحدة بس، حتى لو انكبس الزر مرتين أو رجع النت وأعاد المحاولة
create or replace function public.accept_order(p_order uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare o public.orders;
begin
  o := public.staff_order(p_order);
  if o.status not in ('new', 'accepted') then return jsonb_build_object('ok', false, 'error', 'bad_status', 'status', o.status); end if;
  if o.printed_at is not null then return jsonb_build_object('ok', true, 'print', false); end if;
  update public.orders set status = 'accepted', accepted_at = coalesce(accepted_at, now()),
    accepted_by = coalesce(accepted_by, auth.uid()), printed_at = now(), print_count = print_count + 1
  where id = o.id;
  return jsonb_build_object('ok', true, 'print', true);
end $$;

-- إعادة طباعة: بتطلع مكتوب عليها «نسخة»
create or replace function public.reprint_order(p_order uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare o public.orders;
begin
  o := public.staff_order(p_order);
  if o.printed_at is null then return jsonb_build_object('ok', false, 'error', 'not_accepted'); end if;
  update public.orders set print_count = print_count + 1 where id = o.id;
  return jsonb_build_object('ok', true, 'print', true, 'copy', o.print_count);
end $$;

create or replace function public.reject_order(p_order uuid, p_reason text, p_block boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare o public.orders;
begin
  o := public.staff_order(p_order);
  if o.status not in ('new', 'accepted') then return jsonb_build_object('ok', false, 'error', 'bad_status'); end if;
  update public.orders set status = 'rejected', reject_reason = left(nullif(btrim(p_reason), ''), 120) where id = o.id;
  if p_block then
    insert into public.blocked_phones (phone, reason, branch_id, blocked_by)
    values (o.customer_phone, left(p_reason, 120), o.branch_id, auth.uid()) on conflict (phone) do nothing;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- جاهز ← تم التسليم، أو «ما استلم» (مع خيار الحظر)
create or replace function public.set_order_status(p_order uuid, p_status text, p_block boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare o public.orders;
begin
  o := public.staff_order(p_order);
  if not ((o.status = 'accepted' and p_status = 'ready')
       or (o.status in ('accepted', 'ready') and p_status in ('delivered', 'no_show'))) then
    return jsonb_build_object('ok', false, 'error', 'bad_status', 'status', o.status);
  end if;
  update public.orders set status = p_status,
    ready_at = case when p_status = 'ready' then now() else ready_at end,
    delivered_at = case when p_status = 'delivered' then now() else delivered_at end
  where id = o.id;
  if p_status = 'no_show' and p_block then
    insert into public.blocked_phones (phone, reason, branch_id, blocked_by)
    values (o.customer_phone, 'ما استلم الطلب', o.branch_id, auth.uid()) on conflict (phone) do nothing;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- تسجيل الدفع: الموظف بس، بعد ما ياخذ المصاري
create or replace function public.mark_paid(p_order uuid, p_method text, p_ref text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare o public.orders;
begin
  o := public.staff_order(p_order);
  if p_method not in ('cash', 'cliq') then return jsonb_build_object('ok', false, 'error', 'bad_method'); end if;
  if o.status in ('new', 'rejected') then return jsonb_build_object('ok', false, 'error', 'bad_status'); end if;
  update public.orders set paid_method = p_method, paid_ref = left(nullif(btrim(p_ref), ''), 60),
    paid_at = now(), paid_by = auth.uid()
  where id = o.id;
  return jsonb_build_object('ok', true);
end $$;

-- التوفّر: p_mode = 'on' | 'hour' | 'tomorrow' | 'manual'
create or replace function public.set_item_availability(p_item text, p_mode text, p_branch text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_branch text := coalesce(p_branch, public.my_branch()); v_until timestamptz; s public.order_settings;
begin
  if v_branch is null or not coalesce(public.is_admin() or v_branch = public.my_branch(), false) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
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
  insert into public.item_availability (branch_id, item_id, until) values (v_branch, p_item, v_until)
  on conflict (branch_id, item_id) do update set until = excluded.until, updated_at = now();
  return jsonb_build_object('ok', true, 'until', v_until);
end $$;

-- إيقاف طلبات الفرع مؤقتاً (p_minutes = null يعني تشغيل)
create or replace function public.pause_branch(p_minutes int, p_branch text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_branch text := coalesce(p_branch, public.my_branch());
begin
  if v_branch is null or not coalesce(public.is_admin() or v_branch = public.my_branch(), false) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.order_branches set paused_until = case when p_minutes is null then null
    else now() + make_interval(mins => least(greatest(p_minutes, 1), 24 * 60)) end
  where id = v_branch;
  return jsonb_build_object('ok', true);
end $$;

-- حظر وفك حظر يدوي (المدير)
create or replace function public.set_phone_blocked(p_phone text, p_blocked boolean, p_reason text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v text := public.normalize_phone(p_phone);
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if v is null then return jsonb_build_object('ok', false, 'error', 'bad_phone'); end if;
  if p_blocked then
    insert into public.blocked_phones (phone, reason, blocked_by) values (v, left(p_reason, 120), auth.uid())
    on conflict (phone) do update set reason = excluded.reason;
  else
    delete from public.blocked_phones where phone = v;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- عدد الطلبات المرفوضة أو اللي لم يتم استلامها لنفس الرقم (تنبيه للكاشير)
create or replace function public.phone_history(p_order uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order;
  if not found or not coalesce(public.is_admin() or o.branch_id = public.my_branch(), false) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return jsonb_build_object('bad', (select count(*) from public.orders
    where customer_phone = o.customer_phone and status in ('rejected', 'no_show') and id <> o.id));
end $$;

-- ───────────── التنظيف التلقائي ─────────────
-- بيلخّص الأيام اللي خلصت، وبيحذف الطلبات (وبيانات الزباين) الأقدم من 90 يوم
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
  delete from public.orders where created_at < now() - interval '90 days';
end $$;

-- ───────────── صلاحيات الدوال ─────────────
revoke execute on function public.create_order(jsonb), public.get_order(text), public.staff_order(uuid),
  public.accept_order(uuid), public.reprint_order(uuid), public.reject_order(uuid, text, boolean),
  public.set_order_status(uuid, text, boolean), public.mark_paid(uuid, text, text),
  public.set_item_availability(text, text, text), public.pause_branch(int, text),
  public.set_phone_blocked(text, boolean, text), public.phone_history(uuid), public.cleanup_orders(),
  public.menu_items(), public.my_branch(), public.item_unavailable(text, text), public.ordering_open()
  from public, anon, authenticated;
grant execute on function public.create_order(jsonb), public.get_order(text), public.ordering_open(), public.menu_items()
  to anon, authenticated;
grant execute on function public.accept_order(uuid), public.reprint_order(uuid), public.reject_order(uuid, text, boolean),
  public.set_order_status(uuid, text, boolean), public.mark_paid(uuid, text, text),
  public.set_item_availability(text, text, text), public.pause_branch(int, text),
  public.set_phone_blocked(text, boolean, text), public.phone_history(uuid), public.my_branch()
  to authenticated;

-- ───────────── التحديث المباشر (Realtime) ─────────────
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'orders') then
      alter publication supabase_realtime add table public.orders;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'item_availability') then
      alter publication supabase_realtime add table public.item_availability;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'order_branches') then
      alter publication supabase_realtime add table public.order_branches;
    end if;
  end if;
end $$;

-- ───────────── جدولة التنظيف (كل يوم الساعة 7 الصبح بتوقيت عمّان = 4 UTC) ─────────────
do $$ begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'cleanup-orders';
  perform cron.schedule('cleanup-orders', '0 4 * * *', 'select public.cleanup_orders()');
exception when others then
  raise notice 'pg_cron مش متوفر هون: فعّله من Database → Extensions وأعد تشغيل هالجزء. (%)', sqlerrm;
end $$;
