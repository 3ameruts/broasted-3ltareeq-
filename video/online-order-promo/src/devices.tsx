import React from 'react';
import { Img, interpolate, staticFile } from 'remotion';
import { C } from './theme';

// phone: the screenshots are 390×844 CSS px at 2.5x (975×2110)
export const SW = 600, SH = Math.round(600 * 2110 / 975), BEZ = 18;
export const PW = SW + BEZ * 2, PH = SH + BEZ * 2;
// left/top 0: the page is right-to-left, so an absolute box without them would hang off its parent's right edge
export const Phone: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; glow?: number }> = ({ children, style, glow = 0 }) => (
  <div style={{ position: 'absolute', left: 0, top: 0, width: PW, height: PH, borderRadius: 84, padding: BEZ, background: 'linear-gradient(145deg,#3b3639,#121012 60%,#2a2628)',
    boxShadow: `0 60px 120px rgba(0,0,0,.45), 0 0 0 2px #4b4548 inset, 0 0 ${120 * glow}px ${C.mustard}`, ...style }}>
    <div style={{ position: 'relative', width: SW, height: SH, borderRadius: 68, overflow: 'hidden', background: '#000' }}>
      {children}
      <div style={{ position: 'absolute', left: SW / 2 - 85, top: 22, width: 170, height: 46, borderRadius: 30, background: '#0b0a0b', zIndex: 30 }} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: 68, background: 'linear-gradient(115deg, rgba(255,255,255,.16) 0%, transparent 28%, transparent 70%, rgba(255,255,255,.05))', pointerEvents: 'none', zIndex: 31 }} />
    </div>
  </div>
);

// tablet at the branch: screenshots are 1180×820 CSS px at 2x (2360×1640)
export const TW = 980, TH = Math.round(980 * 1640 / 2360), TB = 24;
export const Tablet: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; glow?: number }> = ({ children, style, glow = 0 }) => (
  <div style={{ position: 'absolute', left: 0, top: 0, width: TW + TB * 2, height: TH + TB * 2, borderRadius: 52, padding: TB, background: 'linear-gradient(150deg,#3a3537,#141113 65%,#272224)',
    boxShadow: `0 60px 120px rgba(0,0,0,.55), 0 0 0 2px #4d4749 inset, 0 0 ${140 * glow}px ${C.red}`, ...style }}>
    <div style={{ position: 'relative', width: TW, height: TH, borderRadius: 30, overflow: 'hidden', background: '#000' }}>
      {children}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(120deg, rgba(255,255,255,.12) 0%, transparent 30%)', pointerEvents: 'none' }} />
    </div>
  </div>
);

// a finger tap: ring + dot, x/y in px inside the screen
export const Tap: React.FC<{ t: number; at: number; x: number; y: number }> = ({ t, at, x, y }) => {
  const k = t - at; if (k < -0.22 || k > 0.5) return null;
  const pre = k < 0, ring = pre ? 0 : interpolate(k, [0, .5], [0, 1]);
  return (
    <div style={{ position: 'absolute', left: x - 70, top: y - 70, width: 140, height: 140, zIndex: 25, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 70, border: '6px solid rgba(255,255,255,.95)', transform: `scale(${.5 + ring * 1.2})`, opacity: pre ? 0 : 1 - ring, boxShadow: '0 0 20px rgba(0,0,0,.25)' }} />
      <div style={{ position: 'absolute', inset: 40, borderRadius: 40, background: 'rgba(255,255,255,.88)', boxShadow: `0 0 0 8px ${C.red}66, 0 6px 18px rgba(0,0,0,.3)`,
        transform: `scale(${pre ? 1.35 + k * 1.6 : 1 - ring * .6})`, opacity: pre ? 1 + k * 3 : 1 - ring }} />
    </div>
  );
};

export const Shot: React.FC<{ src: string; style?: React.CSSProperties }> = ({ src, style }) => (
  <Img src={staticFile(src)} style={{ position: 'absolute', left: 0, top: 0, width: '100%', ...style }} />
);
