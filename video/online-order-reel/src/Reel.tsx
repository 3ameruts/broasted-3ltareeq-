import './fonts';
import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { Branch } from './scenes/Branch';
import { Hero } from './scenes/Hero';
import { Kitchen } from './scenes/Kitchen';
import { OrderFlow } from './scenes/OrderFlow';
import { Transmit } from './scenes/Transmit';
import TL from './timeline.json';

// The online-ordering reel: no sound track (music can be added on Instagram / TikTok when posting).
const SCENES: Record<keyof typeof TL.scenes, React.FC> = { order: OrderFlow, transmit: Transmit, branch: Branch, kitchen: Kitchen, hero: Hero };

export const Reel: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: '#000', direction: 'rtl' }}>
      {(Object.keys(TL.scenes) as (keyof typeof TL.scenes)[]).map(k => {
        const [a, b] = TL.scenes[k], S = SCENES[k];
        return <Sequence key={k} name={k} from={Math.round(a * fps)} durationInFrames={Math.round((b - a) * fps)}><S /></Sequence>;
      })}
    </AbsoluteFill>
  );
};
