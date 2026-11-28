import './fonts';
import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { backOut, Confetti } from './fx';
import { Grain, ramp, shake } from './lib';
import { Branch } from './reel/scenes/Branch';
import { Hero } from './reel/scenes/Hero';
import { Kitchen } from './reel/scenes/Kitchen';
import { Transmit } from './reel/scenes/Transmit';
import { Journey } from './scenes/Journey';
import { Teaser } from './scenes/Open';
import { b, C, F, FPS, fr } from './theme';
import TM from './timing.json';

// «جديدنا!» — the launch of online ordering, explained end to end (33s). Every scene starts on a bar of the music.
//   0–2.6   teaser on a dark stage («عنّا خبر حلو…» «جاهزين؟»)
//   2.6–15.7 the drop: «جديدنا!», «صار فيك تطلب أونلاين!», then a real order on the phone, step by step
//   15.7–19  the order flies to the branch screen («طلب جديد!»)
//   19–23.3  the branch accepts, the customer gets «تم تأكيد طلبك»
//   23.3–27.7 the kitchen: real food, whip-pans
//   27.7–end  the hero shot, the logo with a «جديد» badge, confetti and the link
export const AT = { transmit: b(24), branch: b(30), kitchen: b(38), hero: b(46) };
const END = TM.duration;

export const Launch: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const s = shake(t, [b(0), b(4), AT.hero + 1.5], 20);
  const seq = (from: number, to: number, name: string, el: React.ReactNode) =>
    <Sequence from={fr(from)} durationInFrames={fr(to) - fr(from)} name={name}>{el}</Sequence>;
  return (
    <AbsoluteFill style={{ background: '#000', direction: 'rtl' }}>
      <AbsoluteFill style={{ transform: `translate(${s.x}px, ${s.y}px) rotate(${s.r}deg)` }}>
        {t < b(0) && <Teaser t={t} />}
        {t >= b(0) && t < AT.transmit && <Journey t={t} />}
        {seq(AT.transmit, AT.branch, 'Transmit', <Transmit />)}
        {seq(AT.branch, AT.kitchen, 'Branch', <Branch />)}
        {seq(AT.kitchen, AT.hero, 'Kitchen', <Kitchen />)}
        {seq(AT.hero, END, 'Hero', <><Hero /><NewBadge /></>)}
      </AbsoluteFill>
      {/* white flashes on the drop and on the scene cuts */}
      <AbsoluteFill style={{ background: '#fff', pointerEvents: 'none', opacity: Math.max(0, ...[b(0), AT.transmit, AT.hero].map(c => 1 - Math.abs(t - c) / .1)) * .8 }} />
      <Grain />
      <Audio src={staticFile('audio.wav')} />
    </AbsoluteFill>
  );
};

// on the hero shot: the logo gets a «جديد» badge and the confetti comes down
const NewBadge: React.FC = () => {
  const t = useCurrentFrame() / FPS, k = backOut(ramp(t, 2.05, 2.4), 3);
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 700, top: 1150, padding: '6px 26px 12px', borderRadius: 26, background: C.mustard, color: C.redDeep, font: `900 60px/1.1 ${F.head}`, border: '6px solid #fff',
        boxShadow: '0 14px 30px rgba(60,0,0,.4)', transform: `scale(${k}) rotate(${12 + (1 - Math.min(k, 1)) * 30}deg)`, opacity: Math.min(1, k * 3) }}>جديد</div>
      <Confetti t={t} at={1.5} x={540} y={-80} spread={2.6} power={.3} seed="e" n={45} up={1} />
      <Confetti t={t} at={1.5} x={60} y={1950} spread={.6} power={1.1} seed="el" n={40} />
      <Confetti t={t} at={1.5} x={1020} y={1950} spread={.6} power={1.1} seed="er" n={40} />
    </AbsoluteFill>
  );
};
