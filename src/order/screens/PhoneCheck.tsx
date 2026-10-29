import { useEffect, useRef, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { rememberDevice, sendOtp, verifyOtp, type OtpResult } from '../data';
import { Sheet } from '../ui/drawer';
import { Button } from '../ui/button';
import { Input } from '../ui/field';

const SEND_ERRORS: Record<string, string> = {
  bad_phone: 'الرقم مش صحيح.',
  blocked: 'للأسف ما بنقدر نستقبل طلبك أونلاين. تواصل معنا على الرقم.',
  too_many: 'طلبت كود كثير. استنى شوي وجرّب.',
  busy: 'في ضغط هسّا، جرّب بعد دقايق.',
  not_configured: 'التأكيد بالواتساب مش متاح هسّا. تواصل معنا على الرقم.',
};

// One-time WhatsApp code: sent when the sheet opens, the customer types it, the device remembers the phone
export function PhoneCheck({ open, phone, onClose, onVerified }: { open: boolean; phone: string; onClose: () => void; onVerified: () => void }) {
  const [code, setCode] = useState('');
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const sentFor = useRef('');

  const send = async () => {
    setBusy(true); setMessage('');
    try {
      const r = await sendOtp(phone);
      if (r.ok) { setWait(60); sentFor.current = phone; }
      else if (r.error === 'wait') setWait(r.seconds ?? 60);
      else setMessage(SEND_ERRORS[r.error ?? ''] ?? 'ما زبط نبعت الكود، جرّب مرة ثانية.');
    } catch { setMessage('ما زبط نبعت الكود، تأكد من الإنترنت.'); }
    setBusy(false);
  };
  useEffect(() => { if (open) { setCode(''); if (sentFor.current !== phone) send(); } }, [open, phone]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!wait) return; const t = setTimeout(() => setWait(w => w - 1), 1000); return () => clearTimeout(t); }, [wait]);

  const check = async (value = code) => {
    if (value.length !== 6 || busy) return;
    setBusy(true); setMessage('');
    try {
      const r: OtpResult = await verifyOtp(phone, value);
      if (r.ok && r.device) { rememberDevice(phone, r.device); sentFor.current = ''; onVerified(); }
      else if (r.error === 'wrong_code') { setMessage(r.left ? `الكود غلط. ضايلك ${r.left} محاولات.` : 'الكود غلط. اطلب كود جديد.'); setCode(''); }
      else if (r.error === 'expired') setMessage('الكود انتهى. اطلب كود جديد.');
      else setMessage('محاولات كثير. اطلب كود جديد.');
    } catch { setMessage('ما زبط، تأكد من الإنترنت وجرّب.'); }
    setBusy(false);
  };

  return (
    <Sheet open={open} onOpenChange={x => !x && onClose()} title="تأكيد رقمك"
      footer={<Button size="lg" className="w-full" onClick={() => check()} disabled={busy || code.length !== 6}>{busy ? 'لحظة…' : 'تأكيد'}</Button>}>
      <div className="flex flex-col gap-4 pb-2">
        <p className="flex items-start gap-2">
          <MessageCircle size={22} className="mt-0.5 shrink-0 text-emerald-600" />
          <span>بعتنالك كود من 6 أرقام على <b>الواتساب</b> على رقم <b className="num" dir="ltr">{phone}</b>. اكتبه هون. (مرة وحدة بس على هالجهاز)</span>
        </p>
        <Input value={code} onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setCode(v); if (v.length === 6) check(v); }}
          inputMode="numeric" autoComplete="one-time-code" dir="ltr" placeholder="••••••" aria-label="كود التأكيد"
          className="num h-16 text-center text-3xl tracking-[0.5em]" autoFocus />
        {message && <p className="text-sm font-semibold text-brand-deep" role="alert">{message}</p>}
        <div className="flex items-center justify-between text-sm">
          <button className="font-bold text-soft underline" onClick={onClose}>غيّر الرقم</button>
          {wait > 0 ? <span className="text-soft">بتقدر تطلب كود جديد بعد <span className="num">{wait}</span> ث</span>
            : <button className="font-bold text-brand-deep underline disabled:opacity-50" onClick={send} disabled={busy}>ابعتلي كود جديد</button>}
        </div>
      </div>
    </Sheet>
  );
}
