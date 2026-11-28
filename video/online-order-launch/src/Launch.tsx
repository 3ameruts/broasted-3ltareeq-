import './fonts';
import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { Mascot } from './fx';
import { Grain, shake } from './lib';
import { Speed } from './reel/lib';
import { Branch } from './reel/scenes/Branch';
import { Hero } from './reel/scenes/Hero';
import { Kitchen } from './reel/scenes/Kitchen';
import { Transmit } from './reel/scenes/Transmit';
import { EndCard, END0 } from './scenes/EndCard';
import { Journey } from './scenes/Journey';
import { Teaser } from './scenes/Open';
import { b, FPS, fr } from './theme';
import TM from './timing.json';

// «جديدنا!» v3 (≈39s). Every scene starts on a beat of the music (b(n); the drop = 2.6s).
//   0–2.6   teaser on a dark stage; the mascot peeks up during the drum roll
//   2.6–7   «جديدنا!» + confetti, «صار فيك تطلب أونلاين!» over the broasted zooming in
//   7–10.2  the cream studio: logo slam, meals burst, «وجبتك المفضلة… صارت أقرب!», the phone flies up with the 3 ways to order
//   10.2–22.8 a real order, step by step (3–5 beats a step), the mascot commenting from behind the phone
//   22.8–27.7 the order flies to the branch, the branch accepts (played faster: 1.84× and 1.33×)
//   27.7–34.7 the kitchen, then the hero shot
//   34.7–end  the final card: logo + «جديد», link, cash or CliQ, the three branches, the mascot waving
export const AT = { transmit: b(41), branch: b(44), kitchen: b(50), hero: b(56), end: END0 };
const END = TM.duration;

export const Launch: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const s = shake(t, [b(0), b(4), b(8)], 20);
  const seq = (from: number, to: number, name: string, el: React.ReactNode, speed = 1) =>
    <Sequence from={fr(from)} durationInFrames={fr(to) - fr(from)} name={name}><Speed.Provider value={speed}>{el}</Speed.Provider></Sequence>;
  return (
    <AbsoluteFill style={{ background: '#000', direction: 'rtl' }}>
      <AbsoluteFill style={{ transform: `translate(${s.x}px, ${s.y}px) rotate(${s.r}deg)` }}>
        {t < b(0) && <><Teaser t={t} /><Mascot t={t} x={540} y={1640} h={340} enter={b(-2) + .2} exit={b(0) - .25} hops={[b(-1)]} /></>}
        {t >= b(0) && t < AT.transmit && <Journey t={t} />}
        {seq(AT.transmit, AT.branch, 'Transmit', <Transmit />, 3 / (AT.branch - AT.transmit))}
        {seq(AT.branch, AT.kitchen, 'Branch', <Branch />, 4.36 / (AT.kitchen - AT.branch))}
        {seq(AT.kitchen, AT.hero, 'Kitchen', <Kitchen />)}
        {seq(AT.hero, AT.end, 'Hero', <Hero />)}
        {t >= AT.end && <EndCard t={t} />}
      </AbsoluteFill>
      {/* white flashes on the drop and on the big cuts */}
      <AbsoluteFill style={{ background: '#fff', pointerEvents: 'none', opacity: Math.max(0, ...[b(0), AT.transmit, AT.hero, AT.end].map(c => 1 - Math.abs(t - c) / .1)) * .8 }} />
      <Grain />
      <Audio src={staticFile('audio.wav')} />
    </AbsoluteFill>
  );
};
