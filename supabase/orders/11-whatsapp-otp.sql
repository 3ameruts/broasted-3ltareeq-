-- بروستد عالطريق: تأكيد رقم الزبون بكود على الواتساب. بيعتمد على 02 و 10. آمن تشغّله أكثر من مرة.
-- ملاحظة: ملف 13 بيعيد تعريف create_order (مع مناطق التوصيل). إذا شغّلت هالملف من جديد، شغّل 13 بعده.
-- أول طلب من رقم على جهاز جديد: بيوصل الزبون كود من 6 أرقام على الواتساب، بيكتبه بالموقع، والجهاز بيتذكّر الرقم.
-- الإرسال من قاعدة البيانات نفسها (pg_net) لـ WhatsApp Cloud API. مفتاح Meta محفوظ بـ Vault باسم whatsapp_token، مش بالجداول.
-- التشغيل: لوحة التحكم ← «تأكيد الرقم بالواتساب». لحد ما تشغّله، الطلب بيمشي زي قبل.

do $$ begin create extension if not exists pg_net;
exception when others then raise notice 'فعّل pg_net من Database → Extensions وأعد تشغيل الملف. (%)', sqlerrm;
end $$;

alter table public.order_settings add column if not exists require_otp boolean not null default false;

-- إعدادات الواتساب (للمدير بس). المفتاح السري مش هون.
create table if not exists public.whatsapp_config (
  id int primary key default 1 check (id = 1),
  phone_number_id text check (phone_number_id ~ '^[0-9]{6,20}$'),
  template text not null default 'otp_code' check (template ~ '^[a-z0-9_]{1,60}$'),
  template_lang text not null default 'ar' check (template_lang ~ '^[a-z]{2}(_[A-Z]{2})?$'),
  hourly_cap int not null default 300 check (hourly_cap between 10 and 5000)  -- سقف الأكواد بالساعة (حماية من الفواتير)
);
insert into public.whatsapp_config (id) values (1) on conflict (id) do nothing;
-- تجربة بدون ما يتأثر الزباين: لحد ما تشغّل التأكيد للكل، بيشتغل بس على هالأرقام
alter table public.whatsapp_config add column if not exists test_phones text[] not null default '{}';
alter table public.whatsapp_config enable row level security;
revoke all on public.whatsapp_config from anon, authenticated;
grant select, update on public.whatsapp_config to authenticated;
drop policy if exists "admins read whatsapp" on public.whatsapp_config;
create policy "admins read whatsapp" on public.whatsapp_config for select to authenticated using (public.is_admin());
drop policy if exists "admins edit whatsapp" on public.whatsapp_config;
create policy "admins edit whatsapp" on public.whatsapp_config for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- الكود المبعوث لكل رقم (مخزّن مشفّر)، والأجهزة المأكّدة
create table if not exists public.otp_requests (
  phone text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  sent_at timestamptz not null default now(),
  sends int not null default 1,
  window_start timestamptz not null default now()
);
create table if not exists public.phone_devices (
  token_hash text primary key,
  phone text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);
create index if not exists phone_devices_phone on public.phone_devices (phone);
create table if not exists public.otp_log (sent_at timestamptz not null default now());
create index if not exists otp_log_sent on public.otp_log (sent_at);
alter table public.otp_requests enable row level security;
alter table public.phone_devices enable row level security;
alter table public.otp_log enable row level security;
revoke all on public.otp_requests, public.phone_devices, public.otp_log from anon, authenticated;

create or replace function public.otp_hash(p_phone text, p_value text)
returns text language sql immutable as $$
  select encode(sha256(convert_to(p_phone || ':' || p_value, 'UTF8')), 'hex');
$$;

-- إرسال كود: دقيقة بين كل إرسال، 5 بالساعة لنفس الرقم، وسقف عام بالساعة
create or replace function public.otp_send(p_phone text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_phone text := public.normalize_phone(p_phone);
  c public.whatsapp_config; r public.otp_requests; v_token text; v_code text;
begin
  if v_phone is null then return jsonb_build_object('ok', false, 'error', 'bad_phone'); end if;
  if exists (select 1 from public.blocked_phones where phone = v_phone) then return jsonb_build_object('ok', false, 'error', 'blocked'); end if;
  select * into c from public.whatsapp_config where id = 1;
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'whatsapp_token' limit 1;
  if c.phone_number_id is null or v_token is null then return jsonb_build_object('ok', false, 'error', 'not_configured'); end if;

  select * into r from public.otp_requests where phone = v_phone for update;
  if found then
    if r.sent_at > now() - interval '60 seconds' then
      return jsonb_build_object('ok', false, 'error', 'wait', 'seconds', 60 - floor(extract(epoch from now() - r.sent_at))::int);
    end if;
    if r.window_start > now() - interval '1 hour' and r.sends >= 5 then return jsonb_build_object('ok', false, 'error', 'too_many'); end if;
  end if;
  if (select count(*) from public.otp_log where sent_at > now() - interval '1 hour') >= c.hourly_cap then
    return jsonb_build_object('ok', false, 'error', 'busy');
  end if;

  v_code := lpad(((('x' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 7))::bit(28)::int) % 1000000)::text, 6, '0');
  insert into public.otp_requests (phone, code_hash, expires_at, attempts, sent_at, sends, window_start)
  values (v_phone, public.otp_hash(v_phone, v_code), now() + interval '10 minutes', 0, now(), 1, now())
  on conflict (phone) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, sent_at = now(),
    sends = case when otp_requests.window_start > now() - interval '1 hour' then otp_requests.sends + 1 else 1 end,
    window_start = case when otp_requests.window_start > now() - interval '1 hour' then otp_requests.window_start else now() end;
  insert into public.otp_log default values;

  -- قالب «كود تأكيد» من Meta: الكود بالنص وبزر النسخ
  perform net.http_post(
    url := 'https://graph.facebook.com/v21.0/' || c.phone_number_id || '/messages',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_token, 'Content-Type', 'application/json'),
    body := jsonb_build_object('messaging_product', 'whatsapp', 'to', '962' || substr(v_phone, 2), 'type', 'template',
      'template', jsonb_build_object('name', c.template, 'language', jsonb_build_object('code', c.template_lang),
        'components', jsonb_build_array(
          jsonb_build_object('type', 'body', 'parameters', jsonb_build_array(jsonb_build_object('type', 'text', 'text', v_code))),
          jsonb_build_object('type', 'button', 'sub_type', 'url', 'index', '0', 'parameters', jsonb_build_array(jsonb_build_object('type', 'text', 'text', v_code)))))));
  return jsonb_build_object('ok', true);
end $$;

-- فحص الكود: 5 محاولات، صالح 10 دقايق. بيرجّع رمز جهاز بيتخزّن بالمتصفح.
create or replace function public.otp_verify(p_phone text, p_code text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_phone text := public.normalize_phone(p_phone); r public.otp_requests; v_device text;
begin
  if v_phone is null then return jsonb_build_object('ok', false, 'error', 'bad_phone'); end if;
  select * into r from public.otp_requests where phone = v_phone for update;
  if not found or r.expires_at < now() then return jsonb_build_object('ok', false, 'error', 'expired'); end if;
  if r.attempts >= 5 then return jsonb_build_object('ok', false, 'error', 'too_many'); end if;
  if r.code_hash <> public.otp_hash(v_phone, regexp_replace(coalesce(p_code, ''), '\D', '', 'g')) then
    update public.otp_requests set attempts = attempts + 1 where phone = v_phone;
    return jsonb_build_object('ok', false, 'error', 'wrong_code', 'left', 4 - r.attempts);
  end if;
  delete from public.otp_requests where phone = v_phone;
  v_device := replace(gen_random_uuid()::text, '-', '');
  insert into public.phone_devices (token_hash, phone) values (public.otp_hash(v_phone, v_device), v_phone);
  return jsonb_build_object('ok', true, 'device', v_device);
end $$;

-- هالجهاز مأكّد لهالرقم؟ (الموقع بيسأل قبل ما يطلب كود)
create or replace function public.otp_device_ok(p_phone text, p_device text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.phone_devices
                 where token_hash = public.otp_hash(public.normalize_phone(p_phone), coalesce(p_device, '')));
$$;

-- الطلب: نفس فحص 10 (طلب مفتوح واحد)، وإذا التأكيد شغّال لازم الجهاز يكون مأكّد للرقم
create or replace function public.create_order(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_key uuid; v_phone text := public.normalize_phone(p->>'phone'); v_hash text;
begin
  begin v_key := (p->>'idempotency_key')::uuid; exception when others then v_key := null; end;
  if v_phone is not null and exists (
    select 1 from public.orders
    where customer_phone = v_phone and status = 'new' and created_at > now() - interval '3 hours'
      and idempotency_key is distinct from v_key
  ) then
    return jsonb_build_object('ok', false, 'error', 'open_order');
  end if;
  if v_phone is not null and ((select require_otp from public.order_settings where id = 1)
       or v_phone = any (select unnest(test_phones) from public.whatsapp_config where id = 1))
     and not exists (select 1 from public.orders where idempotency_key = v_key) then
    v_hash := public.otp_hash(v_phone, coalesce(p->>'device', ''));
    if not exists (select 1 from public.phone_devices where token_hash = v_hash) then
      return jsonb_build_object('ok', false, 'error', 'verify_phone');
    end if;
    update public.phone_devices set last_used_at = now() where token_hash = v_hash;
  end if;
  return public.create_order_core(p);
end $$;

-- لوحة التحكم: المفتاح محطوط بـ Vault؟ (بيرجّع نعم/لا بس، مش المفتاح)
create or replace function public.whatsapp_ready()
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  return exists (select 1 from vault.decrypted_secrets where name = 'whatsapp_token' and coalesce(decrypted_secret, '') <> '');
end $$;
revoke execute on function public.whatsapp_ready() from public, anon;
grant execute on function public.whatsapp_ready() to authenticated;

-- تنظيف: أكواد قديمة، وأجهزة ما انستعملت 6 شهور
create or replace function public.cleanup_otp()
returns void language sql volatile security definer set search_path = public as $$
  delete from public.otp_requests where expires_at < now() - interval '1 day';
  delete from public.otp_log where sent_at < now() - interval '2 days';
  delete from public.phone_devices where last_used_at < now() - interval '180 days';
$$;

revoke execute on function public.otp_send(text), public.otp_verify(text, text), public.otp_device_ok(text, text),
  public.otp_hash(text, text), public.cleanup_otp(), public.create_order(jsonb) from public, anon, authenticated;
grant execute on function public.otp_send(text), public.otp_verify(text, text), public.otp_device_ok(text, text),
  public.create_order(jsonb) to anon, authenticated;

do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'cleanup-otp';
  perform cron.schedule('cleanup-otp', '20 4 * * *', 'select public.cleanup_otp()');
exception when others then
  raise notice 'pg_cron مش متوفر: التنظيف التلقائي للأكواد ما انجدول. (%)', sqlerrm;
end $$;

-- ───────────── التجهيز ─────────────
-- 1) مفتاح Meta (System User token): Supabase → Project Settings → Vault → Add new secret
--    الاسم: whatsapp_token   والقيمة: المفتاح. (لا تحطه بأي ملف ولا تبعته لحدا)
-- 2) لوحة التحكم ← الطلب الأونلاين: Phone number ID واسم القالب، وبعدين شغّل «تأكيد الرقم بالواتساب».
select phone_number_id, template, template_lang, hourly_cap,
  exists (select 1 from vault.secrets where name = 'whatsapp_token') as "المفتاح موجود"
from public.whatsapp_config;
