// Screenshots of the real branch screen (/order/branch/) with the demo order, on a local build (npx vite preview --port 4173).
// A fake signed-in session and canned answers (REST + realtime join) stand in for the database. Nothing reaches the real one.
// Output: ../public/ui/branch-new.png, branch-accepted.png and the accept-button position in branch-taps.json
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const OUT = path.join(__dirname, '../public/ui');
const SETTINGS = JSON.parse(fs.readFileSync(path.join(__dirname, 'settings.json'), 'utf8'));
const content = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../src/data/default-content.json'), 'utf8'));
const now = Date.now();
const order = status => ({
  id: '00000000-0000-4000-8000-000000000077', branch_id: 'b1', number: 77, business_date: new Date().toISOString().slice(0, 10), status,
  type: 'delivery', customer_name: 'أحمد', customer_phone: '0791234567',
  address: { area: 'دوار صحاري', street: 'شارع الجامعة', building: '5' }, location: null, note: null, pay_method: 'cash', change_for: null,
  subtotal: 12, delivery_fee: 1.25, delivery_zone: 'دوار صحاري', delivery_range: null, reject_reason: null,
  created_at: new Date(now - 40000).toISOString(), accepted_at: status === 'new' ? null : new Date(now).toISOString(), printed_at: null, print_count: 0,
  paid_method: null, paid_ref: null, paid_at: null,
  order_items: [
    { id: 1, item_id: 'broasted-2', name: 'وجبة 12 قطعة بروستد', qty: 1, spice: 'mixed', spice_hot: 8, spice_regular: 4, options: [], note: null, line_total: 9 },
    { id: 2, item_id: 'sandwiches-2', name: 'مايتي زنجر', qty: 1, spice: 'hot', spice_hot: null, spice_regular: null, options: [{ id: 'sauces-6', name: 'رانش', qty: 1, price: 0.25 }], note: null, line_total: 3 },
  ],
});
(async () => {
  const b = await chromium.launch(); const taps = {};
  for (const status of ['new', 'accepted']) {
    const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, locale: 'ar' });
    await ctx.addInitScript(() => {
      const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'demo@example.com', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
      localStorage.setItem('broasted-branch-auth', JSON.stringify({ access_token: 'demo', refresh_token: 'demo', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user }));
    });
    await ctx.route(/qzglmmkrnasgocuvtkut\.supabase\.co/, async route => {
      const u = route.request().url(); const j = d => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
      const one = route.request().headers()['accept']?.includes('vnd.pgrst.object');
      if (u.includes('/auth/v1/user')) return j({ id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'demo@example.com' });
      if (u.includes('/rpc/my_branch')) return j('b1');
      if (u.includes('/rpc/is_admin')) return j(false);
      if (u.includes('/rpc/phone_history')) return j({ bad: 0 });
      if (u.includes('/rpc/')) return j({ ok: true });
      if (u.includes('/order_branches')) return j(content.branches.map((x, i) => ({ id: x.id, code: ['عيادات', 'درة', 'مجمع'][i], name: x.name, accepting: true, paused_until: null })));
      if (u.includes('/orders')) return j([order(status)]);
      if (u.includes('/item_availability')) return j([]);
      if (u.includes('/site_content')) return j(one ? { content } : [{ content }]);
      if (u.includes('/order_settings')) return j(one ? SETTINGS : [SETTINGS]);
      return j([]);
    });
    // answer the realtime join like the server does, so the screen shows «متصل»
    await ctx.routeWebSocket(/supabase\.co/, ws => {
      ws.onMessage(m => {
        let x; try { x = JSON.parse(m); } catch { return; }
        const arr = Array.isArray(x); if (arr) x = { join_ref: x[0], ref: x[1], topic: x[2], event: x[3], payload: x[4] };
        const send = o => ws.send(JSON.stringify(arr ? [o.join_ref ?? null, o.ref ?? null, o.topic, o.event, o.payload] : o));
        const reply = payload => send({ topic: x.topic, event: 'phx_reply', payload, ref: x.ref, join_ref: x.join_ref });
        if (x.event === 'phx_join') {
          reply({ status: 'ok', response: { postgres_changes: (x.payload?.config?.postgres_changes || []).map((c, i) => ({ ...c, id: 1000 + i })) } });
          setTimeout(() => send({ join_ref: x.join_ref, topic: x.topic, event: 'system', payload: { channel: x.topic.replace('realtime:', ''), extension: 'postgres_changes', message: 'ok', status: 'ok' }, ref: null }), 50);
        } else reply({ status: 'ok', response: {} });
      });
    });
    const p = await ctx.newPage();
    await p.goto('http://localhost:4173/order/branch/'); await p.waitForTimeout(2500);
    const start = p.getByText('ابدأ استقبال الطلبات'); if (await start.count()) { await start.click(); await p.waitForTimeout(1800); }
    if (status === 'new') { const r = await p.getByRole('button', { name: /قبول/ }).first().boundingBox(); taps.accept = r && { x: +((r.x + r.width / 2) / 1180).toFixed(4), y: +((r.y + r.height / 2) / 820).toFixed(4) }; }
    await p.screenshot({ path: path.join(OUT, `branch-${status}.png`) });
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'branch-taps.json'), JSON.stringify(taps)); console.log(JSON.stringify(taps));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
