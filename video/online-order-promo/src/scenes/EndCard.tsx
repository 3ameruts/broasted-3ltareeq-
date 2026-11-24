import { getLength } from '@remotion/paths';
import { Globe } from 'lucide-react';
import { Tap } from '../devices';
import React, { useMemo } from 'react';
import { AbsoluteFill, Img, random, staticFile } from 'remotion';
import { expoOut, punch, ramp, RedWorld, shake, Sheen, useAbs } from '../lib';
import { b, C, F } from '../theme';
import LOGO from '../logo-line.json';

// 25.0–30s. The logo draws itself as line art (the potrace vector of the real logo), fills in with a shockwave,
// then «اطلب هلأ!», the link (tapped) and delivery/pickup. Lives until the last frame so it works as a loop and a thumbnail.
const DRAW = b(36), FILL = b(37.5), CTA = b(38), URL = b(39), INFO = b(40), TAP = b(40.5);
const backOut = (x: number, s = 1.8) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
const LW = 820, LH = LW * 413 / 700, LX = (1080 - LW) / 2, LY = 560;

export const EndCard: React.FC<{ start: number }> = ({ start }) => {
  const t = useAbs(start);
  const lens = useMemo(() => LOGO.paths.map(d => getLength(d)), []);
  const fill = expoOut(ramp(t, FILL, FILL + .45)), s = shake(t, [FILL], 16);
  const cta = backOut(ramp(t, CTA, CTA + .45), 2), url = backOut(ramp(t, URL, URL + .45), 1.8), info = expoOut(ramp(t, INFO, INFO + .4));
  const press = t > TAP && t < TAP + .25 ? 1 - Math.sin((t - TAP) / .25 * Math.PI) * .06 : 1;
  const ring = ramp(t, FILL, FILL + 1.1);
  return (
    <AbsoluteFill style={{ background: C.redDeep }}>
      <AbsoluteFill style={{ transform: `translate(${s.x}px, ${s.y}px)` }}>
        <RedWorld t={t} />
        {/* slow light rays behind the logo */}
        <div style={{ position: 'absolute', left: 540 - 1100, top: LY + LH / 2 - 1100, width: 2200, height: 2200, borderRadius: '50%', opacity: .16 * ramp(t, DRAW, FILL),
          background: 'repeating-conic-gradient(from 0deg, #fff 0deg 7deg, transparent 7deg 22deg)', transform: `rotate(${t * 9}deg)`, maskImage: 'radial-gradient(closest-side, #000 20%, transparent 75%)' }} />
        <div style={{ position: 'absolute', left: 540 - 260, top: LY + LH / 2 - 260, width: 520, height: 520, borderRadius: 260, border: `8px solid ${C.mustard}`, opacity: ring > 0 && ring < 1 ? 1 - ring : 0, transform: `scale(${.4 + ring * 2.6})` }} />
        {/* line art, drawn path by path */}
        <svg viewBox={LOGO.viewBox} style={{ position: 'absolute', left: LX, top: LY + Math.sin(t * 1.4) * 6, width: LW, height: LH, opacity: 1 - ramp(t, FILL + .05, FILL + .3), overflow: 'visible' }}>
          <g transform={LOGO.transform}>
            {LOGO.paths.map((d, i) => {
              const a = DRAW + random('d' + i) * .45, k = ramp(t, a, a + .6, 0, 1, x => 1 - Math.pow(1 - x, 2));
              return <path key={i} d={d} fill="none" stroke={i % 3 ? '#fff' : C.mustard} strokeWidth={70} strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray={`${lens[i]} ${lens[i]}`} strokeDashoffset={lens[i] * (1 - k)} style={{ filter: `drop-shadow(0 0 60px ${C.mustard})` }} />;
            })}
          </g>
        </svg>
        <div style={{ position: 'absolute', left: LX, top: LY + Math.sin(t * 1.4) * 6, width: LW, height: LH, opacity: fill, transform: `scale(${(1.12 - .12 * fill) * punch(t, [CTA], .03)})`, overflow: 'hidden' }}>
          <Img src={staticFile('brand/logo.webp')} style={{ width: LW, filter: 'drop-shadow(0 24px 40px rgba(60,0,0,.5))' }} />
          <Sheen t={t} at={FILL + .25} dur={.9} />
        </div>
        <div style={{ position: 'absolute', top: 1110, width: 1080, textAlign: 'center', color: '#fff', font: `900 150px/1.15 ${F.head}`, textShadow: `0 10px 0 ${C.redDark}, 0 26px 50px rgba(60,0,0,.45)`,
          opacity: Math.min(1, cta * 2), transform: `scale(${.4 + .6 * cta})` }}>اطلب هلأ!</div>
        <div style={{ position: 'absolute', top: 1300, width: 1080, display: 'flex', justifyContent: 'center', opacity: Math.min(1, url * 2), transform: `translateY(${(1 - url) * 50}px) scale(${press})` }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16, padding: '18px 38px', borderRadius: 50, background: '#fff', color: C.redDeep, font: `700 46px ${F.num}`, boxShadow: '0 18px 44px rgba(60,0,0,.4)', overflow: 'hidden' }}>
            <Globe size={44} /><span style={{ direction: 'ltr' }}>order.broasted3ltareeq.com</span><Sheen t={t} at={URL + .5} dur={.8} />
          </div>
          <Tap t={t} at={TAP} x={540 + 170} y={52} />
        </div>
        <div style={{ position: 'absolute', top: 1440, width: 1080, textAlign: 'center', color: C.cream, font: `700 44px ${F.body}`, opacity: info, transform: `translateY(${(1 - info) * 24}px)` }}>
          توصيل أو استلام من الفرع
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

