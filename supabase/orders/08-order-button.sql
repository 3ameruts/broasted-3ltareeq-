-- بروستد عالطريق: التحكم بزر «اطلب أونلاين» بالموقع من لوحة التحكم. آمن تشغّله أكثر من مرة.
-- الزر بيظهر بالموقع بس إذا الطلب الأونلاين شغّال (enabled) وزر الطلب مفعّل (show_button).
alter table public.order_settings add column if not exists show_button boolean not null default false;
alter table public.order_settings add column if not exists order_url text not null default '/order/'
  check (order_url ~ '^(/order/|https://[a-z0-9.-]+/[a-z0-9/_-]*)$');
select enabled, show_button, order_url from public.order_settings;
