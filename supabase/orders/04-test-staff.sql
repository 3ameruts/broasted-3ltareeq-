-- ربط حسابات الفروع (للمشروع التجريبي). اعمل الحساب أول من Authentication → Users → Add user (Auto Confirm)،
-- وبعدين غيّر الإيميل والفرع هون وشغّل. الفروع: b1 = دوار العيادات، b2 = دوار الدرة، b3 = مجمع عمّان.
insert into public.branch_staff (user_id, branch_id)
select id, 'b2' from auth.users where lower(email) = lower('durra@example.com')
on conflict (user_id) do update set branch_id = excluded.branch_id;
