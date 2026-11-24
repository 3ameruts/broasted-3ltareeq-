import React from 'react';
import { Composition } from 'remotion';
import { Reel } from './Reel';
import TL from './timeline.json';

export const Root: React.FC = () => (
  <Composition id="Reel" component={Reel} width={1080} height={1920} fps={TL.fps} durationInFrames={Math.round(TL.duration * TL.fps)} />
);
