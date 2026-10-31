import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { db } from '../data';
import { Button } from '../ui/button';

// «فعّل الإشعارات»: a notification on the phone when the order is confirmed, ready or cancelled
const KEY = 'broasted-push-orders-v1';
const done = (t: string) => { try { return (JSON.parse(localStorage.getItem(KEY) || '[]') as string[]).includes(t); } catch { return false; } };
const remember = (t: string) => { try { localStorage.setItem(KEY, JSON.stringify([t, ...(JSON.parse(localStorage.getItem(KEY) || '[]') as string[])].slice(0, 20))); } catch { /* optional */ } };
const b64 = (s: string) => { const p = (s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'); return Uint8Array.from(atob(p), c => c.charCodeAt(0)); };
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const iosBrowser = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !matchMedia('(display-mode: standalone)').matches;

export function PushCard({ token }: { token: string }) {
  const [key, setKey] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'on' | 'denied' | 'error'>(() => (done(token) ? 'on' : 'idle'));
  useEffect(() => { db.from('order_settings').select('push_public_key').eq('id', 1).single().then(({ data }) => setKey((data?.push_public_key as string) ?? null)); }, []);
  if (!key) return null;
  if (state === 'on') return <p className="rounded-2xl bg-white px-4 py-3 text-sm font-bold shadow-[0_0_0_2px_var(--color-line)]">🔔 الإشعارات شغّالة لهالطلب، بنبعتلك لما يتم تأكيده ولما يجهز.</p>;
  if (!supported()) {
    if (!iosBrowser()) return null;
    return <p className="rounded-2xl bg-white px-4 py-3 text-sm shadow-[0_0_0_2px_var(--color-line)]">🔔 بدك يوصلك إشعار لما يتم تأكيد طلبك؟ على الآيفون: ضيف الموقع للشاشة الرئيسية (زر المشاركة ثم «إضافة إلى الشاشة الرئيسية») وافتحه من هناك.</p>;
  }
  const enable = async () => {
    setState('busy');
    try {
      if ((await Notification.requestPermission()) !== 'granted') return setState('denied');
      const reg = await navigator.serviceWorker.register('/order/sw.js', { scope: '/order/' });
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
      const { data, error } = await db.rpc('push_subscribe', { p_token: token, p_sub: sub.toJSON() });
      if (error || !(data as { ok: boolean }).ok) return setState('error');
      remember(token); setState('on');
    } catch { setState('error'); }
  };
  return (
    <div className="flex flex-col gap-2 rounded-3xl bg-white p-4 shadow-[0_0_0_2px_var(--color-mustard)]">
      <p className="flex items-center gap-2 font-bold"><BellRing size={20} className="text-brand-deep" /> بدك نبعتلك إشعار لما يتم تأكيد طلبك ويجهز؟</p>
      {state === 'denied' && <p className="text-sm text-brand-deep">الإشعارات مسكّرة بالمتصفح. فعّلها من إعدادات الموقع وجرّب.</p>}
      {state === 'error' && <p className="text-sm text-brand-deep">ما زبط، جرّب مرة ثانية.</p>}
      <Button onClick={enable} disabled={state === 'busy'}>{state === 'busy' ? 'لحظة…' : 'فعّل الإشعارات'}</Button>
    </div>
  );
}
