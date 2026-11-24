import { CameraMotionBlur } from '@remotion/motion-blur';
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { easeOut, expoOut, punch, ramp, useAbs } from '../lib';
import { b, BEAT, C, F } from '../theme';

// 19.9–25.3s. Real food, graded: one shot every 2 beats, whip-pans with camera motion blur, a cut-out foreground over a
// slower background (2.5D parallax), a punch-in on the off-beat, and one big word per shot.
const SHOTS = [
  { bg: 'k16', fg: 'cut16', fgW: 1500, fgX: -210, fgY: 640, dir: 1, z: [1.12, 1.3], word: 'مقرمش', style: 'white' },
  { bg: 'k20', fg: 'cut20', fgW: 1450, fgX: -190, fgY: 700, dir: -1, z: [1.3, 1.12], word: 'فريش', style: 'mustard' },
  { bg: 'k11', fg: 'cut11', fgW: 1100, fgX: -10, fgY: 640, dir: 1, z: [1.1, 1.28], word: 'على كيفك', style: 'white' },
  { bg: 'k15', fg: 'cut15', fgW: 1350, fgX: -135, fgY: 660, dir: -1, z: [1.25, 1.08], word: 'وبيوصلك سخن', style: 'red' },
] as const;
const T0 = b(28), LEN = BEAT * 2, WHIP = .16;

export const Montage: React.FC<{ start: number }> = ({ start }) => (
  <AbsoluteFill style={{ background: '#000' }}>
    <CameraMotionBlur samples={6} shutterAngle={180}><Shots start={start} /></CameraMotionBlur>
    <Words start={start} />
  </AbsoluteFill>
);

const Shots: React.FC<{ start: number }> = ({ start }) => {
  const t = useAbs(start), rel = t - T0;
  const i = Math.max(0, Math.min(SHOTS.length - 1, Math.floor(rel / LEN))), local = rel - i * LEN, s = SHOTS[i];
  const inK = 1 - easeOut(ramp(local, i === 0 ? -.2 : 0, WHIP)), outK = i < SHOTS.length - 1 ? ramp(local, LEN - WHIP, LEN) : 0;
  const shift = (inK * 420 - outK * 420) * s.dir;
  const z = (s.z[0] + (s.z[1] - s.z[0]) * ramp(local, 0, LEN)) * punch(local, [BEAT], .06, 8);
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `translateX(${shift}px)` }}>
        <Img src={staticFile(`food/${s.bg}.jpg`)} style={{ position: 'absolute', height: 1920, left: '50%', top: 0, transform: `translateX(-50%) scale(${z}) translateX(${(local - .6) * -50 * s.dir}px)`, filter: 'blur(4px) brightness(.8) saturate(1.05)' }} />
        <Img src={staticFile(`food/${s.fg}.webp`)} style={{ position: 'absolute', width: s.fgW, left: s.fgX, top: s.fgY, transform: `scale(${z * .96}) translateX(${(local - .6) * -130 * s.dir}px) rotate(${(local - .6) * 3 * s.dir}deg)`, filter: 'drop-shadow(0 50px 60px rgba(40,0,0,.55))' }} />
      </AbsoluteFill>
      {/* grade: warm vignette, lifted mids */}
      <AbsoluteFill style={{ background: 'radial-gradient(110% 75% at 50% 52%, transparent 45%, rgba(70,10,0,.6) 100%), linear-gradient(180deg, rgba(0,0,0,.4), transparent 26%, transparent 74%, rgba(0,0,0,.4))' }} />
      <AbsoluteFill style={{ background: '#fff', opacity: i > 0 ? Math.max(0, 1 - local / .09) * .6 : 0 }} />
    </AbsoluteFill>
  );
};

// the words sit outside the motion blur so they stay razor sharp
const Words: React.FC<{ start: number }> = ({ start }) => {
  const t = useAbs(start), rel = t - T0;
  const i = Math.max(0, Math.min(SHOTS.length - 1, Math.floor(rel / LEN))), local = rel - i * LEN, s = SHOTS[i];
  const k = expoOut(ramp(local, .04, .34)), out = i < SHOTS.length - 1 ? ramp(local, LEN - .12, LEN) : ramp(local, LEN - .1, LEN);
  const look = s.style === 'mustard' ? { background: C.mustard, color: C.redDeep, boxShadow: `0 12px 0 ${C.brown}` }
    : s.style === 'red' ? { background: C.red, color: '#fff', boxShadow: `0 12px 0 ${C.redDark}` } : { color: '#fff', textShadow: `0 10px 0 ${C.redDeep}, 0 24px 50px rgba(0,0,0,.5)` };
  return (
    <div style={{ position: 'absolute', top: 300, width: 1080, display: 'flex', justifyContent: 'center', opacity: 1 - out }}>
      <div style={{ position: 'relative', padding: s.style === 'white' ? 0 : '0 44px', borderRadius: 34, font: `900 ${s.word.length > 8 ? 140 : 180}px/1.25 ${F.head}`, ...look,
        clipPath: `inset(0 0 0 ${(1 - k) * 100}%)`, transform: `scale(${1.25 - .25 * k}) translateY(${out * -30}px)` }}>{s.word}</div>
    </div>
  );
};
