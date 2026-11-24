import React from 'react';
import { AbsoluteFill, Img, random, staticFile } from 'remotion';
import { easeIn, expoOut, Night, ramp, shake } from '../lib';
import { b, C, F } from '../theme';

// 0–2.5s. A dark set, the chicken half-lit and steaming. «جوعان؟» slams in on the music, then a BITE is taken out of
// the word (crunch + crumbs). Ends pushing in, into the iris that opens the red world on the drop.
export const SLAM = b(-3), BITE = 1.453;
const BX = 180, BY = 805; // the bite point on screen (the «؟» end of the word, which is on the LEFT in RTL)

export const Hook: React.FC<{ t: number }> = ({ t }) => {
  const s = shake(t, [SLAM, BITE], 26);
  const k = expoOut(ramp(t, SLAM, SLAM + .32));
  const pre = easeIn(ramp(t, 1.95, 2.5)); // anticipation push before the drop
  const bite = expoOut(ramp(t, BITE, BITE + .07));
  // a scalloped bite: three overlapping circles cut out of the word
  const cuts = [[BX - 10, BY - 70, 78], [BX + 52, BY - 8, 70], [BX - 4, BY + 62, 74]] as const;
  const mask = cuts.map(([x, y, r]) => `radial-gradient(circle at ${x}px ${y}px, transparent ${r * bite}px, #000 ${r * bite + 1.5}px)`).join(',');
  const light = ramp(t, 0, .9, .25, .62) + .25 * Math.max(0, Math.sin(t * 2.2));
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <AbsoluteFill style={{ transform: `translate(${s.x}px, ${s.y}px) rotate(${s.r}deg) scale(${1.02 + pre * .22})` }}>
        <Night t={t} />
        {/* the hero piece, slowly lit by a warm sweep */}
        <Img src={staticFile('food/cut16.webp')} style={{ position: 'absolute', left: -60, top: 1050 - t * 18, width: 1200, transform: `scale(${1 + t * .03})`,
          filter: `brightness(${light}) saturate(1.15) drop-shadow(0 40px 60px rgba(0,0,0,.7))` }} />
        <AbsoluteFill style={{ background: `linear-gradient(105deg, transparent ${ramp(t, 0, 2.2, -30, 120) - 20}%, rgba(255,190,90,.18) ${ramp(t, 0, 2.2, -30, 120)}%, transparent ${ramp(t, 0, 2.2, -30, 120) + 20}%)`, mixBlendMode: 'screen' }} />
        <Steam t={t} />
        {/* glow behind the word */}
        <div style={{ position: 'absolute', left: 90, top: 560, width: 900, height: 500, borderRadius: '50%', background: `radial-gradient(closest-side, ${C.red}88, transparent)`, opacity: k * .9, filter: 'blur(30px)' }} />
        <AbsoluteFill style={{ WebkitMaskImage: mask, maskImage: mask, WebkitMaskComposite: 'source-in', maskComposite: 'intersect' }}>
          <div style={{ position: 'absolute', left: 0, top: 600, width: 1080, textAlign: 'center', color: '#fff', font: `900 250px/1.2 ${F.head}`,
            opacity: k, transform: `scale(${2.3 - 1.3 * k})`, filter: `blur(${(1 - k) * 22}px)`, textShadow: `0 14px 0 ${C.redDeep}, 0 30px 60px rgba(0,0,0,.6)` }}>جوعان؟</div>
        </AbsoluteFill>
        <Crumbs t={t} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Crumbs: React.FC<{ t: number }> = ({ t }) => {
  const k = t - BITE; if (k < 0 || k > 1.2) return null;
  return <>{Array.from({ length: 22 }, (_, i) => {
    const vx = -120 - random('v' + i) * 620 + (i % 5 === 0 ? 500 : 0), vy = -260 - random('u' + i) * 760, sz = 8 + random('s' + i) * 22;
    const x = BX + vx * k, y = BY + vy * k + 1600 * k * k;
    return <div key={i} style={{ position: 'absolute', left: x, top: y, width: sz, height: sz * (.6 + random('h' + i) * .5),
      borderRadius: `${40 + random('r' + i) * 30}% ${30 + random('q' + i) * 40}%`, background: i % 4 ? '#e9a640' : '#fff1d6',
      transform: `rotate(${k * 720 * (random('w' + i) - .5)}deg)`, opacity: 1 - ramp(k, .6, 1.1), boxShadow: 'inset -3px -3px 0 rgba(120,50,0,.35)' }} />;
  })}</>;
};

const Steam: React.FC<{ t: number }> = ({ t }) => <>{Array.from({ length: 6 }, (_, i) => {
  const p = ((t * .35 + i / 6) % 1);
  return <div key={i} style={{ position: 'absolute', left: 300 + i * 90 + Math.sin(t * 2 + i) * 40, top: 1300 - p * 650, width: 180, height: 260, borderRadius: '50%',
    background: 'radial-gradient(closest-side, rgba(255,255,255,.22), transparent)', filter: 'blur(18px)', opacity: Math.sin(p * Math.PI) * .8, transform: `scale(${.6 + p})` }} />;
})}</>;
