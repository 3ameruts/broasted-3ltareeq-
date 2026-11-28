import { Megaphone, Sparkles } from 'lucide-react';
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { backOut, Stage } from '../fx';
import { expoOut, punch, ramp, Sheen } from '../lib';
import { b, C, F } from '../theme';

// The opening of «جديدنا!»: the teaser on a dark stage, then «جديدنا!» and «صار فيك تطلب أونلاين!» on the drop.
const DROP = b(0);
// ---------- 0–2.6s: «عنّا خبر حلو…» «جاهزين؟» ----------
export const Teaser: React.FC<{ t: number }> = ({ t }) => {
  const words = [['عنّا', .04], ['خبر', b(-4)], ['حلو...', b(-3)]] as const;
  const q = expoOut(ramp(t, b(-2), b(-2) + .3)), first = 1 - ramp(t, b(-2) - .12, b(-2));
  const push = 1 + Math.pow(ramp(t, b(-1), DROP), 3) * .35;
  return (
    <AbsoluteFill style={{ transform: `scale(${push})` }}>
      <Stage t={t} />
      <div style={{ position: 'absolute', top: 760, width: 1080, display: 'flex', justifyContent: 'center', gap: 34, opacity: first }}>
        {words.map(([w, at]) => {
          const k = backOut(ramp(t, at, at + .3), 2.2);
          return <span key={w} style={{ display: 'inline-block', color: w === 'حلو...' ? C.mustard : '#fff', font: `400 160px/1.35 ${F.fun}`, opacity: Math.min(1, k * 3),
            transform: `translateY(${(1 - k) * 80}px) scale(${.6 + .4 * k})`, textShadow: '0 16px 40px rgba(0,0,0,.6)' }}>{w}</span>;
        })}
      </div>
      {t >= b(-2) && <div style={{ position: 'absolute', top: 730, width: 1080, textAlign: 'center', color: '#fff', font: `400 200px/1.35 ${F.fun}`, opacity: q,
        transform: `scale(${(1.6 - .6 * q) * punch(t, [b(-1)], .12, 6)})`, textShadow: `0 0 60px ${C.mustard}66, 0 16px 40px rgba(0,0,0,.6)` }}>جاهزين؟</div>}
    </AbsoluteFill>
  );
};

export const Rays: React.FC<{ t: number }> = ({ t }) => (
  <div style={{ position: 'absolute', left: 540 - 1200, top: 860 - 1200, width: 2400, height: 2400, borderRadius: '50%', opacity: .13 * (1 - ramp(t, b(6), b(8))),
    background: 'repeating-conic-gradient(from 0deg, #fff 0deg 8deg, transparent 8deg 24deg)', transform: `rotate(${t * 14}deg)`, maskImage: 'radial-gradient(closest-side, #000 15%, transparent 75%)' }} />
);

export const Headline: React.FC<{ t: number }> = ({ t }) => {
  if (t > b(8.2)) return null;
  const a = backOut(ramp(t, DROP, DROP + .4), 2.6), aOut = ramp(t, b(4) - .12, b(4));
  const sub = expoOut(ramp(t, b(2), b(2) + .35));
  const l1 = backOut(ramp(t, b(4), b(4) + .38), 2), l2 = backOut(ramp(t, b(4.5), b(4.5) + .4), 2);
  const up = 0, gone = ramp(t, b(8) - .2, b(8));
  const big = { color: '#fff', textShadow: `0 10px 0 ${C.redDark}, 0 26px 50px rgba(60,0,0,.45)` };
  return (
    <AbsoluteFill>
      {t < b(4) && <div style={{ position: 'absolute', top: 640, width: 1080, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 1 - aOut, transform: `scale(${1 - aOut * .2})`, filter: `blur(${aOut * 10}px)` }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 24, padding: '6px 56px 14px', borderRadius: 50, background: C.mustard, color: C.redDeep,
          font: `400 230px/1.3 ${F.fun}`, boxShadow: `0 16px 0 ${C.brown}, 0 40px 80px rgba(60,0,0,.45)`, transform: `scale(${a}) rotate(${-5 + (1 - Math.min(a, 1)) * -20}deg)`, overflow: 'hidden' }}>
          جديدنا!<Sheen t={t} at={DROP + .45} dur={.8} />
        </div>
        <Megaphone size={150} color="#fff" strokeWidth={2.2} style={{ position: 'absolute', right: 30, top: -150, transform: `rotate(${-18 + Math.sin(t * 18) * 6 * Math.exp(-(t - DROP) * 2)}deg) scale(${a})`, filter: 'drop-shadow(0 12px 24px rgba(60,0,0,.4))' }} />
        <Sparkles size={110} color={C.mustard} style={{ position: 'absolute', left: 70, top: 330, transform: `scale(${a * (1 + Math.sin(t * 6) * .12)}) rotate(${t * 40}deg)` }} />
        <div style={{ marginTop: 70, display: 'flex', alignItems: 'center', gap: 22, opacity: sub, transform: `translateY(${(1 - sub) * 30}px)`, color: '#fff', font: `800 64px ${F.head}` }}>
          من <Img src={staticFile('brand/logo.webp')} style={{ height: 170 }} />
        </div>
      </div>}
      {t >= b(4) && <Img src={staticFile('food/cut16.webp')} style={{ position: 'absolute', left: 40, top: 960, width: 1000, opacity: 1 - gone, transformOrigin: '50% 40%',
        transform: `scale(${backOut(ramp(t, b(4), b(4) + .6), 1.6) * (1 + ramp(t, b(4.6), b(8)) * .12)}) rotate(${(1 - Math.min(1, ramp(t, b(4), b(4) + .6))) * -25 + Math.sin(t * 1.5) * 2}deg)`,
        filter: `drop-shadow(0 40px 50px rgba(60,0,0,.5)) blur(${gone * 10}px)` }} />}
      {t >= b(4) && <div style={{ position: 'absolute', inset: 0, opacity: 1 - gone, filter: `blur(${gone * 12}px)`, transform: `translateY(${-500 * up}px) scale(${1 - .45 * up})`, transformOrigin: '50% 860px' }}>
        <div style={{ position: 'absolute', top: 300, width: 1080, textAlign: 'center', font: `400 150px/1.3 ${F.fun}`, whiteSpace: 'nowrap', ...big, opacity: Math.min(1, l1 * 2), transform: `translateY(${(1 - l1) * -100}px)` }}>صار فيك تطلب</div>
        <div style={{ position: 'absolute', top: 505, width: 1080, display: 'flex', justifyContent: 'center', opacity: Math.min(1, l2 * 2), transform: `scale(${.4 + .6 * l2}) rotate(${(1 - l2) * 8 - 2}deg)` }}>
          <div style={{ position: 'relative', padding: '0 50px', borderRadius: 44, background: C.mustard, color: C.redDeep, font: `400 220px/1.3 ${F.fun}`, boxShadow: `0 14px 0 ${C.brown}, 0 30px 60px rgba(60,0,0,.4)`, overflow: 'hidden' }}>
            أونلاين!<Sheen t={t} at={b(5)} />
          </div>
        </div>
      </div>}
    </AbsoluteFill>
  );
};

