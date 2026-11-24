// Screenshots of the real customer pages (/order/) for the reel, on a local build (npx vite preview --port 4173).
// Orders, codes and tracking are answered locally with a demo order; the menu and zones are read from the live site.
// Nothing is sent to the real database. Output: ../public/ui/*.png and ../public/ui/taps.json
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const OUT = path.join(__dirname, '../public/ui'); fs.mkdirSync(OUT, { recursive: true });
const SETTINGS = JSON.parse(fs.readFileSync(path.join(__dirname, 'settings.json'), 'utf8'));
const W = 390, H = 844, URL = 'http://localhost:4173/order/';
const ITEMS = [
  { name: 'وجبة 12 قطعة بروستد', qty: 1, options: [], note: null, line_total: 9, spice: 'mixed', spice_hot: 8, spice_regular: 4 },
  { name: 'مايتي زنجر', qty: 1, options: [{ name: 'رانش', qty: 1, price: 0.25 }], note: null, line_total: 3, spice: 'hot' },
];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true, locale: 'ar' });
  await ctx.route(/qzglmmkrnasgocuvtkut\.supabase\.co/, async route => {
    const u = route.request().url(); const j = d => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(d) });
    if (u.includes('order_settings')) { const v = { ...SETTINGS, enabled: true, require_otp: true, zones_enabled: true, open_time: '00:00:00', last_order_time: '23:59:59' }; return j(route.request().headers()['accept']?.includes('object') ? v : [v]); }
    if (u.includes('/rpc/otp_send')) return j({ ok: true });
    if (u.includes('/rpc/otp_verify')) { await new Promise(r => setTimeout(r, 2500)); return j({ ok: true, device: 'demo-pass' }); }
    if (u.includes('/rpc/create_order')) return j({ ok: true, token: 'e'.repeat(32), number: 77, subtotal: 12, delivery_fee: 1.25 });
    if (u.includes('/rpc/get_order')) return j({ number: 77, code: 'عيادات', branch: 'فرع دوار العيادات', status: 'accepted', type: 'delivery', name: 'أحمد', phone: '079****567', pay_method: 'cash', subtotal: 12, reject_reason: null, delivery_fee: 1.25, delivery_zone: 'دوار صحاري',
      created_at: new Date(Date.now() - 4 * 60000).toISOString(), accepted_at: new Date().toISOString(), printed_at: new Date().toISOString(), contact_phone: SETTINGS.phone, items: ITEMS });
    if (u.includes('/rpc/my_rating')) return j(null);
    if (u.includes('/rpc/push_subscribe')) return j({ ok: true });
    return route.continue();
  });
  const p = await ctx.newPage(); const taps = {};
  const box = async (name, loc) => { const r = await loc.boundingBox(); taps[name] = r && { x: +((r.x + r.width / 2) / W).toFixed(4), y: +((r.y + r.height / 2) / H).toFixed(4) }; };
  const shot = n => p.screenshot({ path: path.join(OUT, n + '.png') });
  const dlg = p.locator('[role=dialog]');

  await p.goto(URL); await p.waitForTimeout(2500);
  await p.getByText('توصيل', { exact: true }).first().click(); await p.waitForTimeout(300);
  await p.getByText('فرع دوار العيادات').click(); await p.waitForTimeout(300);
  await p.getByText('يلا نشوف المنيو').click(); await p.waitForTimeout(2000);
  await shot('01-menu');
  await p.screenshot({ path: path.join(OUT, '01-menu-full.png'), fullPage: true });
  const card = p.getByLabel('وجبة 12 قطعة بروستد، التفاصيل');
  await card.evaluate(e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(800);
  taps.scrollY = await p.evaluate(() => scrollY);
  await shot('02-menu-item'); await box('item', card);
  await card.click(); await p.waitForTimeout(1000);
  await shot('03-sheet');
  await dlg.getByText('عادي ولا حار؟').evaluate(e => e.scrollIntoView({ block: 'start' })); await p.waitForTimeout(500);
  await shot('04-sheet-spice'); await box('split', dlg.getByRole('radio', { name: 'قسّمها' }));
  await dlg.getByRole('radio', { name: 'قسّمها' }).click(); await p.waitForTimeout(600);
  await shot('05-split'); await box('add', dlg.getByRole('button', { name: /أضف للسلة/ }));
  await dlg.getByRole('button', { name: /أضف للسلة/ }).click(); await p.waitForTimeout(900);
  // a sandwich, hot, with ranch
  const zinger = p.getByLabel('مايتي زنجر، التفاصيل').first();
  await zinger.evaluate(e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(600);
  await zinger.click(); await p.waitForTimeout(900);
  await dlg.getByRole('radio', { name: /حار/ }).click(); await dlg.getByText('رانش').first().click(); await p.waitForTimeout(300);
  await dlg.getByRole('button', { name: /أضف للسلة/ }).click(); await p.waitForTimeout(1000);
  await shot('06-added'); await box('cart', p.getByText('عرض السلة'));
  await p.getByText('عرض السلة').click(); await p.waitForTimeout(900);
  await shot('07-cart'); await box('next', dlg.getByText('كمّل الطلب'));
  await dlg.getByText('كمّل الطلب').click(); await p.waitForTimeout(900);
  await p.locator('#f-area').fill('صحار'); await p.waitForTimeout(400);
  await p.getByRole('option', { name: /دوار صحاري/ }).click();
  await p.fill('#f-name', 'أحمد'); await p.fill('#f-phone', '0791234567'); await p.fill('#f-street', 'شارع الجامعة'); await p.fill('#f-building', '5');
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(400);
  await shot('08-checkout');
  const send = p.getByRole('button', { name: /تأكيد الطلب/ }); await send.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  await shot('09-confirm'); await box('confirm', send);
  await send.click(); await p.waitForTimeout(1500);
  await shot('10-code');
  const code = p.getByLabel('كود التأكيد'); await box('code', code);
  await code.fill('48291'); await p.waitForTimeout(200); await shot('11-code-typing');
  await code.fill('482913'); await p.waitForTimeout(400); await shot('12-code-done');
  await p.waitForTimeout(4500);
  await shot('13-tracking');
  fs.writeFileSync(path.join(OUT, 'taps.json'), JSON.stringify(taps, null, 1));
  console.log(JSON.stringify(taps)); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
