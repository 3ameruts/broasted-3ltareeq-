import { Flame } from 'lucide-react';
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { easeOut, Pill, ramp, useT } from '../lib';
import { F } from '../theme';

// 16.5–20.5s (local 0–4). Real food photography: one cut a second, whip-pan transitions with motion blur,
// a cut-out foreground over a slower background for depth (2.5D parallax).
type ShotDef = { bg: string; fg?: string; fgW?: number; fgX?: number; fgY?: number; dir: 1 | -1; zoom: [number, number] };
const SHOTS: ShotDef[] = [
  { bg: 'food/k16.jpg', fg: 'food/cut16.webp', fgW: 1500, fgX: -260, fgY: 520, dir: 1, zoom: [1.15, 1.32] },
  { bg: 'food/k20.jpg', fg: 'food/cut20.webp', fgW: 1450, fgX: -300, fgY: 560, dir: -1, zoom: [1.1, 1.26] },
  { bg: 'food/k13.jpg', dir: 1, zoom: [1.35, 1.12] },
  { bg: 'food/k11.jpg', fg: 'food/cut11.webp', fgW: 1100, fgX: -10, fgY: 640, dir: -1, zoom: [1.05, 1.3] },
];
// one shot every 2 beats of the launch music (0.5448 s)
const LEN = 2 * 0.5448, WHIP = .14;

export const Kitchen: React.FC = () => {
  const t = useT();
  const i = Math.min(SHOTS.length - 1, Math.floor(t / LEN)), local = t - i * LEN, s = SHOTS[i];
  const inK = 1 - easeOut(ramp(local, 0, WHIP)), outK = ramp(local, LEN - WHIP, LEN) * (i < SHOTS.length - 1 ? 1 : 0);
  const shift = (inK * 340 - outK * 340) * s.dir, blur = (inK + outK) * 28;
  const z = s.zoom[0] + (s.zoom[1] - s.zoom[0]) * ramp(local, 0, LEN);
  const punch = i === 3 && local > .35 ? 1 + .06 * Math.exp(-(local - .35) * 8) : 1;
  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `translateX(${shift}px)`, filter: `blur(${blur}px)` }}>
        <Img src={staticFile(s.bg)} style={{ position: 'absolute', height: 1920, left: '50%', top: 0, transform: `translateX(-50%) scale(${z * punch}) translateX(${(local - .5) * -40 * s.dir}px)`, filter: s.fg ? 'blur(3px) brightness(.85)' : 'none' }} />
        {s.fg && <Img src={staticFile(s.fg)} style={{ position: 'absolute', width: s.fgW, left: s.fgX, top: s.fgY, transform: `scale(${z * 1.04}) translateX(${(local - .5) * -110 * s.dir}px)`, filter: 'drop-shadow(0 40px 50px rgba(0,0,0,.45))' }} />}
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(120% 80% at 50% 45%, transparent 50%, rgba(40,10,0,.55) 100%), linear-gradient(180deg, rgba(0,0,0,.35), transparent 22%, transparent 78%, rgba(0,0,0,.35))', mixBlendMode: 'multiply' }} />
      <AbsoluteFill style={{ background: '#fff', opacity: Math.max(0, 1 - local / .08) * (i > 0 ? .55 : 0) }} />
      <div style={{ position: 'absolute', top: 262, width: '100%', display: 'flex', justifyContent: 'center', opacity: ramp(t, .05, .3) * (1 - ramp(t, 4.12, 4.32)) }}>
        <Pill dark style={{ font: `800 46px ${F.head}` }}><Flame size={42} color="#fcb712" /> بلّشنا نجهّز طلبك فريش</Pill>
      </div>
    </AbsoluteFill>
  );
};
