-- بروستد عالطريق: قبل ما ينبعت كود الواتساب، بنفحص إذا الرقم عنده طلب مفتوح. بيعتمد على 11 و 22. آمن تشغّله أكثر من مرة.
-- إذا عنده طلب لسا ما انستلم: ما بينبعت كود (ما في رسالة مدفوعة على الفاضي)، والموقع بيحكيله عن طلبه فوراً.
-- ملاحظة: هالملف بيعيد تعريف otp_send من 11. إذا رجعت شغّلت 11، أعد تشغيل هالملف بعده.

-- إرسال كود: دقيقة بين كل إرسال، 5 بالساعة لنفس الرقم، وسقف عام بالساعة، وما في كود لرقم عنده طلب مفتوح
create or replace function public.otp_send(p_phone text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_phone text := public.normalize_phone(p_phone);
  c public.whatsapp_config; r public.otp_requests; v_token text; v_code text; a public.orders;
begin
  if v_phone is null then return jsonb_build_object('ok', false, 'error', 'bad_phone'); end if;
  if exists (select 1 from public.blocked_phones where phone = v_phone) then return jsonb_build_object('ok', false, 'error', 'blocked'); end if;
  -- عنده طلب لسا ما انستلم: لا تبعت كود (ولا تدفع عليه)، احكيله عن طلبه
  a := public.active_order(v_phone, null);
  if a.id is not null then
    return jsonb_build_object('ok', false, 'error', 'open_order', 'number', a.number,
      'branch', (select name from public.order_branches where id = a.branch_id), 'status', a.status);
  end if;
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
revoke execute on function public.otp_send(text) from public;
grant execute on function public.otp_send(text) to anon, authenticated;

select 'تمام: الكود ما بينبعت لرقم عنده طلب مفتوح' as "النتيجة";
