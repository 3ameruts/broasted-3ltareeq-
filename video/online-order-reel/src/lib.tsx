import { gsap } from 'gsap';
import React, { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from 'remotion';
import { C } from './theme';

// GSAP, frame-accurate: build a paused timeline once, seek it to the current frame on every render.
export function useGsap<T extends HTMLElement = HTMLDivElement>(build: (tl: gsap.core.Timeline, q: (s: string) => Element[]) => void) {
  const frame = useCurrentFrame(); const { fps } = useVideoConfig();
  const scope = useRef<T>(null); const tl = useRef<gsap.core.Timeline | null>(null);
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const t = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
      build(t, gsap.utils.selector(scope)); tl.current = t;
    }, scope);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useLayoutEffect(() => { tl.current?.seek(frame / fps, false); }, [frame, fps]);
  return scope;
}
export const useT = () => { const f = useCurrentFrame(); const { fps } = useVideoConfig(); return f / fps; };
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
export const ramp = (t: number, a: number, b: number, from = 0, to = 1, ease?: (x: number) => number) => interpolate(t, [a, b], [from, to], { ...clamp, easing: ease });
export const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
export const easeInOut = (x: number) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const expoOut = (x: number) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x));

// cream studio with warm light pools
export const Cream: React.FC = () => {
  const t = useT();
  return (
    <AbsoluteFill style={{ background: `radial-gradient(90% 60% at 50% 35%, #fffaf1 0%, ${C.cream} 45%, #f1e4cf 100%)`, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 1400, height: 1400, left: -500 + Math.sin(t * .5) * 60, top: -420, borderRadius: '50%', background: `radial-gradient(circle, ${C.mustard}44, transparent 62%)` }} />
      <div style={{ position: 'absolute', width: 1300, height: 1300, right: -620, bottom: -300 + Math.cos(t * .4) * 60, borderRadius: '50%', background: `radial-gradient(circle, ${C.red}2e, transparent 60%)` }} />
      <AbsoluteFill style={{ background: 'radial-gradient(130% 90% at 50% 45%, transparent 60%, rgba(90,50,20,0.18) 100%)' }} />
    </AbsoluteFill>
  );
};
// warm dark set
export const Night: React.FC<{ glow?: string }> = ({ glow = C.red }) => {
  const t = useT();
  return (
    <AbsoluteFill style={{ background: `radial-gradient(110% 70% at 50% 30%, #3a2a24 0%, ${C.night} 55%, #0d0a0b 100%)`, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 1300, height: 1300, left: -300 + Math.sin(t * .6) * 80, top: 300, borderRadius: '50%', background: `radial-gradient(circle, ${glow}40, transparent 60%)`, filter: 'blur(20px)' }} />
      <div style={{ position: 'absolute', width: 1000, height: 1000, right: -380, top: -200 + Math.cos(t * .5) * 70, borderRadius: '50%', background: `radial-gradient(circle, ${C.mustard}30, transparent 60%)`, filter: 'blur(30px)' }} />
      <Particles n={40} color={C.mustard} />
      <AbsoluteFill style={{ background: 'radial-gradient(130% 90% at 50% 45%, transparent 55%, rgba(0,0,0,0.6) 100%)' }} />
    </AbsoluteFill>
  );
};
export const Particles: React.FC<{ n?: number; color?: string }> = ({ n = 40, color = '#fff' }) => {
  const f = useCurrentFrame();
  return <>{Array.from({ length: n }, (_, i) => {
    const x = random('x' + i) * 1080, sp = .3 + random('s' + i), s = 2 + random('z' + i) * 6;
    const y = ((random('y' + i) * 2100 - f * sp * 1.8) % 2100 + 2100) % 2100;
    return <div key={i} style={{ position: 'absolute', left: x, top: y, width: s, height: s, borderRadius: s, background: i % 3 ? '#fff' : color,
      opacity: (.2 + .6 * Math.abs(Math.sin(f / 18 + i))) * (s > 6 ? .5 : .8), filter: s > 6 ? 'blur(2px)' : undefined }} />;
  })}</>;
};
// a light sweep across text or a logo
export const Sheen: React.FC<{ at: number; dur?: number }> = ({ at, dur = .9 }) => {
  const t = useT(); const p = ramp(t, at, at + dur, -60, 160);
  return <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'overlay', background: `linear-gradient(105deg, transparent ${p - 18}%, rgba(255,255,255,.9) ${p}%, transparent ${p + 18}%)` }} />;
};
// a step name in a glass pill (the idea reads with the sound off)
export const Pill: React.FC<{ children: React.ReactNode; dark?: boolean; style?: React.CSSProperties }> = ({ children, dark, style }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14, padding: '16px 34px', borderRadius: 60, font: '800 44px "Tajawal"',
    background: dark ? 'rgba(20,12,10,.45)' : 'rgba(255,255,255,.75)', color: dark ? '#fff' : C.ink, border: `1.5px solid ${dark ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.9)'}`,
    backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', boxShadow: '0 18px 40px rgba(0,0,0,.15)', ...style }}>{children}</div>
);
