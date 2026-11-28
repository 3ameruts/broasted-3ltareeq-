import { Globe } from 'lucide-react';
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { backOut, Confetti, Mascot } from '../fx';
import { expoOut, punch, ramp, RedWorld, Sheen } from '../lib';
import { b, C, F } from '../theme';
import { Rays } from './Open';

// the final card, in the first video's spirit: logo (+ «جديد»), «اطلب أونلاين هلأ!», the link, cash or CliQ on delivery,
// the three branches popping in one by one, and the mascot waving goodbye
export const END0 = b(59);
export const BRANCHES = ['دوار العيادات', 'دوار الدرة', 'مجمع عمّان'];
export const EC = { badge: END0 + .55, cta: b(59.5), url: b(60.5), pay: b(61.5), label: b(62.5), pills: [b(63), b(63.5), b(64)] };

export const EndCard: React.FC<{ t: number }> = ({ t }) => {
  const logo = backOut(ramp(t, END0, END0 + .5), 2.2), badge = backOut(ramp(t, EC.badge, EC.badge + .35), 3);
  const pop = (at: number, s = 2) => backOut(ramp(t, at, at + .4), s);
  const cta = pop(EC.cta), url = pop(EC.url, 1.8), pay = pop(EC.pay), label = expoOut(ramp(t, EC.label, EC.label + .35));
  return (
    <AbsoluteFill>
      <RedWorld t={t} />
      <Rays t={t - 30} />
      <Confetti t={t} at={END0} x={540} y={-80} spread={2.6} power={.3} seed="e" n={50} up={1} />
      <Confetti t={t} at={END0} x={60} y={1950} spread={.6} power={1.1} seed="el" n={40} />
      <Confetti t={t} at={END0} x={1020} y={1950} spread={.6} power={1.1} seed="er" n={40} />
      <div style={{ position: 'absolute', left: 220, top: 250 + Math.sin(t * 1.5) * 6, width: 640, transform: `scale(${logo * punch(t, [EC.cta], .03)}) rotate(${(1 - Math.min(logo, 1)) * -12}deg)` }}>
        <div style={{ position: 'relative', overflow: 'hidden' }}><Img src={staticFile('logo.webp')} style={{ width: 640, filter: 'drop-shadow(0 24px 40px rgba(60,0,0,.5))' }} /><Sheen t={t} at={END0 + .45} dur={.9} /></div>
        <div style={{ position: 'absolute', right: -40, top: -36, padding: '0 28px 8px', borderRadius: 28, background: C.mustard, color: C.redDeep, font: `400 64px/1.35 ${F.fun}`, border: '6px solid #fff',
          boxShadow: '0 14px 30px rgba(60,0,0,.4)', transform: `scale(${badge}) rotate(${12 + (1 - Math.min(badge, 1)) * 30}deg)`, opacity: Math.min(1, badge * 3) }}>جديد</div>
      </div>
      <div style={{ position: 'absolute', top: 650, width: 1080, textAlign: 'center', color: '#fff', font: `400 128px/1.35 ${F.fun}`, textShadow: `0 8px 0 ${C.redDark}, 0 24px 50px rgba(60,0,0,.45)`,
        opacity: Math.min(1, cta * 2), transform: `scale(${.4 + .6 * cta})` }}>اطلب أونلاين هلأ!</div>
      <div style={{ position: 'absolute', top: 850, width: 1080, display: 'flex', justifyContent: 'center', opacity: Math.min(1, url * 2), transform: `translateY(${(1 - url) * 50}px)` }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16, padding: '18px 38px', borderRadius: 50, background: '#fff', color: C.redDeep, font: `700 46px ${F.num}`, boxShadow: '0 18px 44px rgba(60,0,0,.4)', overflow: 'hidden' }}>
          <Globe size={44} /><span style={{ direction: 'ltr' }}>order.broasted3ltareeq.com</span><Sheen t={t} at={EC.url + .5} dur={.8} />
        </div>
      </div>
      <div style={{ position: 'absolute', top: 990, width: 1080, display: 'flex', justifyContent: 'center', opacity: Math.min(1, pay * 2), transform: `scale(${.4 + .6 * pay})` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '4px 34px 10px', borderRadius: 50, background: C.mustard, color: C.redDeep, font: `400 50px/1.35 ${F.fun}`, boxShadow: `0 8px 0 ${C.brown}` }}>
          <span style={{ fontSize: 46 }}>💵</span>الدفع عند الاستلام: كاش أو كليك</div>
      </div>
      <div style={{ position: 'absolute', top: 1110, width: 1080, textAlign: 'center', color: C.cream, font: `400 56px/1.35 ${F.fun}`, opacity: label, transform: `translateY(${(1 - label) * 20}px)` }}>📍 فروعنا</div>
      <div style={{ position: 'absolute', top: 1205, width: 1080, display: 'flex', justifyContent: 'center', gap: 16 }}>
        {BRANCHES.map((n, i) => {
          const k = pop(EC.pills[i], 2.6);
          return <div key={n} style={{ padding: '2px 26px 8px', borderRadius: 40, background: '#fff', color: C.ink, font: `400 42px/1.35 ${F.fun}`, whiteSpace: 'nowrap', boxShadow: '0 12px 26px rgba(60,0,0,.3)',
            opacity: Math.min(1, k * 2), transform: `scale(${Math.max(0, k)}) rotate(${(i - 1) * 3}deg)` }}>{n}</div>;
        })}
      </div>
      <Mascot t={t} x={200} y={1560} h={300} enter={b(61)} hops={[b(62), b(64.5)]} wave bubbleSide="right" says={[{ at: b(61.5), end: b(62.7), text: 'يلا اطلب! 😋' }]} />
    </AbsoluteFill>
  );
};
