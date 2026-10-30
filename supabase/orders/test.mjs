// Local test of the ordering database (34 checks) on an in-memory Postgres (PGlite), with Supabase roles stubbed.
// Usage: npm i --no-save @electric-sql/pglite && node supabase/orders/test.mjs supabase/orders
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const dir = process.argv[2];
const db = new PGlite();
const r = [];
const ok = (name, cond, detail = '') => { r.push(cond); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
// Supabase stand-ins: roles, auth schema, auth.uid()/jwt() read from settings
await db.exec(`
create role anon nologin; create role authenticated nologin;
create schema auth; grant usage on schema auth to anon, authenticated;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email', current_setting('test.email', true)) $$;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated;
`);
const base = readFileSync(dir + '/01-base.sql', 'utf8').split('-- 3. الصور')[0];
await db.exec(base);
await db.exec(readFileSync(dir + '/02-orders.sql', 'utf8'));
await db.exec(readFileSync(dir + '/03-test-seed.sql', 'utf8'));
// ordering window that always includes "now" for the tests
await db.exec(`update public.order_settings set open_time = '00:00', last_order_time = '23:59:59' where id = 1;
insert into public.admins values ('boss@x.jo');
insert into auth.users values ('11111111-1111-1111-1111-111111111111','b1@x.jo'),('22222222-2222-2222-2222-222222222222','b2@x.jo'),('33333333-3333-3333-3333-333333333333','boss@x.jo');
insert into public.branch_staff values ('11111111-1111-1111-1111-111111111111','b1'),('22222222-2222-2222-2222-222222222222','b2');`);

const as = async (role, uid, email, sql, params = []) => {
  await db.exec(`reset role; select set_config('test.uid', '${uid ?? ''}', false), set_config('test.email', '${email ?? ''}', false); set role ${role};`);
  try { return { rows: (await db.query(sql, params)).rows }; } catch (e) { return { error: e.message }; } finally { await db.exec('reset role'); }
};
const anon = (sql, p) => as('anon', null, null, sql, p);
const B1 = (sql, p) => as('authenticated', '11111111-1111-1111-1111-111111111111', 'b1@x.jo', sql, p);
const B2 = (sql, p) => as('authenticated', '22222222-2222-2222-2222-222222222222', 'b2@x.jo', sql, p);
const BOSS = (sql, p) => as('authenticated', '33333333-3333-3333-3333-333333333333', 'boss@x.jo', sql, p);
const order = async (o) => (await anon('select public.create_order($1::jsonb) as r', [JSON.stringify(o)])).rows?.[0]?.r;
const key = () => crypto.randomUUID();
const base0 = { branch_id: 'b1', type: 'pickup', name: 'أحمد', phone: '+962 79 123 4567', pay_method: 'cash' };

let res = await order({ ...base0, idempotency_key: key(), items: [{ item_id: 'sandwiches-1', qty: 2, price: 0.01, options: [{ id: 'sauces-1', qty: 1 }, { id: 'sides-13' }] }] });
ok('create order (pickup) works', res?.ok && res.number === 1, JSON.stringify(res));
ok('price from server, not browser (2×(2.75+0.25+0.25)=6.50)', Number(res?.subtotal) === 6.5, `subtotal ${res?.subtotal}`);
const k = key();
const a1 = await order({ ...base0, phone: '0781111111', idempotency_key: k, items: [{ item_id: 'broasted-1', qty: 1 }] });
const a2 = await order({ ...base0, phone: '0781111111', idempotency_key: k, items: [{ item_id: 'broasted-1', qty: 1 }] });
ok('same request twice = one order', a1.ok && a2.ok && a1.token === a2.token && a2.repeat === true);
ok('tracking token is 32 random hex chars', /^[0-9a-f]{32}$/.test(a1.token));
ok('cheese not allowed on broasted meal', (await order({ ...base0, idempotency_key: key(), items: [{ item_id: 'broasted-1', qty: 1, options: [{ id: 'sides-13' }] }] })).error === 'bad_options');
ok('sauce allowed on broasted meal', (await order({ ...base0, phone: '0782222222', idempotency_key: key(), items: [{ item_id: 'broasted-1', qty: 1, options: [{ id: 'sauces-2' }] }] })).ok);
ok('unknown item rejected', (await order({ ...base0, idempotency_key: key(), items: [{ item_id: 'fake', qty: 1 }] })).error === 'bad_item');
ok('qty limits enforced', (await order({ ...base0, idempotency_key: key(), items: [{ item_id: 'broasted-1', qty: 99 }] })).error === 'bad_qty');
ok('bad phone rejected', (await order({ ...base0, phone: '12345', idempotency_key: key(), items: [{ item_id: 'broasted-1', qty: 1 }] })).error === 'bad_phone');
ok('delivery needs a written address', (await order({ ...base0, type: 'delivery', idempotency_key: key(), items: [{ item_id: 'broasted-1', qty: 1 }] })).error === 'bad_address');
const del = await order({ ...base0, phone: '0773333333', type: 'delivery', pay_method: 'cliq', idempotency_key: key(), address: { area: 'الحي الشرقي', street: 'شارع 1', building: '5' }, items: [{ item_id: 'tender-1', qty: 1 }] });
ok('delivery with manual address, no location', del.ok, JSON.stringify(del));

// rate limit: 4th order from the same phone in 10 minutes
for (let i = 0; i < 2; i++) await order({ ...base0, idempotency_key: key(), items: [{ item_id: 'broasted-1', qty: 1 }] });
ok('rate limit (3 per 10 min per phone)', (await order({ ...base0, idempotency_key: key(), items: [{ item_id: 'broasted-1', qty: 1 }] })).error === 'too_many');

// direct table access is closed
ok('anon cannot read orders', !!(await anon('select * from public.orders')).error);
ok('anon cannot insert orders directly', !!(await anon(`insert into public.orders (branch_id,business_date,number,tracking_token,idempotency_key,type,customer_name,customer_phone,pay_method,subtotal) values ('b1',current_date,99,'x',gen_random_uuid(),'pickup','x','0790000000','cash',0)`)).error);
ok('anon cannot mark paid', !!(await anon(`select public.mark_paid((select id from public.orders limit 1),'cash')`)).error);

// branch separation
const b1rows = (await B1('select id, branch_id from public.orders')).rows;
const b2rows = (await B2('select id, branch_id from public.orders')).rows;
ok('branch 1 sees only its orders', b1rows.length > 0 && b1rows.every(x => x.branch_id === 'b1'), `${b1rows.length} rows`);
ok('branch 2 sees none of branch 1', b2rows.length === 0);
const anyB1 = b1rows[0].id;
ok('branch 2 cannot accept branch 1 order', !!(await B2('select public.accept_order($1)', [anyB1])).error);
ok('branch 2 cannot read branch 1 items', (await B2('select * from public.order_items')).rows.length === 0);
ok('admin sees all', (await BOSS('select count(*)::int n from public.orders')).rows[0].n === b1rows.length);

// accept prints once
const acc1 = (await B1('select public.accept_order($1) r', [anyB1])).rows[0].r;
const acc2 = (await B1('select public.accept_order($1) r', [anyB1])).rows[0].r;
ok('first accept prints, second does not', acc1.print === true && acc2.print === false, JSON.stringify([acc1, acc2]));
const rp = (await B1('select public.reprint_order($1) r', [anyB1])).rows[0].r;
ok('reprint is marked as a copy', rp.print === true && rp.copy >= 1);
ok('paid only after staff marks it', (await B1(`select public.mark_paid($1,'cliq','محمد') r`, [anyB1])).rows[0].r.ok);

// tracking page
const t = (await anon('select public.get_order($1) r', [a1.token])).rows[0].r;
ok('tracking shows masked phone', t.phone === '078****111', t.phone);
ok('wrong token shows nothing', (await anon('select public.get_order($1) r', ['0'.repeat(32)])).rows[0].r === null);

// availability + block
await B1(`select public.set_item_availability('sandwiches-6','manual')`);
const un = await order({ ...base0, phone: '0794444444', idempotency_key: key(), items: [{ item_id: 'sandwiches-6', qty: 1 }] });
ok('unavailable item at branch 1 rejected', un.error === 'unavailable', JSON.stringify(un));
ok('same item fine at branch 2', (await order({ ...base0, branch_id: 'b2', phone: '0794444444', idempotency_key: key(), items: [{ item_id: 'sandwiches-6', qty: 1 }] })).ok);
ok('branch 2 cannot change branch 1 availability', !!(await B2(`select public.set_item_availability('sandwiches-6','on','b1')`)).error);
const victim = (await B1(`select id from public.orders where customer_phone='0773333333'`)).rows[0].id;
await B1(`select public.reject_order($1,'طلب وهمي',true)`, [victim]);
ok('blocked phone cannot order', (await order({ ...base0, phone: '0773333333', idempotency_key: key(), items: [{ item_id: 'broasted-1', qty: 1 }] })).error === 'blocked');
await BOSS(`select public.set_phone_blocked('0773333333', false)`);
ok('admin can unblock', (await order({ ...base0, phone: '0773333333', idempotency_key: key(), items: [{ item_id: 'broasted-1', qty: 1 }] })).ok);

// closed hours and pause
await db.exec(`update public.order_settings set open_time = (now() at time zone 'Asia/Amman')::time + interval '1 hour', last_order_time = (now() at time zone 'Asia/Amman')::time + interval '2 hours'`);
ok('outside ordering hours rejected', (await order({ ...base0, phone: '0795555555', idempotency_key: key(), items: [{ item_id: 'broasted-1', qty: 1 }] })).error === 'closed');
await db.exec(`update public.order_settings set open_time = '00:00', last_order_time = '23:59:59'`);
await B1('select public.pause_branch(30)');
ok('paused branch rejects orders', (await order({ ...base0, phone: '0795555555', idempotency_key: key(), items: [{ item_id: 'broasted-1', qty: 1 }] })).error === 'branch_paused');
await db.exec('select public.cleanup_orders()');
ok('cleanup runs', true);
const nums = (await BOSS(`select number from public.orders where branch_id='b1' order by number`)).rows.map(x => x.number);
ok('daily numbers are sequential without gaps', nums.every((n, i) => n === i + 1), nums.join(','));

// ── printing through the cashier PC (05-printer.sql) ──
await db.exec(readFileSync(dir + '/05-printer.sql', 'utf8'));
const tok = Object.fromEntries((await db.query(`select branch_id, token from public.printer_tokens`)).rows.map(x => [x.branch_id, x.token]));
ok('a printer token per branch', Object.keys(tok).length === 3 && Object.values(tok).every(t => t.length === 40));
const pn = async (t) => (await anon('select public.printer_next($1) r', [t])).rows[0].r;
const pd = async (t, id) => (await anon('select public.printer_done($1, $2) r', [t, id])).rows[0].r;
ok('bad token gets nothing', (await pn('x'.repeat(40))).error === 'bad_token');
await db.exec(`update public.orders set printed_at = null, print_claimed_at = null, status = 'new' where branch_id = 'b2'`);
const j1 = await pn(tok.b2);
ok('branch 2 printer gets a branch 2 order', j1.ok && j1.order && (await db.query('select branch_id from public.orders where id=$1', [j1.order.id])).rows[0].branch_id === 'b2');
ok('order arrives with items, prices and warning count', Array.isArray(j1.order.items) && j1.order.items.length > 0 && typeof j1.order.warn === 'number');
const j2 = await pn(tok.b2);
ok('a claimed order is not handed out twice', !j2.order || j2.order.id !== j1.order.id);
ok('print confirmed', (await pd(tok.b2, j1.order.id)).ok);
await pd(tok.b2, j1.order.id);
ok('confirming twice counts once', (await db.query('select print_count from public.orders where id=$1', [j1.order.id])).rows[0].print_count === 1);
ok('branch 1 printer cannot confirm branch 2 order', (await pd(tok.b1, j1.order.id)).ok === false);
await db.exec(`update public.orders set print_claimed_at = now() - interval '2 minutes' where id = '${j2.order?.id ?? j1.order.id}'`);
const j3 = await pn(tok.b2);
ok('unconfirmed claim is handed out again after a minute', !j2.order || (j3.order && j3.order.id === j2.order.id));
ok('anon cannot read printer tokens', !!(await anon('select * from public.printer_tokens')).error);
ok('branch staff cannot make tokens', !!(await B1(`select public.new_printer_token('b1')`)).error);
ok('tracking shows printed time', 'printed_at' in (await anon('select public.get_order($1) r', [a1.token])).rows[0].r);

// ── call center (09-call-center.sql) ──
await db.exec(readFileSync(dir + '/09-call-center.sql', 'utf8'));
await db.exec(`insert into auth.users values ('44444444-4444-4444-4444-444444444444','a1@x.jo'),('55555555-5555-5555-5555-555555555555','a2@x.jo');
insert into public.call_center_agents (user_id, name) values ('44444444-4444-4444-4444-444444444444','أحمد'),('55555555-5555-5555-5555-555555555555','سارة');`);
const A1 = (sql, p) => as('authenticated', '44444444-4444-4444-4444-444444444444', 'a1@x.jo', sql, p);
const A2 = (sql, p) => as('authenticated', '55555555-5555-5555-5555-555555555555', 'a2@x.jo', sql, p);
const cc = await order({ ...base0, branch_id: 'b3', phone: '0796666666', idempotency_key: key(), items: [{ item_id: 'broasted-1', qty: 1 }] });
ok('order for call center created', cc.ok, JSON.stringify(cc));
const ccId = (await BOSS(`select id from public.orders where customer_phone='0796666666'`)).rows[0].id;
ok('agent sees orders of every branch', new Set((await A1(`select branch_id from public.orders`)).rows.map(x => x.branch_id)).size === 3);
ok('agent sees order items', (await A1(`select count(*)::int n from public.order_items where order_id=$1`, [ccId])).rows[0].n === 1);
ok('branch staff still see only their branch', (await B1(`select count(*)::int n from public.orders where branch_id <> 'b1'`)).rows[0].n === 0);
ok('anon sees no orders', ((await anon(`select * from public.orders`)).rows ?? []).length === 0);
ok('agent claims an order', (await A1(`select public.cc_claim($1) r`, [ccId])).rows[0].r.ok);
const taken = (await A2(`select public.cc_claim($1) r`, [ccId])).rows[0].r;
ok('second agent sees who has it', taken.ok === false && taken.error === 'taken' && taken.name === 'أحمد', JSON.stringify(taken));
ok('second agent cannot confirm it', (await A2(`select public.cc_confirm($1,'99') r`, [ccId])).rows[0].r.error === 'taken');
ok('agents cannot release, not even the holder', (await A1(`select public.cc_release($1) r`, [ccId])).rows[0].r.error === 'not_allowed');
ok('second agent cannot cancel it', (await A2(`select public.cc_cancel($1,'x',false) r`, [ccId])).rows[0].r.error === 'taken');
ok('branch staff cannot use call center actions', !!(await B1(`select public.cc_claim($1)`, [ccId])).error);
await BOSS(`select public.cc_release($1)`, [ccId]);
ok('after the admin releases it, another agent can take it', (await A2(`select public.cc_claim($1) r`, [ccId])).rows[0].r.ok);
ok('agent confirms with POS number', (await A2(`select public.cc_confirm($1,' 12345 ') r`, [ccId])).rows[0].r.ok);
const conf = (await BOSS(`select status, pos_ref, confirmed_name, claimed_name from public.orders where id=$1`, [ccId])).rows[0];
ok('confirmed order is accepted with POS number and agent name', conf.status === 'accepted' && conf.pos_ref === '12345' && conf.confirmed_name === 'سارة', JSON.stringify(conf));
ok('confirming twice is harmless', (await A2(`select public.cc_confirm($1,'x') r`, [ccId])).rows[0].r.repeat === true);
ok('customer tracking shows it accepted', (await anon('select public.get_order($1) r', [cc.token])).rows[0].r.status === 'accepted');
await db.exec(`update public.orders set claimed_at = now() - interval '3 hours', claimed_by = '44444444-4444-4444-4444-444444444444', claimed_name = 'أحمد', status = 'new' where id = '${ccId}'`);
ok('an old claim still cannot be taken over', (await A2(`select public.cc_claim($1) r`, [ccId])).rows[0].r.error === 'taken');
ok('the holder cancels (customer changed mind)', (await A1(`select public.cc_cancel($1,'الزبون لغى الطلب',false) r`, [ccId])).rows[0].r.ok);
const cx = (await BOSS(`select status, reject_reason, confirmed_name from public.orders where id=$1`, [ccId])).rows[0];
ok('cancelled order leaves the queue with reason and agent', cx.status === 'rejected' && cx.reject_reason === 'الزبون لغى الطلب' && cx.confirmed_name === 'أحمد', JSON.stringify(cx));
await db.exec(`update public.call_center_agents set active = false where name = 'أحمد'`);
ok('inactive agent sees nothing', (await A1(`select count(*)::int n from public.orders`)).rows[0].n === 0);
await db.exec(`update public.order_settings set keep_days = 7; update public.orders set created_at = now() - interval '8 days' where id = '${ccId}'`);
await db.exec('select public.cleanup_orders()');
ok('cleanup follows keep_days', (await db.query(`select count(*)::int n from public.orders where id = $1`, [ccId])).rows[0].n === 0);

// ── one open order per phone (10-one-open-order.sql) ──
await db.exec(readFileSync(dir + '/10-one-open-order.sql', 'utf8'));
await db.exec(readFileSync(dir + '/10-one-open-order.sql', 'utf8')); // running it twice is safe
const ko = key();
const op1 = await order({ ...base0, branch_id: 'b2', phone: '0797777777', idempotency_key: ko, items: [{ item_id: 'broasted-1', qty: 1 }] });
ok('first order from a phone goes through', op1.ok, JSON.stringify(op1));
ok('second order while the first is unconfirmed is stopped', (await order({ ...base0, branch_id: 'b2', phone: '0797777777', idempotency_key: key(), items: [{ item_id: 'tender-1', qty: 1 }] })).error === 'open_order');
ok('same phone written differently is still caught', (await order({ ...base0, branch_id: 'b1', phone: '+962 79 777 7777', idempotency_key: key(), items: [{ item_id: 'tender-1', qty: 1 }] })).error === 'open_order');
ok('resending the same order still returns it', (await order({ ...base0, branch_id: 'b2', phone: '0797777777', idempotency_key: ko, items: [{ item_id: 'broasted-1', qty: 1 }] })).repeat === true);
const opId = (await BOSS(`select id from public.orders where customer_phone='0797777777'`)).rows[0].id;
await A2(`select public.cc_claim($1)`, [opId]); await A2(`select public.cc_confirm($1, null)`, [opId]);
ok('after it is confirmed the customer can order again', (await order({ ...base0, branch_id: 'b2', phone: '0797777777', idempotency_key: key(), items: [{ item_id: 'tender-1', qty: 1 }] })).ok);
ok('anon cannot call the inner function directly', !!(await anon(`select public.create_order_core('{}'::jsonb)`)).error);

// ── WhatsApp code (11-whatsapp-otp.sql): pg_net, vault and cron stubbed; the stub keeps what would be sent ──
await db.exec(`create schema if not exists net; create table net.sent (body jsonb, url text);
create function net.http_post(url text, headers jsonb, body jsonb) returns bigint language sql as $$ insert into net.sent values (body, url); select 1::bigint $$;
create schema if not exists vault; create table vault.secrets (name text, secret text);
create view vault.decrypted_secrets as select name, secret as decrypted_secret from vault.secrets;`);
await db.exec(readFileSync(dir + '/11-whatsapp-otp.sql', 'utf8'));
await db.exec(readFileSync(dir + '/11-whatsapp-otp.sql', 'utf8'));
const send = async ph => (await anon('select public.otp_send($1) r', [ph])).rows[0].r;
const verify = async (ph, c) => (await anon('select public.otp_verify($1,$2) r', [ph, c])).rows[0].r;
const lastCode = async () => (await db.query(`select body->'template'->'components'->0->'parameters'->0->>'text' c, body->>'to' t from net.sent order by ctid desc limit 1`)).rows[0];
ok('not configured yet = clear error', (await send('0791010101')).error === 'not_configured');
await db.exec(`update public.whatsapp_config set phone_number_id = '123456789'; insert into vault.secrets values ('whatsapp_token', 'secret-token');
update public.order_settings set require_otp = true`);
const pV = { ...base0, branch_id: 'b2', phone: '0791010101', items: [{ item_id: 'broasted-1', qty: 1 }] };
ok('with verification on, an order without a verified device is stopped', (await order({ ...pV, idempotency_key: key() })).error === 'verify_phone');
ok('code is sent', (await send('0791010101')).ok);
const sent1 = await lastCode();
ok('sent to the international number with a 6-digit code', sent1.t === '962791010101' && /^[0-9]{6}$/.test(sent1.c), JSON.stringify(sent1));
ok('the code is not stored in plain text', !(await db.query(`select 1 from public.otp_requests where code_hash = $1`, [sent1.c])).rows.length);
ok('anon cannot read codes or devices', !!(await anon('select * from public.otp_requests')).error && !!(await anon('select * from public.phone_devices')).error);
ok('resend within a minute waits', (await send('0791010101')).error === 'wait');
const wrong = await verify('0791010101', sent1.c === '000000' ? '111111' : '000000');
ok('wrong code says how many tries are left', wrong.error === 'wrong_code' && wrong.left === 4, JSON.stringify(wrong));
const good = await verify('0791010101', sent1.c);
ok('right code gives a device token', good.ok && /^[0-9a-f]{32}$/.test(good.device));
ok('the same code cannot be used twice', (await verify('0791010101', sent1.c)).ok === false);
ok('device check works', (await anon('select public.otp_device_ok($1,$2) r', ['+962791010101', good.device])).rows[0].r === true);
ok('verified device can order', (await order({ ...pV, idempotency_key: key(), device: good.device })).ok);
await db.exec(`update public.orders set status = 'accepted' where customer_phone = '0791010101'`);
ok('a device token for one phone does not work for another', (await order({ ...pV, phone: '0792020202', idempotency_key: key(), device: good.device })).error === 'verify_phone');
await db.exec(`update public.otp_requests set sent_at = now() - interval '2 minutes'`);
for (let i = 0; i < 5; i++) { await db.exec(`update public.otp_requests set sent_at = now() - interval '2 minutes'`); await send('0793030303'); }
await db.exec(`update public.otp_requests set sent_at = now() - interval '2 minutes'`);
ok('5 codes per hour per phone', (await send('0793030303')).error === 'too_many');
await send('0794040404'); const c4 = (await lastCode()).c;
for (let i = 0; i < 5; i++) await verify('0794040404', c4 === '000000' ? '111111' : '000000');
ok('5 wrong tries lock the code', (await verify('0794040404', c4)).error === 'too_many');
await db.exec(`update public.whatsapp_config set hourly_cap = 10; insert into public.otp_log select now() from generate_series(1, 10)`);
ok('hourly cap protects the bill', (await send('0795050505')).error === 'busy');
await db.exec('select public.cleanup_otp()');
ok('otp cleanup runs', true);
await db.exec(`update public.order_settings set require_otp = false; update public.whatsapp_config set test_phones = '{0797070707}'`);
ok('verification off: a test phone still needs a code', (await order({ ...pV, phone: '0797070707', idempotency_key: key() })).error === 'verify_phone');
ok('verification off, ordering works as before', (await order({ ...pV, phone: '0796060606', idempotency_key: key() })).ok);

// ── admin tools (12-admin-tools.sql) ──
await db.exec(readFileSync(dir + '/12-admin-tools.sql', 'utf8'));
await db.exec(readFileSync(dir + '/12-admin-tools.sql', 'utf8'));
const hist = async () => (await db.query('select count(*)::int n from public.site_content_history')).rows[0].n;
const h0 = await hist();
ok('current content saved as the first version', h0 === 1, String(h0));
await BOSS(`update public.site_content set content = jsonb_set(content, '{brand,slogan}', '"تجربة"') where id = 1`);
ok('each save keeps a version with who saved it', (await hist()) === 2 && (await db.query('select saved_by from public.site_content_history order by id desc limit 1')).rows[0].saved_by === 'boss@x.jo');
await BOSS(`update public.site_content set updated_at = now() where id = 1`);
ok('saving without changes adds no version', (await hist()) === 2);
ok('admin sees versions', (await BOSS('select count(*)::int n from public.site_content_history')).rows[0].n === 2);
ok('others cannot see versions', (await A2('select count(*)::int n from public.site_content_history')).rows[0].n === 0 && !!(await anon('select * from public.site_content_history')).error);
await db.exec(`insert into auth.users values ('66666666-6666-6666-6666-666666666666','new.agent@x.jo')`);
ok('admin adds an agent by email', (await BOSS(`select public.admin_add_agent(' New.Agent@x.jo ', 'رنا') r`)).rows[0].r.ok);
ok('unknown email is reported', (await BOSS(`select public.admin_add_agent('nobody@x.jo', 'س') r`)).rows[0].r.error === 'no_user');
const ag = (await BOSS('select * from public.admin_agents()')).rows;
ok('agents list has emails, names and today counts', ag.some(x => x.email === 'new.agent@x.jo' && x.name === 'رنا' && typeof x.today === 'number'), JSON.stringify(ag[0]));
ok('admin stops an agent', (await BOSS(`select public.admin_update_agent('66666666-6666-6666-6666-666666666666', 'رنا', false) r`)).rows[0].r.ok
  && (await db.query(`select active from public.call_center_agents where user_id = '66666666-6666-6666-6666-666666666666'`)).rows[0].active === false);
ok('agents cannot manage agents', !!(await A2(`select public.admin_add_agent('a2@x.jo','x')`)).error && !!(await A2('select * from public.admin_agents()')).error);
await A2(`select public.cc_cancel(id, 'طلب وهمي', true) from public.orders where status = 'new' limit 1`);
const bl = (await BOSS('select * from public.admin_blocked()')).rows;
ok('blocked list shows who blocked and why', bl.length > 0 && bl.some(x => x.blocked_by === 'سارة'), JSON.stringify(bl.slice(0, 2)));
ok('agents cannot read the blocked list', !!(await A2('select * from public.admin_blocked()')).error);

// ── delivery zones (13-delivery-zones.sql) ──
await db.exec(readFileSync(dir + '/13-delivery-zones.sql', 'utf8'));
await db.exec(readFileSync(dir + '/13-delivery-zones.sql', 'utf8'));
await BOSS(`insert into public.delivery_zones (branch_id, name, aliases, fee) values ('b2', 'الحصن', '{حصن}', 1), ('b2', 'الحي الشرقي', '{}', 0.75), ('b1', 'المخيم', '{}', 0.5)`);
const zoff = await order({ ...base0, branch_id: 'b2', type: 'delivery', phone: '0798080800', idempotency_key: key(), address: { area: 'الحصن', street: 'شارع 1', building: '3' }, items: [{ item_id: 'broasted-1', qty: 1 }],
  zone_id: (await anon(`select id from public.delivery_zones where name = 'الحصن'`)).rows[0].id });
ok('zones switched off: fee by phone like before', zoff.ok && zoff.delivery_fee === undefined);
await db.exec('update public.order_settings set zones_enabled = true');
ok('admin adds zones', (await anon('select count(*)::int n from public.delivery_zones')).rows[0].n === 3);
ok('customers cannot add zones', !!(await anon(`insert into public.delivery_zones (branch_id, name, fee) values ('b1','x',1)`)).error);
const zid = (await anon(`select id from public.delivery_zones where name = 'الحصن'`)).rows[0].id;
const zoneOtherBranch = (await anon(`select id from public.delivery_zones where name = 'المخيم'`)).rows[0].id;
const dz = { ...base0, branch_id: 'b2', type: 'delivery', address: { area: 'الحصن', street: 'شارع 1', building: '3' }, items: [{ item_id: 'broasted-1', qty: 1 }] };
const zr = await order({ ...dz, phone: '0798080801', idempotency_key: key(), zone_id: zid });
ok('delivery order gets the zone fee from the database', zr.ok && Number(zr.delivery_fee) === 1, JSON.stringify(zr));
const zt = (await anon('select public.get_order($1) r', [zr.token])).rows[0].r;
ok('tracking shows the zone and fee', zt.delivery_zone === 'الحصن' && Number(zt.delivery_fee) === 1);
const zr2 = await order({ ...dz, phone: '0798080802', idempotency_key: key(), zone_id: zoneOtherBranch });
ok('a zone of another branch is ignored (fee by phone)', zr2.ok && zr2.delivery_fee === undefined);
const zr3 = await order({ ...dz, phone: '0798080803', idempotency_key: key() });
ok('no zone = fee by phone, order still goes through', zr3.ok && (await anon('select public.get_order($1) r', [zr3.token])).rows[0].r.delivery_fee === null);
const zId3 = (await BOSS(`select id from public.orders where tracking_token = $1`, [zr3.token])).rows[0].id;
ok('call center sets the fee', (await A2(`select public.cc_set_fee($1, 1.25) r`, [zId3])).rows[0].r.ok
  && Number((await anon('select public.get_order($1) r', [zr3.token])).rows[0].r.delivery_fee) === 1.25);
ok('branch staff cannot set the fee', !!(await B2(`select public.cc_set_fee($1, 0)`, [zId3])).error);
await db.exec(`update public.orders set printed_at = null, print_claimed_at = null where tracking_token = '${zr.token}'`);
let pz = null; for (let i = 0; i < 20 && !(pz && pz.number === zr.number); i++) { const x = await pn(tok.b2); if (!x.order) break; pz = x.order; await pd(tok.b2, x.order.id); }
await BOSS(`insert into public.delivery_zones (branch_id, name, fee, fee_max) values ('b2', 'حتينا', 2, 2.5)`);
const rz = (await anon(`select id from public.delivery_zones where name = 'حتينا'`)).rows[0].id;
const zr4 = await order({ ...dz, phone: '0798080804', idempotency_key: key(), zone_id: rz });
const zt4 = (await anon('select public.get_order($1) r', [zr4.token])).rows[0].r;
ok('a «from – to» area keeps the area and range, fee confirmed by phone', zr4.ok && zt4.delivery_fee === null && zt4.delivery_zone === 'حتينا' && zt4.delivery_range === '2.00 – 2.50', JSON.stringify(zt4.delivery_range));
ok('a range must go up', !!(await BOSS(`insert into public.delivery_zones (branch_id, name, fee, fee_max) values ('b2', 'x', 2, 1)`)).error);
ok('printer gets the delivery fee', pz && Number(pz.delivery_fee) === 1 && pz.delivery_zone === 'الحصن', JSON.stringify(pz && { n: pz.number, f: pz.delivery_fee }));
console.log(`\n${r.filter(Boolean).length}/${r.length} passed`);
