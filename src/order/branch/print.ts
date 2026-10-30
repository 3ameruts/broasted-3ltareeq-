import type { Order } from './api';
import { splitLine } from '../split';

// One place for printing. In the browser it opens the print dialog; the branch app (APK) will provide
// window.BroastedPrinter.printHtml to print straight to the device printer without a dialog.
declare global { interface Window { BroastedPrinter?: { printHtml: (html: string) => void | Promise<void> } } }

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const money = (n: number) => Number(n).toFixed(2);

export function ticketHtml(o: Order, branchName: string, opts: { copy?: boolean; cliqAlias?: string | null } = {}) {
  const a = o.address;
  const time = new Intl.DateTimeFormat('ar-JO-u-nu-latn', { timeZone: 'Asia/Amman', hour: 'numeric', minute: '2-digit' }).format(new Date(o.created_at));
  const maps = o.location ? `https://maps.google.com/?q=${o.location.lat},${o.location.lng}` : '';
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>طلب ${o.number}</title><style>
@page { size: 80mm auto; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; width: 80mm; padding: 4mm 4mm 8mm; font-family: Tahoma, Arial, sans-serif; color: #000; font-size: 13px; line-height: 1.45; }
h1 { margin: 0; font-size: 22px; text-align: center; border: 2px solid #000; padding: 4px; }
.copy { text-align: center; font-weight: 700; font-size: 16px; margin-top: 4px; }
.big { font-size: 30px; font-weight: 700; text-align: center; margin: 6px 0 0; }
.type { text-align: center; font-size: 18px; font-weight: 700; background: #000; color: #fff; padding: 3px; margin: 6px 0; }
.row { display: flex; justify-content: space-between; gap: 6px; }
hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
.item { margin: 4px 0; } .item b { font-size: 15px; } .sub { font-size: 12px; padding-right: 10px; }
.total { font-size: 18px; font-weight: 700; }
.box { border: 1px solid #000; padding: 4px; margin-top: 6px; }
.ltr { direction: ltr; unicode-bidi: isolate; }
</style></head><body>
<h1>طلب أونلاين</h1>${opts.copy ? '<div class="copy">*** نسخة ***</div>' : ''}
<p class="big">#${o.number}</p>
<div class="type">${o.type === 'delivery' ? 'توصيل' : 'استلام من الفرع'}</div>
<div class="row"><span>${esc(branchName)}</span><span>${esc(time)}</span></div>
<hr>
<div><b>${esc(o.customer_name)}</b></div>
<div class="ltr" style="text-align:right;font-size:16px;font-weight:700">${esc(o.customer_phone)}</div>
${o.type === 'delivery' && a ? `<div class="box">${esc([a.area, a.street, a.building && 'بناية ' + a.building, a.floor].filter(Boolean).join('، '))}${a.landmark ? '<br>قرب: ' + esc(a.landmark) : ''}${maps ? '<br><span class="ltr" style="font-size:10px">' + esc(maps) + '</span>' : ''}</div>` : ''}
<hr>
${o.order_items.map(i => { const { base, extras } = splitLine(i.line_total, i.qty, i.options); return `<div class="item"><div class="row"><b>${i.qty} × ${esc(i.name)}</b><span>${money(base)}</span></div>${extras.map(x => `<div class="row sub"><span>+ ${esc(x.name)}${x.qty > 1 ? ' ×' + x.qty : ''}</span><span>${money(x.total)}</span></div>`).join('')}${i.note ? `<div class="sub">ملاحظة: ${esc(i.note)}</div>` : ''}</div>`; }).join('')}
<hr>
${o.type === 'delivery' && o.delivery_fee != null ? `<div class="row"><span>التوصيل${o.delivery_zone ? ' (' + esc(o.delivery_zone) + ')' : ''}</span><span>${money(o.delivery_fee)}</span></div>` : ''}
<div class="row total"><span>المجموع</span><span>${money(Number(o.subtotal) + Number(o.delivery_fee ?? 0))} د.أ</span></div>
${o.type === 'delivery' && o.delivery_fee == null ? '<div>+ التوصيل بالاتصال</div>' : ''}
<div class="box"><b>الدفع عند الاستلام: ${o.pay_method === 'cash' ? 'كاش' : 'كليك'}</b>${o.pay_method === 'cash' && o.change_for ? `<br>فكّة لـ ${money(o.change_for)} د.أ` : ''}${o.pay_method === 'cliq' ? '<br>تحقّق من وصول الحوالة' + (opts.cliqAlias ? '<br>Alias: <span class="ltr">' + esc(opts.cliqAlias) + '</span>' : '') : ''}</div>
${o.note ? `<div class="box">ملاحظة: ${esc(o.note)}</div>` : ''}
</body></html>`;
}

export async function printTicket(html: string) {
  if (window.BroastedPrinter?.printHtml) return window.BroastedPrinter.printHtml(html);
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0';
  document.body.appendChild(f);
  const doc = f.contentDocument!;
  doc.open(); doc.write(html); doc.close();
  await new Promise(r => setTimeout(r, 250));
  f.contentWindow!.focus(); f.contentWindow!.print();
  setTimeout(() => f.remove(), 60000);
}
