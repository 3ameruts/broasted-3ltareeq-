import { useEffect, useState } from 'react';
import { Share, X } from 'lucide-react';
import { Button } from '../ui/button';

// «ضيف للشاشة الرئيسية»: the order page installs like an app (icon on the phone, opens full screen).
// Offered to returning customers and after an order, never on the first visit; «لا شكراً» hides it for 30 days.
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as InstallEvent; listeners.forEach(f => f()); });
addEventListener('appinstalled', () => { deferred = null; listeners.forEach(f => f()); });

const HIDE = 'broasted-install-hidden-until';
const hidden = () => { try { return Number(localStorage.getItem(HIDE) || 0) > Date.now(); } catch { return false; } };
const installed = () => matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const iosSafari = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent);

export function InstallPrompt({ className = '' }: { className?: string }) {
  const [, refresh] = useState(0);
  const [closed, setClosed] = useState(hidden);
  useEffect(() => { const f = () => refresh(x => x + 1); listeners.add(f); return () => { listeners.delete(f); }; }, []);
  const ios = iosSafari();
  if (closed || installed() || (!deferred && !ios)) return null;

  const dismiss = () => {
    try { localStorage.setItem(HIDE, String(Date.now() + 30 * 86400000)); } catch { /* storage is optional */ }
    setClosed(true);
  };
  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    if (outcome !== 'accepted') dismiss(); else setClosed(true);
  };
  return (
    <div className={'relative flex items-center gap-3 rounded-2xl bg-white p-3 shadow-[0_0_0_2px_var(--color-line)] ' + className}>
      <img src="/order/icon-192.png" alt="" className="size-12 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-bold">ضيف بروستد عالطريق لشاشة موبايلك 📱</p>
        {ios
          ? <p className="text-soft">اكبس زر المشاركة <Share size={14} className="inline align-[-2px]" /> تحت، وبعدين «إضافة إلى الشاشة الرئيسية».</p>
          : <p className="text-soft">المرة الجاية بتطلب بكبسة، بدون ما تدوّر عالرابط.</p>}
      </div>
      {!ios && <Button size="sm" onClick={install}>ضيف</Button>}
      <button onClick={dismiss} className="absolute -top-2 -start-2 grid size-7 place-items-center rounded-full bg-white text-soft shadow-[0_0_0_2px_var(--color-line)]" aria-label="لا شكراً"><X size={14} /></button>
    </div>
  );
}
