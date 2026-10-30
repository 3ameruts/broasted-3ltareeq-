-- بروستد عالطريق: تعديل الطلب من الكول سنتر (الزبون اتصل وغيّر: شيل صنف، زيد صنف، غيّر الكمية أو الإضافات).
-- بيعتمد على 02 و 09 و 15. آمن تشغّله أكثر من مرة. الأسعار بتنحسب هون من المنيو، مش من المتصفح.

alter table public.orders add column if not exists edited_by text;
alter table public.orders add column if not exists edited_at timestamptz;

-- نفس قواعد الطلب: أصناف موجودة بالمنيو، كميات معقولة، الصوصات على كل الأصناف (إلا الصوصات والجانبية) والجبنة على السندويشات
create or replace function public.price_items(p_items jsonb, p_branch text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  s public.order_settings; line jsonb; opt jsonb; m record; om record;
  v_qty int; v_oqty int; v_opts jsonb; v_unit numeric; v_line numeric; v_note text;
  v_lines jsonb := '[]'; v_total numeric := 0; v_unavailable text[] := '{}';
begin
  select * into s from public.order_settings where id = 1;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then
    return jsonb_build_object('ok', false, 'error', 'bad_items');
  end if;
  for line in select * from jsonb_array_elements(p_items) loop
    select * into m from public.menu_items() mi where mi.item_id = line->>'item_id';
    if not found or m.price is null then return jsonb_build_object('ok', false, 'error', 'bad_item'); end if;
    begin v_qty := (line->>'qty')::int; exception when others then v_qty := null; end;
    if v_qty is null or v_qty not between 1 and 20 then return jsonb_build_object('ok', false, 'error', 'bad_qty'); end if;
    v_note := nullif(btrim(coalesce(line->>'note', '')), '');
    if char_length(coalesce(v_note, '')) > 120 then return jsonb_build_object('ok', false, 'error', 'note_too_long'); end if;
    if public.item_unavailable(p_branch, m.item_id) then v_unavailable := v_unavailable || m.name; end if;
    v_opts := '[]'; v_unit := m.price;
    if line->'options' is not null and jsonb_typeof(line->'options') = 'array' then
      if jsonb_array_length(line->'options') > 10 then return jsonb_build_object('ok', false, 'error', 'bad_options'); end if;
      for opt in select * from jsonb_array_elements(line->'options') loop
        select * into om from public.menu_items() mi where mi.item_id = opt->>'id';
        if not found or m.category_id in (s.sauce_category, 'sides')
           or not (om.category_id = s.sauce_category or (om.item_id = s.cheese_item_id and m.category_id = s.cheese_category)) then
          return jsonb_build_object('ok', false, 'error', 'bad_options');
        end if;
        begin v_oqty := coalesce((opt->>'qty')::int, 1); exception when others then v_oqty := null; end;
        if v_oqty is null or v_oqty not between 1 and 5 then return jsonb_build_object('ok', false, 'error', 'bad_options'); end if;
        if public.item_unavailable(p_branch, om.item_id) then v_unavailable := v_unavailable || om.name; end if;
        v_opts := v_opts || jsonb_build_object('id', om.item_id, 'name', om.name, 'price', om.price, 'qty', v_oqty);
        v_unit := v_unit + om.price * v_oqty;
      end loop;
    end if;
    v_line := round(v_unit * v_qty, 2);
    v_total := v_total + v_line;
    v_lines := v_lines || jsonb_build_object('item_id', m.item_id, 'name', m.name, 'unit_price', m.price,
                                             'qty', v_qty, 'options', v_opts, 'note', v_note, 'line_total', v_line);
  end loop;
  if cardinality(v_unavailable) > 0 then
    return jsonb_build_object('ok', false, 'error', 'unavailable', 'items', to_jsonb(v_unavailable));
  end if;
  return jsonb_build_object('ok', true, 'lines', v_lines, 'total', round(v_total, 2));
end $$;

-- التعديل: اللي ماسك الطلب (أو المدير)، والطلب لسا جديد أو انأكّد (مش جاهز ولا خلص)
create or replace function public.cc_edit_order(p_order uuid, p_items jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare o public.orders; r jsonb;
begin
  o := public.agent_order(p_order);
  if o.status not in ('new', 'accepted') then return jsonb_build_object('ok', false, 'error', 'bad_status', 'status', o.status); end if;
  if o.claimed_by is distinct from auth.uid() and not public.is_admin() then
    return jsonb_build_object('ok', false, 'error', 'taken', 'name', o.claimed_name);
  end if;
  r := public.price_items(p_items, o.branch_id);
  if not (r->>'ok')::boolean then return r; end if;
  delete from public.order_items where order_id = o.id;
  insert into public.order_items (order_id, item_id, name, unit_price, qty, options, note, line_total)
  select o.id, l->>'item_id', l->>'name', (l->>'unit_price')::numeric, (l->>'qty')::int, l->'options', l->>'note', (l->>'line_total')::numeric
  from jsonb_array_elements(r->'lines') l;
  update public.orders set subtotal = (r->>'total')::numeric, edited_by = public.agent_name(), edited_at = now() where id = o.id;
  return jsonb_build_object('ok', true, 'subtotal', (r->>'total')::numeric);
end $$;

revoke execute on function public.price_items(jsonb, text), public.cc_edit_order(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.cc_edit_order(uuid, jsonb) to authenticated;
