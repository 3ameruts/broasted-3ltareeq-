import { noise2D } from '@remotion/noise';
import { gsap } from 'gsap';
import React, { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from 'remotion';
import { C } from './theme';

// Every scene works in ABSOLUTE video seconds (start = where its sequence begins), so all timings match the music grid.
export const useAbs = (start: number) => { const f = useCurrentFrame(); const { fps } = useVideoConfig(); return start + f / fps; };

// GSAP, frame-accurate: one paused timeline (positions in absolute seconds), sought to the current time on every render.
export function useGsap<T extends HTMLElement = HTMLDivElement>(start: number, build: (tl: gsap.core.Timeline, q: (s: string) => Element[]) => void) {
  const t = useAbs(start);
  const scope = useRef<T>(null); const tl = useRef<gsap.core.Timeline | null>(null);
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const x = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
      build(x, gsap.utils.selector(scope)); tl.current = x;
    }, scope);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useLayoutEffect(() => { tl.current?.seek(t, false); }, [t]);
  return scope;
}

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
export const ramp = (t: number, a: number, b: number, from = 0, to = 1, ease?: (x: number) => number) => interpolate(t, [a, b], [from, to], { ...clamp, easing: ease });
export const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
export const easeIn = (x: number) => x * x * x;
export const expoOut = (x: number) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x));

// camera shake: smooth noise, decaying after each hit
export function shake(t: number, hits: number[], amp = 20, decay = 7) {
  let k = 0;
  for (const h of hits) if (t >= h) k = Math.max(k, Math.exp(-(t - h) * decay));
  return { x: noise2D('sx', t * 9, 0) * amp * k, y: noise2D('sy', 0, t * 9) * amp * k, r: noise2D('sr', t * 7, 3) * amp * .05 * k };
}
// a one-shot zoom punch on beats
export const punch = (t: number, hits: number[], amt = .05, decay = 9) =>
  1 + hits.reduce((m, h) => (t >= h ? Math.max(m, amt * Math.exp(-(t - h) * decay)) : m), 0);

export const Particles: React.FC<{ n?: number; color?: string; speed?: number }> = ({ n = 40, color = '#fff', speed = 1 }) => {
  const f = useCurrentFrame();
  return <>{Array.from({ length: n }, (_, i) => {
    const x = random('x' + i) * 1080, sp = (.3 + random('s' + i)) * speed, s = 2 + random('z' + i) * 7;
    const y = ((random('y' + i) * 2100 - f * sp * 1.8) % 2100 + 2100) % 2100;
    return <div key={i} style={{ position: 'absolute', left: x + Math.sin(f / 30 + i) * 12, top: y, width: s, height: s, borderRadius: s, background: i % 3 ? '#fff' : color,
      opacity: (.2 + .6 * Math.abs(Math.sin(f / 18 + i))) * (s > 6 ? .45 : .8), filter: s > 6 ? 'blur(2px)' : undefined }} />;
  })}</>;
};

// the brand world: red, warm light, a checkered floor (the menu's checker) in perspective
export const RedWorld: React.FC<{ t: number }> = ({ t }) => (
  <AbsoluteFill style={{ background: `radial-gradient(85% 60% at 50% 42%, #ff4d5c 0%, ${C.red} 42%, ${C.redDeep} 78%, ${C.redDark} 100%)`, overflow: 'hidden' }}>
    <AbsoluteFill style={{ opacity: .13, backgroundImage: 'repeating-conic-gradient(#fff 0 25%, transparent 0 50%)', backgroundSize: '100px 100px',
      backgroundPosition: `0 ${t * 60}px`, transform: 'perspective(900px) rotateX(62deg) translateY(640px) scale(1.8)', maskImage: 'linear-gradient(transparent 0%, #000 60%)' }} />
    <div style={{ position: 'absolute', width: 1300, height: 1300, left: -420 + Math.sin(t * .7) * 90, top: -380, borderRadius: '50%', background: `radial-gradient(circle, ${C.mustard}55, transparent 60%)`, filter: 'blur(10px)' }} />
    <div style={{ position: 'absolute', width: 1200, height: 1200, right: -520, bottom: 100 + Math.cos(t * .6) * 80, borderRadius: '50%', background: 'radial-gradient(circle, #ff8a6a44, transparent 60%)' }} />
    <Particles n={34} color={C.mustard} />
    <AbsoluteFill style={{ background: 'radial-gradient(120% 85% at 50% 45%, transparent 55%, rgba(60,0,0,.5) 100%)' }} />
  </AbsoluteFill>
);

// warm dark set
export const Night: React.FC<{ t: number }> = ({ t }) => (
  <AbsoluteFill style={{ background: `radial-gradient(100% 65% at 50% 55%, #3a2620 0%, ${C.night} 55%, #0a0708 100%)`, overflow: 'hidden' }}>
    <div style={{ position: 'absolute', width: 1300, height: 1300, left: -110 + Math.sin(t * 1.2) * 60, top: 620, borderRadius: '50%', background: `radial-gradient(circle, ${C.red}38, transparent 60%)`, filter: 'blur(20px)' }} />
    <Particles n={26} color={C.mustard} speed={.6} />
  </AbsoluteFill>
);

// a light sweep across text or a logo
export const Sheen: React.FC<{ t: number; at: number; dur?: number }> = ({ t, at, dur = .8 }) => {
  const p = ramp(t, at, at + dur, -60, 160);
  return <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'overlay', background: `linear-gradient(105deg, transparent ${p - 18}%, rgba(255,255,255,.95) ${p}%, transparent ${p + 18}%)` }} />;
};

// film grain + soft vignette over everything (fresh grain every frame)
export const Grain: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <svg width="1080" height="1920" style={{ position: 'absolute', inset: 0, opacity: .07, mixBlendMode: 'overlay' }}>
        <filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves={2} seed={f % 12} /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width="100%" height="100%" filter="url(#g)" />
      </svg>
      <AbsoluteFill style={{ background: 'radial-gradient(140% 95% at 50% 50%, transparent 62%, rgba(0,0,0,.28) 100%)' }} />
    </AbsoluteFill>
  );
};
