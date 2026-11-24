import React from 'react';
import { AbsoluteFill, random } from 'remotion';
import { Particles, ramp } from './lib';
import { C, F } from './theme';

export const backOut = (x: number, s = 1.8) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
export const io = (x: number) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// confetti: deterministic paper pieces with gravity, drag and a 3D flutter
const COLORS = [C.red, C.mustard, '#fff', C.cream, '#ff7a45', C.mustard];
export const Confetti: React.FC<{ t: number; at: number; n?: number; x: number; y: number; spread?: number; power?: number; seed?: string; up?: number }> =
  ({ t, at, n = 70, x, y, spread = 1, power = 1, seed = 'c', up = -1 }) => {
    const k = t - at; if (k < 0 || k > 4.5) return null;
    return <>{Array.from({ length: n }, (_, i) => {
      const r = (s: string) => random(seed + s + i);
      const ang = (r('a') - .5) * Math.PI * spread, v = (900 + r('v') * 1500) * power;
      const vx = Math.sin(ang) * v, vy = Math.cos(ang) * v * up;
      const drag = 2.2, e = (1 - Math.exp(-drag * k)) / drag;
      const px = x + vx * e + Math.sin(k * (3 + r('w') * 4) + i) * 40 * k, py = y + vy * e + 520 * k * k * .6;
      const w = 12 + r('s') * 14, h = w * (1.3 + r('h') * .8), flip = Math.cos(k * (8 + r('f') * 10) + i);
      return <div key={i} style={{ position: 'absolute', left: px, top: py, width: w, height: h, background: COLORS[i % COLORS.length], borderRadius: i % 5 === 0 ? w : 3,
        transform: `rotate(${k * 400 * (r('rot') - .5) + r('r0') * 360}deg) scaleY(${flip})`, opacity: 1 - ramp(k, 3.2, 4.4), boxShadow: '0 2px 4px rgba(0,0,0,.15)' }} />;
    })}</>;
  };

// a dark stage with two sweeping spotlights (the teaser)
export const Stage: React.FC<{ t: number }> = ({ t }) => (
  <AbsoluteFill style={{ background: `radial-gradient(90% 60% at 50% 60%, #2b1a1a 0%, #140c0d 60%, #070405 100%)`, overflow: 'hidden' }}>
    {[0, 1].map(i => {
      const a = (i ? 1 : -1) * (14 + Math.sin(t * 2.1 + i * 2) * 16);
      return <div key={i} style={{ position: 'absolute', left: i ? 760 : 320, top: -200, width: 0, height: 0, transform: `rotate(${a}deg)`, transformOrigin: '0 0' }}>
        <div style={{ position: 'absolute', left: -260, top: 0, width: 520, height: 2300, background: `linear-gradient(180deg, ${i ? '#ffd37a' : '#ffffff'}55, transparent 80%)`,
          clipPath: 'polygon(46% 0, 54% 0, 100% 100%, 0 100%)', filter: 'blur(14px)', mixBlendMode: 'screen' }} />
      </div>;
    })}
    <div style={{ position: 'absolute', left: 140, top: 1250, width: 800, height: 260, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(255,220,150,.22), transparent)', filter: 'blur(10px)' }} />
    <Particles n={30} color={C.mustard} speed={.5} />
  </AbsoluteFill>
);

// a die-cut sticker that slaps on and peels off
export const Sticker: React.FC<{ t: number; at: number; end: number; rot?: number; children: React.ReactNode; color?: string }> = ({ t, at, end, rot = -3, children, color = '#fff' }) => {
  if (t < at || t > end + .25) return null;
  const k = ramp(t, at, at + .32), s = backOut(k, 2.4), off = ramp(t, end - .02, end + .22);
  return (
    <div style={{ transform: `translate(${off * -520}px, ${off * -260}px) scale(${(1.7 - .7 * Math.min(s, 1.15)) * (1 - off * .3)}) rotate(${rot + (1 - k) * 12 - off * 30}deg)`, opacity: Math.min(1, k * 4) * (1 - off),
      background: color, borderRadius: 34, padding: '18px 30px', border: '8px solid #fff', boxShadow: '0 22px 50px rgba(60,0,0,.38), 0 2px 0 rgba(0,0,0,.05)', display: 'inline-flex', alignItems: 'center', gap: 20,
      font: `900 54px/1.2 ${F.head}`, color: C.ink }}>{children}</div>
  );
};
