// Draws the receipt as an SVG. Rendered to an image by resvg,
// so Arabic prints correctly on any ESC/POS printer, whatever fonts it has inside.
// Paper: 80 mm = 576 dots, 58 mm = 384 dots. A bigger text size lays out on a narrower canvas that is then stretched to the paper.
export const PAPER_DOTS = { 80: 576, 58: 384 };
const SCALE = { small: 0.9, medium: 1, large: 1.15 };
const PAD = 14;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = n => Number(n).toFixed(2);
// right-to-left marks keep numbers, '+' and commas on the correct side of Arabic lines
const RLM = '\u200F';

// rough line wrap by measured average glyph width (Readex Pro Bold)
function wrap(text, size, width) {
  const max = Math.max(8, Math.floor(width / (size * 0.56)));
  const out = []; let line = '';
  for (const w of String(text).split(/\s+/)) {
    if (!w) continue;
    if ((line + ' ' + w).trim().length > max && line) { out.push(line); line = w; } else line = (line + ' ' + w).trim();
  }
  if (line) out.push(line);
  return out.length ? out : [''];
}

// look: the "ticket" part of config.json — { title, footer, textSize, paper, badge }, plus logoImage { data (png), width, height } when a logo is on.
// Layout, top to bottom: system badge (e.g. UTS / online order), order number and type, customer, items, total and payment,
// footer line, restaurant logo.
export function ticketLayout(look = {}) {
  const dots = PAPER_DOTS[look.paper] ?? PAPER_DOTS[80];
  return { dots, width: Math.round(dots / (SCALE[look.textSize] ?? 1)) };
}

export function ticketSvg(o, look = {}) {
  const WIDTH = ticketLayout(look).width;
  const parts = []; let y = 0;
  const right = WIDTH - PAD, mid = WIDTH / 2;
  const text = (s, { size = 26, weight = 700, x = right, anchor = 'end', fill = '#000', font = 'Readex Pro' } = {}) =>
    `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${fill}" direction="rtl" text-anchor="${anchor}">${RLM}${esc(s)}${RLM}</text>`;
  const ltr = (s, { size = 26, x = PAD, anchor = 'start', font = 'Readex Pro', weight = 700, spacing = 0 } = {}) =>
    `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}" letter-spacing="${spacing}" direction="ltr" text-anchor="${anchor}">${esc(s)}</text>`;
  const rule = (x1, x2, { width = 2, dashed = false } = {}) =>
    parts.push(`<line x1="${x1}" x2="${x2}" y1="${y}" y2="${y}" stroke="#000" stroke-width="${width}" ${dashed ? 'stroke-dasharray="8 6"' : ''}/>`);
  const para = (s, size, opts = {}) => { for (const l of wrap(s, size, WIDTH - PAD * 2 - (opts.indent ?? 0))) { y += size * 1.35; parts.push(text(l, { size, ...opts, x: right - (opts.indent ?? 0) })); } };
  const gap = h => { y += h; };
  // section heading: label on the right, a line running to the left edge
  const section = label => {
    gap(44); parts.push(text(label, { size: 24 }));
    const w = label.length * 24 * 0.6 + 16; y -= 8; rule(PAD, right - w, { width: 3 }); y += 8; gap(6);
  };

  // 1) system badge: big name with a tagline between two rules
  gap(10);
  if (look.badge?.name) {
    gap(112); parts.push(ltr(look.badge.name, { size: 128, x: mid, anchor: 'middle', font: 'Inter Display', weight: 900, spacing: 6 }));
    if (look.badge.tagline) {
      const tag = String(look.badge.tagline).toUpperCase(), half = (tag.length * 26 * 0.68 + tag.length * 7) / 2 + 16;
      gap(44); parts.push(ltr(tag, { size: 26, x: mid, anchor: 'middle', font: 'Inter Display', weight: 500, spacing: 7 }));
      y -= 9; rule(PAD + 10, mid - half, { width: 3 }); rule(mid + half, right - 10, { width: 3 }); y += 9;
    }
    gap(26);
  } else if (look.title !== '') {
    gap(8); parts.push(`<rect x="${PAD}" y="${y}" width="${WIDTH - PAD * 2}" height="62" fill="none" stroke="#000" stroke-width="4" rx="8"/>`);
    gap(46); parts.push(text(look.title || 'طلب أونلاين', { size: 40, font: 'Lalezar', weight: 400, x: mid, anchor: 'middle' })); gap(22);
  }

  // 2) order number, pickup / delivery, branch and time
  gap(100); parts.push(ltr('#' + o.number, { size: 104, x: mid, anchor: 'middle' }));
  gap(18); parts.push(`<rect x="${PAD}" y="${y}" width="${WIDTH - PAD * 2}" height="56" fill="#000" rx="8"/>`);
  gap(40); parts.push(text(o.type === 'delivery' ? 'توصيل' : 'استلام من الفرع', { size: 34, fill: '#fff', x: mid, anchor: 'middle' })); gap(16);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Amman', hour: '2-digit', minute: '2-digit', hourCycle: 'h12' }).format(new Date(o.created_at));
  gap(38); parts.push(text(o.branch, { size: 24 })); parts.push(ltr(time, { size: 24 }));

  // 3) customer
  section('الزبون');
  if (o.warn > 0) { gap(6); para(`!! هالرقم إله ${o.warn} طلب مرفوض قبل، اتصل تأكد`, 24); gap(4); }
  para(o.name, 32);
  gap(44); parts.push(ltr(o.phone, { size: 38, x: right, anchor: 'end' }));
  if (o.type === 'delivery' && o.address) {
    const a = o.address;
    gap(10);
    para([a.area, a.street, a.building && 'بناية ' + a.building, a.floor].filter(Boolean).join('، '), 26);
    if (a.landmark) para('قرب: ' + a.landmark, 24, { weight: 400 });
    if (o.location) para('الزبون شارك موقعه على الخريطة', 22, { weight: 400 });
  }

  // 4) items: the item's own price, then each add-on on its own line (all times the quantity)
  section('الطلب');
  o.items.forEach((it, n) => {
    const extras = (it.options ?? []).map(x => ({ ...x, total: Math.round(Number(x.price ?? 0) * (x.qty ?? 1) * it.qty * 100) / 100 }));
    const base = Number(it.line_total) - extras.reduce((s, x) => s + x.total, 0);
    if (n) { gap(14); rule(PAD + 40, right - 40, { width: 1, dashed: true }); }
    // long names wrap before the price column, so they never run into it on narrow paper
    wrap(`${it.qty} × ${it.name}${it.spice === 'hot' ? ' · حار' : it.spice === 'regular' ? ' · عادي' : ''}`, 28, WIDTH - PAD * 2 - 100).forEach((l, i) => {
      gap(i ? 28 * 1.3 : 38); parts.push(text(l, { size: 28 }));
      if (!i) parts.push(ltr(money(base), { size: 26 }));
    });
    for (const x of extras) {
      wrap(`+ ${x.name}${x.qty > 1 ? ' ×' + x.qty : ''}`, 22, WIDTH - PAD * 2 - 122).forEach((l, i) => {
        gap(22 * 1.4); parts.push(text(l, { size: 22, weight: 400, x: right - 22 }));
        if (!i) parts.push(ltr(money(x.total), { size: 22, weight: 400 }));
      });
    }
    if (it.note) para(`ملاحظة: ${it.note}`, 24, { indent: 22 });
  });

  // 5) total and payment
  gap(26); rule(PAD, right, { width: 3 });
  const fee = o.type === 'delivery' && o.delivery_fee != null ? Number(o.delivery_fee) : null;
  if (fee !== null) { gap(38); parts.push(text(`التوصيل${o.delivery_zone ? ` (${o.delivery_zone})` : ''}`, { size: 26 })); parts.push(ltr(money(fee), { size: 26 })); }
  gap(48); parts.push(text('المجموع', { size: 36 })); parts.push(ltr(money(Number(o.subtotal) + (fee ?? 0)) + ' JD', { size: 36 }));
  if (o.type === 'delivery' && fee === null) para(o.delivery_range ? `+ التوصيل${o.delivery_zone ? ` (${o.delivery_zone})` : ''} ${o.delivery_range} (بيتم تأكيده بالاتصال)` : '+ التوصيل بالاتصال', 22, { weight: 400 });
  gap(20);
  const pay = [`الدفع عند الاستلام: ${o.pay_method === 'cash' ? 'كاش' : 'كليك'}`];
  if (o.pay_method === 'cash' && o.change_for) pay.push(`فكّة لـ ${money(o.change_for)} د.أ`);
  if (o.pay_method === 'cliq') pay.push('تحقّق من وصول الحوالة' + (o.cliq_alias ? ` (${o.cliq_alias})` : ''));
  const boxTop = y; y += 4; for (const p of pay) para(p, 26, { indent: 12 }); gap(20);
  parts.push(`<rect x="${PAD}" y="${boxTop}" width="${WIDTH - PAD * 2}" height="${y - boxTop}" fill="none" stroke="#000" stroke-width="3" rx="8"/>`);
  if (o.note) {
    gap(18); const top = y; y += 4; para('ملاحظة الزبون: ' + o.note, 26, { indent: 12 }); gap(18);
    parts.push(`<rect x="${PAD}" y="${top}" width="${WIDTH - PAD * 2}" height="${y - top}" fill="none" stroke="#000" stroke-width="2" stroke-dasharray="8 6" rx="8"/>`);
  }

  // 6) footer line and the restaurant logo
  if (look.footer) { gap(26); for (const l of String(look.footer).split('\n')) { gap(30); parts.push(text(l, { size: 24, weight: 400, x: mid, anchor: 'middle' })); } }
  if (look.logoImage) {
    const { data, width, height } = look.logoImage;
    const w = Math.round((WIDTH - PAD * 2) * 0.55), h = Math.round(w * height / width);
    gap(30); parts.push(`<image href="data:image/png;base64,${data.toString('base64')}" x="${(WIDTH - w) / 2}" y="${y}" width="${w}" height="${h}"/>`); gap(h);
  }
  gap(50);
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${Math.ceil(y)}" viewBox="0 0 ${WIDTH} ${Math.ceil(y)}"><rect width="100%" height="100%" fill="#fff"/>${parts.join('')}</svg>`, height: Math.ceil(y) };
}
