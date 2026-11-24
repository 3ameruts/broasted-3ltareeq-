import React from 'react';
import { Composition } from 'remotion';
import { Promo } from './Promo';
import TM from './timing.json';

export const Root: React.FC = () => (
  <Composition id="Promo" component={Promo} width={1080} height={1920} fps={TM.fps} durationInFrames={Math.round(TM.duration * TM.fps)} />
);
