import { Bell, Send } from 'lucide-react';
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { Phone, PH, PW, Shot, Tablet, TB, TH, TW } from '../devices';
import { easeInOut, expoOut, Night, ramp, useGsap, useT } from '../lib';
import { C, F } from '../theme';

// 9.5–12.5s (local 0–3). The order leaves the phone as a light trail and lands on the branch screen: «طلب جديد!».
export const TAB_TOP = 420;
const P0 = [300, 1360], C1 = [130, 820], C2 = [980, 1180], P3 = [600, 760];
const bez = (u: number) => { const k = 1 - u; return [0, 1].map(i => k * k * k * P0[i] + 3 * k * k * u * C1[i] + 3 * k * u * u * C2[i] + u * u * u * P3[i]); };
const D = `M${P0} C${C1} ${C2} ${P3}`;
const LAUNCH = .2, HIT = 1.3;

export const Transmit: React.FC = () => {
  const t = useT();
  const ref = useGsap((tl, q) => {
    tl.set(q('.tab'), { x: 70, y: 40, scale: .62, rotateY: -24, rotateX: 10, rotateZ: 4 }, 0)
      .fromTo(q('.cam'), { scale: 1.25, x: 160, y: -260 }, { scale: 1, x: 0, y: 0, duration: 1.25, ease: 'power2.inOut' }, 0)
      .fromTo(q('.phone'), { opacity: 1 }, { opacity: .5, filter: 'blur(4px)', duration: .6 }, 1.0)
      .fromTo(q('.toast'), { y: -220, opacity: 0, scale: .85 }, { y: 0, opacity: 1, scale: 1, duration: .55, ease: 'back.out(1.7)' }, HIT + .1)
      .fromTo(q('.shock'), { scale: .2, opacity: .9 }, { scale: 4, opacity: 0, duration: .9, ease: 'power2.out' }, HIT)
      // hand over: the tablet comes square to camera for the next scene
      .to(q('.tab'), { rotateY: 0, rotateX: 0, rotateZ: 0, scale: 1, x: 0, y: 0, duration: .7, ease: 'power3.inOut' }, 2.3)
      .to(q('.phone, .trail, .toast'), { opacity: 0, duration: .3 }, 2.25);
  });
  const u = easeInOut(ramp(t, LAUNCH, HIT)), [px, py] = bez(u), live = t >= HIT;
  return (
    <AbsoluteFill ref={ref}>
      <Night />
      <AbsoluteFill className="cam" style={{ transformOrigin: '50% 55%' }}>
        <div className="phone" style={{ position: 'absolute', left: P0[0] - PW * .21, top: P0[1] - PH * .21, width: PW, height: PH, transform: 'scale(.42) rotate(-10deg)', transformOrigin: '0 0' }}>
          <Phone glow={.6}>
            <AbsoluteFill style={{ background: C.redDeep, display: 'grid', placeItems: 'center', color: '#fff', textAlign: 'center' }}>
              <div><div style={{ width: 170, height: 170, margin: '0 auto 30px', borderRadius: 85, background: '#fff', color: C.red, display: 'grid', placeItems: 'center' }}><Send size={84} /></div>
                <div style={{ font: `900 60px ${F.head}` }}>انبعت الطلب</div></div>
            </AbsoluteFill>
          </Phone>
        </div>
        <svg className="trail" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
          <defs><linearGradient id="tr" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor={C.red} /><stop offset="1" stopColor={C.mustard} /></linearGradient></defs>
          <path d={D} stroke="rgba(255,255,255,.08)" strokeWidth={6} fill="none" strokeDasharray="4 18" />
          <path d={D} stroke="url(#tr)" strokeWidth={12} fill="none" strokeLinecap="round" strokeDasharray={1500} strokeDashoffset={1500 * (1 - u)} style={{ filter: `drop-shadow(0 0 18px ${C.mustard})` }} />
          {u > 0 && u < 1 && Array.from({ length: 10 }, (_, i) => { const [x, y] = bez(Math.max(0, u - i * .018)); return <circle key={i} cx={x} cy={y} r={20 - i * 1.7} fill={i ? C.mustard : '#fff'} opacity={1 - i * .09} style={{ filter: `drop-shadow(0 0 ${20 - i}px ${C.mustard})` }} />; })}
          {u > 0 && u < 1 && <circle cx={px} cy={py} r={40} fill={C.mustard} opacity={.18} />}
        </svg>
        <div className="shock" style={{ position: 'absolute', left: P3[0] - 140, top: P3[1] - 140, width: 280, height: 280, borderRadius: 140, border: `8px solid ${C.mustard}`, opacity: 0 }} />
        <div style={{ position: 'absolute', inset: 0, perspective: 1800 }}>
          <div className="tab" style={{ position: 'absolute', left: (1080 - TW - TB * 2) / 2, top: TAB_TOP, width: TW + TB * 2, height: TH + TB * 2, transformOrigin: '50% 50%' }}>
            <Tablet glow={live ? .5 + .5 * Math.abs(Math.sin((t - HIT) * 5)) : 0}>
              <AbsoluteFill style={{ background: '#111', display: 'grid', placeItems: 'center', opacity: live ? 0 : 1 }}><Img src={staticFile('logo.webp')} style={{ width: 300, opacity: .35 }} /></AbsoluteFill>
              {live && <div style={{ position: 'absolute', inset: 0, opacity: expoOut(ramp(t, HIT, HIT + .2)) }}><Shot src="ui/branch-new.png" /></div>}
            </Tablet>
          </div>
        </div>
      </AbsoluteFill>
      <div className="toast" style={{ position: 'absolute', left: 90, right: 90, top: 1240, opacity: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, padding: '34px 40px', borderRadius: 48, background: 'linear-gradient(160deg, rgba(255,255,255,.96), rgba(251,245,234,.92))', boxShadow: `0 40px 90px rgba(0,0,0,.5), 0 0 0 4px ${C.red}` }}>
          <span style={{ display: 'grid', placeItems: 'center', width: 120, height: 120, borderRadius: 34, background: C.red, color: '#fff', transform: `rotate(${t > HIT + .1 && t < HIT + .9 ? Math.sin(t * 46) * 16 : 0}deg)` }}><Bell size={66} /></span>
          <div>
            <div style={{ font: `900 88px/1.1 ${F.head}`, color: C.red }}>طلب جديد!</div>
            <div style={{ font: `700 38px ${F.body}`, color: C.ink }}>وصل للفرع <span style={{ font: `900 38px ${F.num}` }}>فوراً</span></div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
