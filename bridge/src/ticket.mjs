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

// look: the "ticket" part of config.json — { title, footer, textSize, paper }
export function ticketLayout(look = {}) {
  const dots = PAPER_DOTS[look.paper] ?? PAPER_DOTS[80];
  return { dots, width: Math.round(dots / (SCALE[look.textSize] ?? 1)) };
}

export function ticketSvg(o, look = {}) {
  const WIDTH = ticketLayout(look).width;
  const parts = []; let y = 0;
  const right = WIDTH - PAD;
  const text = (s, { size = 26, weight = 700, x = right, anchor = 'end', fill = '#000', font = 'Readex Pro' } = {}) =>
    `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${fill}" direction="rtl" text-anchor="${anchor}">${RLM}${esc(s)}${RLM}</text>`;
  const ltr = (s, { size = 26, x = PAD, anchor = 'start' } = {}) =>
    `<text x="${x}" y="${y}" font-family="Readex Pro" font-size="${size}" font-weight="700" direction="ltr" text-anchor="${anchor}">${esc(s)}</text>`;
  const line = (h, dashed = true) => { y += h / 2; parts.push(`<line x1="${PAD}" x2="${right}" y1="${y}" y2="${y}" stroke="#000" stroke-width="2" ${dashed ? 'stroke-dasharray="8 6"' : ''}/>`); y += h / 2; };
  const para = (s, size, opts = {}) => { for (const l of wrap(s, size, WIDTH - PAD * 2 - (opts.indent ?? 0))) { y += size * 1.35; parts.push(text(l, { size, ...opts, x: right - (opts.indent ?? 0) })); } };

  // header
  y += 8; parts.push(`<rect x="${PAD}" y="${y}" width="${WIDTH - PAD * 2}" height="62" fill="none" stroke="#000" stroke-width="4" rx="8"/>`);
  y += 46; parts.push(text(look.title || 'طلب أونلاين', { size: 40, font: 'Lalezar', weight: 400, x: WIDTH / 2, anchor: 'middle' })); y += 16;
  y += 96; parts.push(ltr('#' + o.number, { size: 96, x: WIDTH / 2, anchor: 'middle' }));
  y += 14; parts.push(`<rect x="${PAD}" y="${y}" width="${WIDTH - PAD * 2}" height="52" fill="#000" rx="6"/>`);
  y += 38; parts.push(text(o.type === 'delivery' ? 'توصيل' : 'استلام من الفرع', { size: 32, fill: '#fff', x: WIDTH / 2, anchor: 'middle' })); y += 14;
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Amman', hour: '2-digit', minute: '2-digit', hourCycle: 'h12' }).format(new Date(o.created_at));
  y += 34; parts.push(text(o.branch, { size: 24 })); parts.push(ltr(time, { size: 24 }));
  line(20);

  if (o.warn > 0) { para(`!! هالرقم إله ${o.warn} طلب مرفوض قبل، اتصل تأكد`, 24); line(16); }
  para(o.name, 30);
  y += 40; parts.push(ltr(o.phone, { size: 36, x: right, anchor: 'end' }));
  if (o.type === 'delivery' && o.address) {
    const a = o.address;
    y += 8;
    para([a.area, a.street, a.building && 'بناية ' + a.building, a.floor].filter(Boolean).join('، '), 26);
    if (a.landmark) para('قرب: ' + a.landmark, 24);
    if (o.location) para('الزبون شارك موقعه على الخريطة', 22);
  }
  line(20);

  for (const it of o.items) {
    // long names wrap before the price column, so they never run into it on narrow paper
    wrap(`${it.qty} × ${it.name}`, 28, WIDTH - PAD * 2 - 100).forEach((l, i) => {
      y += i ? 28 * 1.3 : 36; parts.push(text(l, { size: 28 }));
      if (!i) parts.push(ltr(money(it.line_total), { size: 26 }));
    });
    for (const x of it.options ?? []) para(`+ ${x.name}${x.qty > 1 ? ' ×' + x.qty : ''}`, 22, { indent: 22, weight: 400 });
    if (it.note) para(`ملاحظة: ${it.note}`, 24, { indent: 22 });
    y += 6;
  }
  line(20);
  y += 40; parts.push(text('المجموع', { size: 34 })); parts.push(ltr(money(o.subtotal) + ' JD', { size: 34 }));
  if (o.type === 'delivery') para('+ رسوم التوصيل حسب المنطقة', 22, { weight: 400 });
  y += 12;
  const pay = [`الدفع عند الاستلام: ${o.pay_method === 'cash' ? 'كاش' : 'كليك'}`];
  if (o.pay_method === 'cash' && o.change_for) pay.push(`فكّة لـ ${money(o.change_for)} د.أ`);
  if (o.pay_method === 'cliq') pay.push('تحقّق من وصول الحوالة' + (o.cliq_alias ? ` (${o.cliq_alias})` : ''));
  const boxTop = y; for (const p of pay) para(p, 26); y += 20;
  parts.push(`<rect x="${PAD}" y="${boxTop}" width="${WIDTH - PAD * 2}" height="${y - boxTop}" fill="none" stroke="#000" stroke-width="3" rx="6"/>`);
  if (o.note) { y += 6; para('ملاحظة: ' + o.note, 26); }
  if (look.footer) { y += 14; for (const l of String(look.footer).split('\n')) para(l, 24, { weight: 400 }); }
  y += 60;
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${Math.ceil(y)}" viewBox="0 0 ${WIDTH} ${Math.ceil(y)}"><rect width="100%" height="100%" fill="#fff"/>${parts.join('')}</svg>`, height: Math.ceil(y) };
}
