import React from 'react';
import { Composition } from 'remotion';
import { Launch } from './Launch';
import TM from './timing.json';

export const Root: React.FC = () => (
  <Composition id="Launch" component={Launch} width={1080} height={1920} fps={TM.fps} durationInFrames={Math.round(TM.duration * TM.fps)} />
);
