// Broasted 3ltareeq printer bridge: runs in the background on the cashier PC, asks the server for new
// online orders of this branch every few seconds and prints each one on the receipt printer (LAN, port 9100).
// Usage:  broasted-printer.exe            run (normally started hidden at Windows logon)
//         broasted-printer.exe --test     print a test receipt and exit
import { readFileSync, writeFileSync, appendFileSync, existsSync, statSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createServer, Socket } from 'node:net';
import { spawn } from 'node:child_process';
import { initRenderer, renderTicket } from './render.mjs';
import { rasterCommands } from './escpos.mjs';

async function main() {
  const sea = await import('node:sea').then(m => (m.isSea() ? m : null)).catch(() => null);
  const here = sea ? dirname(process.execPath) : join(dirname(new URL(import.meta.url).pathname), '..');
  const asset = (name, file) => (sea ? Buffer.from(sea.getAsset(name)) : readFileSync(join(here, file)));

  const LOG = join(here, 'broasted-printer.log');
  const log = (...a) => {
    const line = `${new Date().toISOString()} ${a.join(' ')}\n`;
    try {
      if (existsSync(LOG) && statSync(LOG).size > 2_000_000) renameSync(LOG, LOG + '.old');
      appendFileSync(LOG, line);
    } catch { /* logging is best effort */ }
    if (!sea) process.stdout.write(line);
  };
  const beep = (times = 3) => {
    if (process.platform !== 'win32') return;
    const cmd = Array.from({ length: times }, () => '[console]::beep(1200,250); Start-Sleep -m 120').join('; ');
    spawn('powershell', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', cmd], { stdio: 'ignore', windowsHide: true }).on('error', () => {});
  };

  // settings live in config.json next to the program
  const cfgPath = join(here, 'config.json');
  if (!existsSync(cfgPath)) { log('config.json مش موجود جنب البرنامج'); process.exit(1); }
  const cfg = { printerPort: 9100, pollSeconds: 3, ...JSON.parse(readFileSync(cfgPath, 'utf8').replace(/^﻿/, '')) };
  for (const k of ['branchToken', 'printerIp', 'supabaseUrl', 'supabaseKey']) if (!cfg[k]) { log(`config.json: ناقص ${k}`); process.exit(1); }

  // one copy only: a second start exits quietly
  await new Promise(resolve => {
    const lock = createServer().once('error', () => { log('البرنامج شغّال أصلاً، هالنسخة بتطلع'); process.exit(0); });
    lock.listen(45219, '127.0.0.1', resolve);
  });

  await initRenderer({ wasm: asset('resvg.wasm', 'node_modules/@resvg/resvg-wasm/index_bg.wasm'), fonts: [asset('readex.ttf', 'assets/readex-700.ttf'), asset('lalezar.ttf', 'assets/lalezar.ttf')] });

  const rpc = async (fn, body) => {
    const res = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: 'POST', headers: { apikey: cfg.supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`${fn} ${res.status}`);
    return res.json();
  };

  function sendToPrinter(bytes) {
    return new Promise((resolve, reject) => {
      const s = new Socket();
      s.setTimeout(8000, () => s.destroy(new Error('printer timeout')));
      s.once('error', reject);
      s.connect(cfg.printerPort, cfg.printerIp, () => s.end(bytes, () => setTimeout(resolve, 300)));
    });
  }
  const print = async order => { const r = await renderTicket(order); await sendToPrinter(rasterCommands(r.rgba, r.width, r.height)); };

  // orders printed on this PC; protects against printing twice if the PC stops between printing and confirming
  const LEDGER = join(here, 'printed.json');
  let printed = [];
  try { printed = JSON.parse(readFileSync(LEDGER, 'utf8')); } catch { /* first run */ }
  const remember = id => { printed = [...printed.slice(-500), id]; writeFileSync(LEDGER, JSON.stringify(printed)); };

  if (process.argv.includes('--test')) {
    await print({ number: 0, branch: 'طباعة تجربة', type: 'pickup', created_at: new Date().toISOString(), name: 'تجربة الطابعة', phone: '0790000000',
      address: null, location: null, note: 'إذا طلعت هالورقة مضبوطة، الربط شغّال', pay_method: 'cash', change_for: null, subtotal: 0, warn: 0,
      items: [{ name: 'تجربة', qty: 1, line_total: 0, options: [], note: null }] });
    log('طباعة التجربة انبعتت للطابعة');
    process.exit(0);
  }

  log(`اشتغل. الطابعة ${cfg.printerIp}:${cfg.printerPort}`);
  let failing = false; // printer_next also tells the server this PC is alive
  async function tick() {
    try {
      const r = await rpc('printer_next', { p_token: cfg.branchToken });
      if (!r.ok) { log('رمز الفرع غلط أو انلغى:', r.error); beep(2); return; }
      if (r.order) {
        const o = r.order;
        if (!printed.includes(o.id)) { await print(o); remember(o.id); log(`انطبع طلب #${o.number}`); }
        await rpc('printer_done', { p_token: cfg.branchToken, p_order: o.id });
        if (failing) { failing = false; log('رجعت الأمور طبيعية'); }
        return setTimeout(tick, 300); // more may be waiting
      }
      if (failing) { failing = false; log('رجعت الأمور طبيعية'); }
    } catch (e) {
      log('خطأ:', e.message);
      if (!failing) beep(3);
      failing = true;
    }
    setTimeout(tick, cfg.pollSeconds * 1000);
  }
  tick();
}
main();
