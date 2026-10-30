-- بروستد عالطريق: تقييم الطلب من الزبون (نجوم من 1 لـ 5 وتعليق اختياري). بيعتمد على 02. آمن تشغّله أكثر من مرة.
-- التقييم بيضل حتى بعد ما ينحذف الطلب القديم (ما فيه اسم ولا رقم الزبون)، عشان تشوف تقييم كل فرع على المدى الطويل.

create table if not exists public.order_ratings (
  order_id uuid primary key,
  branch_id text not null references public.order_branches (id),
  order_number int not null,
  business_date date not null,
  order_type text not null,
  stars int not null check (stars between 1 and 5),
  comment text check (char_length(comment) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists order_ratings_branch on public.order_ratings (branch_id, created_at desc);
alter table public.order_ratings enable row level security;
revoke all on public.order_ratings from anon, authenticated;
grant select on public.order_ratings to authenticated;
drop policy if exists "admins and agents see ratings" on public.order_ratings;
create policy "admins and agents see ratings" on public.order_ratings for select to authenticated
  using (public.is_admin() or public.is_agent());

-- الزبون بيقيّم من صفحة التتبّع: بس طلب انأكّد، وخلال 3 أيام. بيقدر يغيّر تقييمه بنفس الفترة.
create or replace function public.rate_order(p_token text, p_stars int, p_comment text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare o public.orders;
begin
  select * into o from public.orders where tracking_token = p_token and length(p_token) = 32;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if o.status not in ('accepted', 'ready', 'delivered') then return jsonb_build_object('ok', false, 'error', 'not_yet'); end if;
  if o.created_at < now() - interval '3 days' then return jsonb_build_object('ok', false, 'error', 'too_late'); end if;
  if p_stars is null or p_stars not between 1 and 5 then return jsonb_build_object('ok', false, 'error', 'bad_stars'); end if;
  insert into public.order_ratings (order_id, branch_id, order_number, business_date, order_type, stars, comment)
  values (o.id, o.branch_id, o.number, o.business_date, o.type, p_stars, left(nullif(btrim(p_comment), ''), 300))
  on conflict (order_id) do update set stars = excluded.stars, comment = excluded.comment, created_at = now();
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.my_rating(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('stars', r.stars, 'comment', r.comment)
  from public.orders o join public.order_ratings r on r.order_id = o.id
  where o.tracking_token = p_token and length(p_token) = 32;
$$;

-- لوحة التحكم: معدّل كل فرع خلال آخر p_days يوم
create or replace function public.admin_rating_summary(p_days int default 30)
returns table (branch_id text, branch text, ratings int, average numeric, five int, low int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  return query
  select b.id, b.name, count(r.*)::int, round(avg(r.stars), 2),
         (count(*) filter (where r.stars = 5))::int, (count(*) filter (where r.stars <= 2))::int
  from public.order_branches b
  left join public.order_ratings r on r.branch_id = b.id and r.created_at > now() - make_interval(days => greatest(1, least(p_days, 365)))
  group by b.id, b.name order by b.id;
end $$;

revoke execute on function public.rate_order(text, int, text), public.my_rating(text), public.admin_rating_summary(int) from public;
grant execute on function public.rate_order(text, int, text), public.my_rating(text) to anon, authenticated;
grant execute on function public.admin_rating_summary(int) to authenticated;

select b.name as "الفرع", count(r.*) as "عدد التقييمات"
from public.order_branches b left join public.order_ratings r on r.branch_id = b.id
group by b.id, b.name order by b.id;
