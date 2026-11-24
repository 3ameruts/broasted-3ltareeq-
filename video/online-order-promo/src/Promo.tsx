import './fonts';
import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { iris } from '@remotion/transitions/iris';
import { slide } from '@remotion/transitions/slide';
import React from 'react';
import { AbsoluteFill, Audio, staticFile } from 'remotion';
import { Grain } from './lib';
import { EndCard } from './scenes/EndCard';
import { Hook } from './scenes/Hook';
import { Main } from './scenes/Main';
import { Montage } from './scenes/Montage';
import { useAbs } from './lib';
import { FPS } from './theme';

// «جوعان؟» — the online-ordering promo. Every cut sits on the music's beat grid (theme.ts: b(n), the drop = 2.4s).
// Scenes (frames @30): Hook 0–75 · iris 9 · Main 66–603 · slide 6 · Montage 597–757 · fade 6 · End 751–900
export const SCENES = { hook: [0, 75], main: [66, 603], montage: [597, 757], end: [751, 900] } as const;
const len = (k: keyof typeof SCENES) => SCENES[k][1] - SCENES[k][0];
const at = (k: keyof typeof SCENES) => SCENES[k][0] / FPS;

const HookAbs: React.FC = () => <Hook t={useAbs(0)} />;

export const Promo: React.FC = () => (
  <AbsoluteFill style={{ background: '#000', direction: 'rtl' }}>
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={len('hook')} name="Hook"><HookAbs /></TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={iris({ width: 1080, height: 1920 })} timing={linearTiming({ durationInFrames: 9 })} />
      <TransitionSeries.Sequence durationInFrames={len('main')} name="Main"><Main start={at('main')} /></TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({ direction: 'from-left' })} timing={linearTiming({ durationInFrames: 6 })} />
      <TransitionSeries.Sequence durationInFrames={len('montage')} name="Montage"><Montage start={at('montage')} /></TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 6 })} />
      <TransitionSeries.Sequence durationInFrames={len('end')} name="End"><EndCard start={at('end')} /></TransitionSeries.Sequence>
    </TransitionSeries>
    <Grain />
    <Audio src={staticFile('audio.wav')} />
  </AbsoluteFill>
);
