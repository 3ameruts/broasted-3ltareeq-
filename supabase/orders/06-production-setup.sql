-- بروستد عالطريق: تجهيز الطلب الأونلاين على المشروع الحقيقي.
-- الترتيب على المشروع الحقيقي: 02-orders.sql ثم 05-printer.sql ثم هالملف. (لا تشغّل 01 ولا 03 ولا 04 هون.)
-- الطلب الأونلاين بيضل مطفي لحد ما تشغّله بآخر سطر بهالملف، أو من هون بعدين.

-- الفروع (نفس أرقام الفروع بلوحة التحكم)
insert into public.order_branches (id, code, name) values
  ('b1', 'عيادات', 'فرع دوار العيادات'),
  ('b2', 'درة', 'فرع دوار الدرة'),
  ('b3', 'مجمع', 'فرع مجمع عمّان')
on conflict (id) do update set code = excluded.code, name = excluded.name;

-- شريحة الجبنة: الصنف اللي اسمه فيه «شريحة جبنة» بالأصناف الجانبية بلوحة التحكم
update public.order_settings set
  enabled = false,
  cheese_item_id = (select item_id from public.menu_items() where category_id = 'sides' and name like '%شريحة جبنة%' limit 1)
where id = 1;

-- رموز الطابعات (إذا ما انعملت بـ 05)
do $$ declare b record; begin
  for b in select id from public.order_branches loop
    if not exists (select 1 from public.printer_tokens where branch_id = b.id) then perform public.new_printer_token(b.id); end if;
  end loop;
end $$;

-- تأكيد: لازم يطلع cheese_item_id مش فاضي، و enabled = false
select enabled, open_time, last_order_time, cheese_item_id from public.order_settings;
select b.name as "الفرع", t.token as "رمز الطابعة (سرّي)" from public.printer_tokens t join public.order_branches b on b.id = t.branch_id order by b.id;

-- لما تكون جاهز للتجربة الحقيقية شغّل هالسطر لحاله:
-- update public.order_settings set enabled = true where id = 1;
-- ولإيقاف الطلب الأونلاين بأي وقت:
-- update public.order_settings set enabled = false where id = 1;
