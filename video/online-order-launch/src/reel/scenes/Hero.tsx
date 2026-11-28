import { Globe } from 'lucide-react';
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { Phone, PH, PW, Shot, Tablet, TB, TH, TW } from '../devices';
import { Particles, Sheen, useGsap, useT } from '../lib';
import { C, F } from '../theme';

// 20.5–25s (local 0–4.5). Hero shot: the meal in front, the phone (order tracking) and the branch screen behind it,
// «اطلب أونلاين... واستمتع بوجبتك!», then the logo and the link.
export const Hero: React.FC = () => {
  const t = useT();
  const ref = useGsap((tl, q) => {
    tl.fromTo(q('.meal'), { scale: .5, y: 300, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: .9, ease: 'expo.out' }, 0)
      .fromTo(q('.ph'), { x: -500, rotate: -30, opacity: 0 }, { x: 0, rotate: -12, opacity: 1, duration: 1, ease: 'expo.out' }, .1)
      .fromTo(q('.tb'), { x: 520, rotate: 26, opacity: 0 }, { x: 0, rotate: 9, opacity: 1, duration: 1, ease: 'expo.out' }, .18)
      .fromTo(q('.t1'), { y: 60, opacity: 0, filter: 'blur(10px)' }, { y: 0, opacity: 1, filter: 'blur(0px)', duration: .55 }, .3)
      .fromTo(q('.t2'), { scale: .5, opacity: 0 }, { scale: 1, opacity: 1, duration: .6, ease: 'back.out(2.2)' }, .75)
      .fromTo(q('.logo'), { scale: .2, opacity: 0, rotate: -10 }, { scale: 1, opacity: 1, rotate: 0, duration: 1, ease: 'elastic.out(1, .55)' }, 1.5)
      .fromTo(q('.ring'), { scale: .3, opacity: 1 }, { scale: 3.2, opacity: 0, duration: 1.1, ease: 'power2.out' }, 1.5)
      .fromTo(q('.url'), { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: .45, ease: 'back.out(1.8)' }, 2.0)
      .fromTo(q('.cam'), { scale: 1.08 }, { scale: 1, duration: 4.5, ease: 'power1.out' }, 0);
  });
  const fl = (k: number) => Math.sin(t * 1.6 + k) * 10;
  return (
    <AbsoluteFill ref={ref} style={{ background: `radial-gradient(80% 55% at 50% 52%, #ff4a5a 0%, ${C.red} 45%, ${C.redDeep} 100%)`, overflow: 'hidden' }}>
      <AbsoluteFill style={{ opacity: .1, backgroundImage: 'repeating-conic-gradient(#fff 0 25%, transparent 0 50%)', backgroundSize: '90px 90px', transform: 'perspective(900px) rotateX(58deg) translateY(520px) scale(1.6)' }} />
      <AbsoluteFill style={{ background: 'radial-gradient(50% 32% at 50% 56%, rgba(255,230,180,.55), transparent 70%)' }} />
      <Particles n={30} color={C.mustard} />
      <AbsoluteFill className="cam">
        <div className="ph" style={{ position: 'absolute', left: 10, top: 600 + fl(0), width: PW * .5, height: PH * .5, opacity: 0 }}>
          <div style={{ transform: 'scale(.5)', transformOrigin: '0 0', filter: 'blur(1.5px)' }}><Phone><Shot src="ui/13-tracking.png" /></Phone></div>
        </div>
        <div className="tb" style={{ position: 'absolute', left: 540, top: 560 + fl(1.5), width: (TW + TB * 2) * .48, height: (TH + TB * 2) * .48, opacity: 0 }}>
          <div style={{ transform: 'scale(.48)', transformOrigin: '0 0', filter: 'blur(1.5px)' }}><Tablet><Shot src="ui/branch-accepted.png" /></Tablet></div>
        </div>
        <Img className="meal" src={staticFile('food/cut15.webp')} style={{ position: 'absolute', left: 40, top: 700 + fl(.7), width: 1000, filter: 'drop-shadow(0 50px 60px rgba(60,0,0,.55))', opacity: 0 }} />
      </AbsoluteFill>
      <div style={{ position: 'absolute', top: 270, width: '100%', textAlign: 'center', color: '#fff' }}>
        <div className="t1" style={{ font: `900 110px/1.15 ${F.head}`, textShadow: '0 10px 40px rgba(80,0,0,.45)' }}>اطلب أونلاين...</div>
        <div className="t2" style={{ position: 'relative', display: 'inline-block', font: `900 116px/1.15 ${F.head}`, color: C.mustard, textShadow: '0 10px 40px rgba(80,0,0,.45)' }}>واستمتع بوجبتك!<Sheen at={1.4} /></div>
      </div>
      <div className="ring" style={{ position: 'absolute', left: 540 - 220, top: 1340 - 220, width: 440, height: 440, borderRadius: 220, border: `6px solid ${C.mustard}`, opacity: 0 }} />
      <div className="logo" style={{ position: 'absolute', left: 540 - 270, top: 1180, width: 540, opacity: 0 }}>
        <Img src={staticFile('logo.webp')} style={{ width: 540, filter: 'drop-shadow(0 20px 40px rgba(60,0,0,.5))' }} />
      </div>
      <div className="url" style={{ position: 'absolute', top: 1500, width: '100%', display: 'flex', justifyContent: 'center', opacity: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 32px', borderRadius: 40, background: '#fff', color: C.redDeep, font: `700 40px ${F.body}`, boxShadow: '0 16px 40px rgba(60,0,0,.35)' }}>
          <Globe size={38} /><span style={{ direction: 'ltr' }}>order.broasted3ltareeq.com</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
