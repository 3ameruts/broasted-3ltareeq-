import { CheckCircle2, Store } from 'lucide-react';
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { Shot, Tablet, TB, TH, TW, Tap } from '../devices';
import { Night, Pill, ramp, useGsap, useT } from '../lib';
import { C, F } from '../theme';
import { TAB_TOP } from './Transmit';
import bt from '../../../public/ui/branch-taps.json';

// 12.5–16.5s (local 0–4). The branch screen: the camera moves in on the order (with its 8 hot + 4 regular split),
// the branch accepts, and the customer's phone gets the real «تم تأكيد طلبك» notification.
const ACCEPT = 2.0;

export const Branch: React.FC = () => {
  const t = useT();
  const ref = useGsap((tl, q) => {
    // zoom on the order lines, then back out for the accept button
    tl.fromTo(q('.cam'), { scale: 1, x: 0, y: 0 }, { scale: 1.75, x: -330, y: -40, duration: 1.1, ease: 'power3.inOut' }, .05)
      .to(q('.cam'), { scale: 1.1, x: -60, y: -60, duration: .7, ease: 'power3.inOut' }, 1.25)
      .fromTo(q('.pill'), { y: -40, opacity: 0 }, { y: 0, opacity: 1, duration: .4 }, .1)
      .to(q('.pill'), { opacity: 0, duration: .25 }, 1.6)
      .fromTo(q('.ok'), { y: -40, opacity: 0, scale: .8 }, { y: 0, opacity: 1, scale: 1, duration: .45, ease: 'back.out(2)' }, ACCEPT + .15)
      .fromTo(q('.push'), { y: 420, opacity: 0 }, { y: 0, opacity: 1, duration: .6, ease: 'back.out(1.4)' }, 2.55)
      .to(q('.all'), { opacity: 0, scale: .94, filter: 'blur(8px)', duration: .3, ease: 'power2.in' }, 4.06);
  });
  const accepted = t >= ACCEPT + .1;
  return (
    <AbsoluteFill ref={ref}>
      <Night glow={C.mustard} />
      <AbsoluteFill className="all">
        <AbsoluteFill className="cam" style={{ transformOrigin: '50% 40%' }}>
          <div style={{ position: 'absolute', left: (1080 - TW - TB * 2) / 2, top: TAB_TOP, width: TW + TB * 2, height: TH + TB * 2 }}>
            <Tablet glow={accepted ? 0 : .5}>
              <Shot src={accepted ? 'ui/branch-accepted.png' : 'ui/branch-new.png'} />
              <Tap t={t} at={ACCEPT} x={bt.accept.x * TW} y={bt.accept.y * TH} />
            </Tablet>
          </div>
        </AbsoluteFill>
        <div className="pill" style={{ position: 'absolute', top: 262, width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Pill dark><Store size={40} color={C.mustard} /> الفرع بيشوف طلبك بالتفصيل</Pill>
        </div>
        <div className="ok" style={{ position: 'absolute', top: 262, width: '100%', display: 'flex', justifyContent: 'center', opacity: 0 }}>
          <Pill style={{ background: C.ok, color: '#fff', border: 'none' }}><CheckCircle2 size={40} /> تم قبول الطلب</Pill>
        </div>
        {/* the customer's phone: the real push text */}
        <div className="push" style={{ position: 'absolute', left: 60, right: 60, top: 1180, opacity: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '26px 30px', borderRadius: 42, background: 'linear-gradient(160deg, rgba(255,255,255,.97), rgba(251,245,234,.94))', boxShadow: '0 40px 90px rgba(0,0,0,.5)' }}>
            <div style={{ width: 96, height: 96, borderRadius: 24, background: '#fff', display: 'grid', placeItems: 'center', flex: 'none', boxShadow: '0 0 0 2px #eee' }}><Img src={staticFile('logo-sm.png')} style={{ width: 84 }} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#777', font: `600 28px ${F.body}` }}><span>بروستد عالطريق</span><span>الآن</span></div>
              <div style={{ color: C.ink, font: `900 42px ${F.head}` }}>تم تأكيد طلبك <span style={{ font: `900 40px ${F.num}` }}>#77</span> ✅</div>
              <div style={{ color: '#555', font: `500 32px ${F.body}` }}>طلبك عم يتحضّر بفرع دوار العيادات.</div>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
