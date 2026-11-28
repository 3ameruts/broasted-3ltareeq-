import React from 'react';
import { AbsoluteFill, Img, random, staticFile } from 'remotion';
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
      const streamer = i % 7 === 3, w = streamer ? 9 : 12 + r('s') * 14, h = streamer ? 54 + r('h') * 30 : w * (1.3 + r('h') * .8), flip = Math.cos(k * (8 + r('f') * 10) + i);
      return <div key={i} style={{ position: 'absolute', left: px, top: py, width: w, height: h, background: COLORS[i % COLORS.length], borderRadius: streamer ? '50% 50% 50% 50% / 20% 20% 20% 20%' : i % 5 === 0 ? w : 3,
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

// ---------- the mascot: the drumstick from the logo, with squash-and-stretch hops, a wave and speech bubbles ----------
const MW = 607, MH = 1195; // public/brand/mascot.png
export type Say = { at: number; end: number; text: string };
export const Mascot: React.FC<{ t: number; x: number; y: number; h: number; hops?: number[]; says?: Say[]; flip?: boolean; wave?: boolean; enter?: number; exit?: number; bubbleSide?: 'left' | 'right' }> =
  ({ t, x, y, h, hops = [], says = [], flip, wave, enter = -99, exit = 999, bubbleSide = 'left' }) => {
    if (t < enter || t > exit + .5) return null;
    const w = h * MW / MH;
    const inK = backOut(ramp(t, enter, enter + .45), 2), outK = ramp(t, exit, exit + .35, 0, 1, x2 => x2 * x2);
    // the hop: anticipation squash → stretch up → land squash
    let lift = 0, sx = 1, sy = 1;
    for (const a of hops) {
      const k = t - a; if (k < -.08 || k > .55) continue;
      if (k < 0) { sy = 1 - .18 * (1 + k / .08); sx = 1 + .12 * (1 + k / .08); }
      else if (k < .4) { const u = k / .4; lift = Math.sin(u * Math.PI) * h * .32; sy = 1 + .14 * Math.sin(u * Math.PI); sx = 1 - .08 * Math.sin(u * Math.PI); }
      else { const u = (k - .4) / .15; sy = 1 - .16 * Math.sin(u * Math.PI); sx = 1 + .1 * Math.sin(u * Math.PI); }
    }
    const breathe = 1 + Math.sin(t * 5) * .015, rot = wave ? Math.sin(t * 9) * 9 : Math.sin(t * 2.4) * 3;
    const say = says.find(s => t >= s.at && t <= s.end + .2);
    return (
      <div style={{ position: 'absolute', left: x - w / 2, top: y - h + (1 - Math.min(inK, 1)) * h * 1.2 + outK * h * 1.4, width: w, height: h, zIndex: 8 }}>
        <div style={{ position: 'absolute', left: w * .1, bottom: -h * .03, width: w * .8, height: h * .07, borderRadius: '50%', background: 'rgba(40,0,0,.3)', filter: 'blur(8px)', transform: `scale(${1 - lift / h})` }} />
        <Img src={staticFile('brand/mascot.png')} style={{ position: 'absolute', inset: 0, width: w, height: h, transformOrigin: '50% 100%',
          transform: `translateY(${-lift}px) scale(${(flip ? -1 : 1) * sx * breathe}, ${sy * breathe}) rotate(${(flip ? -1 : 1) * rot}deg)`, filter: 'drop-shadow(0 14px 18px rgba(60,0,0,.35))' }} />
        {say && <Bubble t={t} at={say.at} end={say.end} text={say.text} side={bubbleSide} w={w} h={h} lift={lift} />}
      </div>
    );
  };
const Bubble: React.FC<{ t: number; at: number; end: number; text: string; side: 'left' | 'right'; w: number; h: number; lift: number }> = ({ t, at, end, text, side, w, h, lift }) => {
  const k = backOut(ramp(t, at, at + .3), 2.6), out = ramp(t, end, end + .18);
  return (
    <div style={{ position: 'absolute', bottom: h * .86 + lift, [side === 'left' ? 'right' : 'left']: w * .72, whiteSpace: 'nowrap', padding: '10px 26px 16px', borderRadius: 34, background: '#fff', color: C.ink,
      font: `400 50px/1.25 ${F.fun}`, boxShadow: '0 14px 30px rgba(60,0,0,.3)', transformOrigin: side === 'left' ? '100% 100%' : '0% 100%', transform: `scale(${Math.max(0, k) * (1 - out)})` } as React.CSSProperties}>
      {text}
      <div style={{ position: 'absolute', bottom: -16, [side === 'left' ? 'right' : 'left']: 26, width: 0, height: 0, borderLeft: '16px solid transparent', borderRight: '16px solid transparent', borderTop: '20px solid #fff' } as React.CSSProperties} />
    </div>
  );
};
