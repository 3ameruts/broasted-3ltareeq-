-- بروستد عالطريق: إشعارات على موبايل الزبون لما يتم تأكيد طلبه أو يجهز أو يتم إلغاؤه. بيعتمد على 02. آمن تشغّله أكثر من مرة.
-- الزبون بيكبس «فعّل الإشعارات» بصفحة التتبّع. لما تتغيّر حالة الطلب، قاعدة البيانات بتبعت للدالة order-push (Edge Function)
-- وهي بتبعت الإشعار. المفاتيح السرية بـ Edge Function Secrets وبـ Vault، مش بالجداول.

do $$ begin create extension if not exists pg_net;
exception when others then raise notice 'فعّل pg_net من Database → Extensions وأعد تشغيل الملف. (%)', sqlerrm;
end $$;

-- المفتاح العام للإشعارات (مش سري، المتصفح بيحتاجه)
alter table public.order_settings add column if not exists push_public_key text check (push_public_key ~ '^[A-Za-z0-9_-]{80,100}$');

create table if not exists public.push_config (
  id int primary key default 1 check (id = 1),
  function_url text check (function_url ~ '^https://[a-z0-9.-]+/functions/v1/[a-z0-9_-]+$')
);
insert into public.push_config (id) values (1) on conflict (id) do nothing;
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;
grant select, update on public.push_config to authenticated;
drop policy if exists "admins push config" on public.push_config;
create policy "admins push config" on public.push_config for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.push_subscriptions (
  id bigserial primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  endpoint text not null check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now(),
  unique (order_id, endpoint)
);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

-- الزبون (برابط التتبّع) بيسجّل موبايله لإشعارات هالطلب
create or replace function public.push_subscribe(p_token text, p_sub jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where tracking_token = p_token and length(p_token) = 32;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if (select count(*) from public.push_subscriptions where order_id = o.id) >= 5 then return jsonb_build_object('ok', false, 'error', 'too_many'); end if;
  begin
    insert into public.push_subscriptions (order_id, endpoint, p256dh, auth)
    values (o.id, p_sub->>'endpoint', p_sub->'keys'->>'p256dh', p_sub->'keys'->>'auth')
    on conflict (order_id, endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth;
  exception when others then return jsonb_build_object('ok', false, 'error', 'bad_subscription');
  end;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.push_subscribe(text, jsonb) from public;
grant execute on function public.push_subscribe(text, jsonb) to anon, authenticated;

-- لما تتغيّر الحالة: بنبعت الإشعار (إذا الزبون مفعّله والإعداد كامل). أي خطأ هون ما بيوقف تحديث الطلب.
create or replace function public.notify_order_push()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text; v_subs jsonb; v_title text; v_body text; v_branch text;
begin
  if new.status is not distinct from old.status or new.status not in ('accepted', 'ready', 'rejected') then return new; end if;
  select jsonb_agg(jsonb_build_object('endpoint', endpoint, 'keys', jsonb_build_object('p256dh', p256dh, 'auth', auth)))
    into v_subs from public.push_subscriptions where order_id = new.id;
  if v_subs is null then return new; end if;
  begin
    select function_url into v_url from public.push_config where id = 1;
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_hook_secret' limit 1;
    if v_url is null or v_secret is null then return new; end if;
    select name into v_branch from public.order_branches where id = new.branch_id;
    v_title := case new.status
      when 'accepted' then 'تم تأكيد طلبك #' || new.number || ' ✅'
      when 'ready' then case when new.type = 'delivery' then 'طلبك #' || new.number || ' طلع إلك 🛵' else 'طلبك #' || new.number || ' جاهز للاستلام 🍗' end
      else 'تم إلغاء طلبك #' || new.number end;
    v_body := case new.status
      when 'accepted' then 'طلبك عم يتحضّر بـ' || coalesce(v_branch, 'الفرع') || '.'
      when 'ready' then case when new.type = 'delivery' then 'السائق بالطريق.' else 'تفضّل استلمه من ' || coalesce(v_branch, 'الفرع') || '.' end
      else coalesce(new.reject_reason, 'تواصل معنا لأي استفسار.') end;
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-hook-secret', v_secret),
      body := jsonb_build_object('subscriptions', v_subs, 'title', v_title, 'body', v_body, 'url', '/order/?t=' || new.tracking_token, 'tag', new.id::text));
  exception when others then
    raise warning 'push not sent: %', sqlerrm;
  end;
  return new;
end $$;
revoke execute on function public.notify_order_push() from public, anon, authenticated;
drop trigger if exists order_push on public.orders;
create trigger order_push after update of status on public.orders
  for each row execute function public.notify_order_push();

-- لوحة التحكم: كل إشي جاهز؟ (بيرجّع نعم/لا بس، مش المفاتيح)
create or replace function public.push_ready()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  return jsonb_build_object(
    'public_key', (select push_public_key is not null from public.order_settings where id = 1),
    'function_url', (select function_url from public.push_config where id = 1),
    'hook_secret', exists (select 1 from vault.decrypted_secrets where name = 'push_hook_secret' and coalesce(decrypted_secret, '') <> ''),
    'subscribers', (select count(*) from public.push_subscriptions));
end $$;
revoke execute on function public.push_ready() from public, anon;
grant execute on function public.push_ready() to authenticated;

select push_public_key is not null as "المفتاح العام", (select function_url from public.push_config) as "رابط الدالة",
  exists (select 1 from vault.secrets where name = 'push_hook_secret') as "سر الربط بـ Vault"
from public.order_settings where id = 1;
