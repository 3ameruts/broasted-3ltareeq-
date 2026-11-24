import './fonts';
import { Banknote, Bike, BookOpen, Flame, MapPin, Megaphone, Sparkles, Globe } from 'lucide-react';
import React from 'react';
import { AbsoluteFill, Audio, Img, staticFile, useCurrentFrame } from 'remotion';
import { PH, Phone, PW, Shot, SW } from './devices';
import { backOut, Confetti, io, Stage, Sticker } from './fx';
import { expoOut, Grain, punch, ramp, RedWorld, shake, Sheen } from './lib';
import { b, BEAT, C, F, FPS } from './theme';

// «جديدنا!» — the launch announcement for online ordering (24.5s). A teaser on a dark stage, the drop with confetti,
// «صار فيك تطلب أونلاين!», the phone spins in and five features slap on as stickers, a food flash, the end card.
// Every hit is on the music's beat grid: b(n), the drop = 2.6s.
const DROP = b(0);
const FEATS = [
  { at: b(8), icon: BookOpen, text: 'المنيو كامل بالصور والأسعار', rot: -3, screen: 'menu' },
  { at: b(12), icon: Flame, text: 'حار، عادي… أو قسّمها على كيفك', rot: 2.5, screen: 'ui/05-split.png' },
  { at: b(16), icon: Bike, text: 'توصيل أو استلام من الفرع', rot: -2.5, screen: 'ui/08-checkout.png' },
  { at: b(20), icon: Banknote, text: 'الدفع عند الاستلام: كاش أو كليك', rot: 3, screen: 'ui/01-menu.png' },
  { at: b(24), icon: MapPin, text: 'وتابع طلبك لحظة بلحظة', rot: -2, screen: 'ui/13-tracking.png' },
];
const FOOD_AT = b(28), END_AT = b(32);

export const Launch: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const s = shake(t, [DROP, b(4), END_AT], 20);
  return (
    <AbsoluteFill style={{ background: '#000', direction: 'rtl' }}>
      <AbsoluteFill style={{ transform: `translate(${s.x}px, ${s.y}px) rotate(${s.r}deg)` }}>
        {t < DROP ? <Teaser t={t} /> : t < FOOD_AT ? <Show t={t} /> : t < END_AT ? <FoodFlash t={t} /> : <End t={t} />}
      </AbsoluteFill>
      {/* the white flash on the drop */}
      <AbsoluteFill style={{ background: '#fff', opacity: Math.max(0, 1 - Math.abs(t - DROP) / .1) * .85, pointerEvents: 'none' }} />
      <Grain />
      <Audio src={staticFile('audio.wav')} />
    </AbsoluteFill>
  );
};

// ---------- 0–2.6s: «عنّا خبر حلو…» «جاهزين؟» ----------
const Teaser: React.FC<{ t: number }> = ({ t }) => {
  const words = [['عنّا', .04], ['خبر', b(-4)], ['حلو…', b(-3)]] as const;
  const q = expoOut(ramp(t, b(-2), b(-2) + .3)), first = 1 - ramp(t, b(-2) - .12, b(-2));
  const push = 1 + Math.pow(ramp(t, b(-1), DROP), 3) * .35;
  return (
    <AbsoluteFill style={{ transform: `scale(${push})` }}>
      <Stage t={t} />
      <div style={{ position: 'absolute', top: 760, width: 1080, display: 'flex', justifyContent: 'center', gap: 34, opacity: first }}>
        {words.map(([w, at]) => {
          const k = backOut(ramp(t, at, at + .3), 2.2);
          return <span key={w} style={{ display: 'inline-block', color: w === 'حلو…' ? C.mustard : '#fff', font: `900 150px/1.2 ${F.head}`, opacity: Math.min(1, k * 3),
            transform: `translateY(${(1 - k) * 80}px) scale(${.6 + .4 * k})`, textShadow: '0 16px 40px rgba(0,0,0,.6)' }}>{w}</span>;
        })}
      </div>
      {t >= b(-2) && <div style={{ position: 'absolute', top: 730, width: 1080, textAlign: 'center', color: '#fff', font: `900 190px/1.2 ${F.head}`, opacity: q,
        transform: `scale(${(1.6 - .6 * q) * punch(t, [b(-1)], .12, 6)})`, textShadow: `0 0 60px ${C.mustard}66, 0 16px 40px rgba(0,0,0,.6)` }}>جاهزين؟</div>}
    </AbsoluteFill>
  );
};

// ---------- 2.6–17.9s: the drop, «صار فيك تطلب أونلاين!», the phone and the feature stickers ----------
const Show: React.FC<{ t: number }> = ({ t }) => (
  <AbsoluteFill style={{ transform: `scale(${punch(t, [DROP, b(2), b(4), b(4.5)], .035)})` }}>
    <RedWorld t={t} />
    <Rays t={t} />
    <Headline t={t} />
    <PhoneSpin t={t} />
    {FEATS.map((f, i) => {
      const I = f.icon, end = i < FEATS.length - 1 ? FEATS[i + 1].at - .05 : FOOD_AT;
      return <div key={i} style={{ position: 'absolute', top: 285, left: 0, width: 1080, display: 'flex', justifyContent: 'center' }}>
        <Sticker t={t} at={f.at} end={end} rot={f.rot}>
          <span style={{ display: 'grid', placeItems: 'center', width: 88, height: 88, borderRadius: 26, background: C.red, color: '#fff', flex: 'none' }}><I size={50} /></span>
          <span style={{ whiteSpace: 'nowrap', fontSize: f.text.length > 26 ? 50 : 58 }}>{f.text}</span>
        </Sticker>
      </div>;
    })}
    <Confetti t={t} at={DROP} x={80} y={1950} spread={.7} power={1.25} seed="l" n={70} />
    <Confetti t={t} at={DROP} x={1000} y={1950} spread={.7} power={1.25} seed="r" n={70} />
    <Confetti t={t} at={b(4.5)} x={540} y={-80} spread={2.2} power={.35} seed="t" n={60} up={1} />
  </AbsoluteFill>
);

const Rays: React.FC<{ t: number }> = ({ t }) => (
  <div style={{ position: 'absolute', left: 540 - 1200, top: 860 - 1200, width: 2400, height: 2400, borderRadius: '50%', opacity: .13 * (1 - ramp(t, b(6), b(8))),
    background: 'repeating-conic-gradient(from 0deg, #fff 0deg 8deg, transparent 8deg 24deg)', transform: `rotate(${t * 14}deg)`, maskImage: 'radial-gradient(closest-side, #000 15%, transparent 75%)' }} />
);

const Headline: React.FC<{ t: number }> = ({ t }) => {
  if (t > b(8)) return null;
  const a = backOut(ramp(t, DROP, DROP + .4), 2.6), aOut = ramp(t, b(4) - .12, b(4));
  const sub = expoOut(ramp(t, b(2), b(2) + .35));
  const l1 = backOut(ramp(t, b(4), b(4) + .38), 2), l2 = backOut(ramp(t, b(4.5), b(4.5) + .4), 2);
  const up = io(ramp(t, b(6), b(6) + .6)), gone = ramp(t, b(8) - .2, b(8));
  const big = { color: '#fff', textShadow: `0 10px 0 ${C.redDark}, 0 26px 50px rgba(60,0,0,.45)` };
  return (
    <AbsoluteFill>
      {t < b(4) && <div style={{ position: 'absolute', top: 640, width: 1080, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 1 - aOut, transform: `scale(${1 - aOut * .2})`, filter: `blur(${aOut * 10}px)` }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 24, padding: '6px 56px 14px', borderRadius: 50, background: C.mustard, color: C.redDeep,
          font: `900 220px/1.15 ${F.head}`, boxShadow: `0 16px 0 ${C.brown}, 0 40px 80px rgba(60,0,0,.45)`, transform: `scale(${a}) rotate(${-5 + (1 - Math.min(a, 1)) * -20}deg)`, overflow: 'hidden' }}>
          جديدنا!<Sheen t={t} at={DROP + .45} dur={.8} />
        </div>
        <Megaphone size={150} color="#fff" strokeWidth={2.2} style={{ position: 'absolute', right: 30, top: -150, transform: `rotate(${-18 + Math.sin(t * 18) * 6 * Math.exp(-(t - DROP) * 2)}deg) scale(${a})`, filter: 'drop-shadow(0 12px 24px rgba(60,0,0,.4))' }} />
        <Sparkles size={110} color={C.mustard} style={{ position: 'absolute', left: 70, top: 330, transform: `scale(${a * (1 + Math.sin(t * 6) * .12)}) rotate(${t * 40}deg)` }} />
        <div style={{ marginTop: 70, display: 'flex', alignItems: 'center', gap: 22, opacity: sub, transform: `translateY(${(1 - sub) * 30}px)`, color: '#fff', font: `800 64px ${F.head}` }}>
          من <Img src={staticFile('brand/logo.webp')} style={{ height: 170 }} />
        </div>
      </div>}
      {t >= b(4) && <div style={{ position: 'absolute', inset: 0, opacity: 1 - gone, filter: `blur(${gone * 12}px)`, transform: `translateY(${-500 * up}px) scale(${1 - .45 * up})`, transformOrigin: '50% 860px' }}>
        <div style={{ position: 'absolute', top: 680, width: 1080, textAlign: 'center', font: `900 138px/1.15 ${F.head}`, whiteSpace: 'nowrap', ...big, opacity: Math.min(1, l1 * 2), transform: `translateY(${(1 - l1) * -100}px)` }}>صار فيك تطلب</div>
        <div style={{ position: 'absolute', top: 860, width: 1080, display: 'flex', justifyContent: 'center', opacity: Math.min(1, l2 * 2), transform: `scale(${.4 + .6 * l2}) rotate(${(1 - l2) * 8 - 2}deg)` }}>
          <div style={{ position: 'relative', padding: '0 50px', borderRadius: 44, background: C.mustard, color: C.redDeep, font: `900 210px/1.25 ${F.head}`, boxShadow: `0 14px 0 ${C.brown}, 0 30px 60px rgba(60,0,0,.4)`, overflow: 'hidden' }}>
            أونلاين!<Sheen t={t} at={b(5)} />
          </div>
        </div>
      </div>}
    </AbsoluteFill>
  );
};

// the phone spins in (a full turn in 3D) and then sways from feature to feature
const PhoneSpin: React.FC<{ t: number }> = ({ t }) => {
  if (t < b(6)) return null;
  const k = expoOut(ramp(t, b(6), b(8))), sway = FEATS.reduce((m, f, i) => (t >= f.at - .1 ? (i % 2 ? 1 : -1) : m), -1);
  const swayK = FEATS.reduce((v, f) => (t >= f.at - .1 ? io(ramp(t, f.at - .1, f.at + .35)) : v), 1);
  const prev = -sway, ry = (1 - k) * 360 + (prev + (sway - prev) * swayK) * 11 + Math.sin(t * 1.4) * 2;
  const hop = FEATS.reduce((m, f) => m + (t >= f.at ? Math.exp(-(t - f.at) * 7) * Math.sin((t - f.at) * 18) * 14 : 0), 0);
  return (
    <div style={{ position: 'absolute', inset: 0, perspective: 2400 }}>
      <div style={{ position: 'absolute', left: (1080 - PW) / 2, top: 560 + (1 - k) * 1300 + hop, width: PW, height: PH, transformOrigin: '50% 30%',
        transform: `scale(${.62 + .16 * k}) rotateY(${ry}deg) rotateX(${(1 - k) * 30 + 4}deg) rotateZ(${(1 - k) * -20}deg)` }}>
        <div style={{ position: 'absolute', left: 40, top: 60, width: PW - 80, height: PH - 40, borderRadius: 90, background: 'rgba(60,0,0,.55)', filter: 'blur(40px)', transform: 'translate(30px, 50px)' }} />
        <Phone><Screens t={t} /></Phone>
      </div>
    </div>
  );
};
const Screens: React.FC<{ t: number }> = ({ t }) => {
  const menuScroll = ramp(t, b(8) + .2, FEATS[1].at - .1, 0, 1500, io);
  return <>{FEATS.map((f, i) => {
    const show = i === 0 ? 1 : 1 - easeIn(ramp(t, f.at - .12, f.at + .18));
    if (i > 0 && t < f.at - .12) return null;
    return <div key={i} style={{ position: 'absolute', inset: 0, transform: `translateX(${i === 0 ? 0 : show * -SW}px)` }}>
      {f.screen === 'menu' ? <div style={{ position: 'absolute', inset: 0, transform: `translateY(${-menuScroll}px)` }}><Shot src="ui/01-menu-full.png" /></div> : <Shot src={f.screen} />}
    </div>;
  })}</>;
};
const easeIn = (x: number) => 1 - Math.pow(1 - x, 3);

// ---------- 17.9–20.0s: four food hits, one per beat ----------
const FOOD = ['k16', 'k20', 'k11', 'k15'];
const FoodFlash: React.FC<{ t: number }> = ({ t }) => {
  const i = Math.min(3, Math.floor((t - FOOD_AT) / BEAT)), local = t - FOOD_AT - i * BEAT;
  const z = 1.18 - local * .22, w = expoOut(ramp(t, FOOD_AT + .05, FOOD_AT + .4));
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#000' }}>
      <Img src={staticFile(`food/${FOOD[i]}.jpg`)} style={{ position: 'absolute', height: 1920, left: '50%', top: 0, transform: `translateX(-50%) scale(${z}) rotate(${(i % 2 ? 1 : -1) * 2}deg)` }} />
      <AbsoluteFill style={{ background: 'radial-gradient(110% 75% at 50% 52%, transparent 45%, rgba(70,10,0,.55) 100%)' }} />
      <AbsoluteFill style={{ background: '#fff', opacity: Math.max(0, 1 - local / .08) * .5 }} />
      <div style={{ position: 'absolute', top: 300, width: 1080, display: 'flex', justifyContent: 'center' }}>
        <div style={{ padding: '0 44px', borderRadius: 36, background: C.red, color: '#fff', font: `900 150px/1.25 ${F.head}`, boxShadow: `0 12px 0 ${C.redDark}`,
          clipPath: `inset(0 0 0 ${(1 - w) * 100}%)`, transform: `scale(${punch(t, [FOOD_AT + BEAT, FOOD_AT + BEAT * 2, FOOD_AT + BEAT * 3], .06)})` }}>وكله فريش!</div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- 20.0–24.5s: the end card ----------
const End: React.FC<{ t: number }> = ({ t }) => {
  const logo = backOut(ramp(t, END_AT, END_AT + .55), 2.2), badge = backOut(ramp(t, b(33), b(33) + .35), 3);
  const cta = backOut(ramp(t, b(34), b(34) + .4), 2), url = backOut(ramp(t, b(35), b(35) + .4), 1.8), info = expoOut(ramp(t, b(36), b(36) + .4));
  return (
    <AbsoluteFill>
      <RedWorld t={t} />
      <Rays t={t - 20} />
      <div style={{ position: 'absolute', left: 130, top: 540 + Math.sin(t * 1.5) * 6, width: 820, transform: `scale(${logo}) rotate(${(1 - Math.min(logo, 1)) * -12}deg)` }}>
        <div style={{ position: 'relative', overflow: 'hidden' }}>
          <Img src={staticFile('brand/logo.webp')} style={{ width: 820, filter: 'drop-shadow(0 24px 40px rgba(60,0,0,.5))' }} /><Sheen t={t} at={END_AT + .5} dur={.9} />
        </div>
        <div style={{ position: 'absolute', right: -24, top: -40, padding: '8px 30px 14px', borderRadius: 30, background: C.mustard, color: C.redDeep, font: `900 70px/1.1 ${F.head}`, border: '7px solid #fff',
          boxShadow: '0 14px 30px rgba(60,0,0,.4)', transform: `scale(${badge}) rotate(${12 + (1 - Math.min(badge, 1)) * 30}deg)`, opacity: Math.min(1, badge * 3) }}>جديد</div>
      </div>
      <div style={{ position: 'absolute', top: 1080, width: 1080, textAlign: 'center', color: '#fff', font: `900 124px/1.2 ${F.head}`, textShadow: `0 10px 0 ${C.redDark}, 0 26px 50px rgba(60,0,0,.45)`,
        opacity: Math.min(1, cta * 2), transform: `scale(${.4 + .6 * cta})` }}>اطلب أونلاين هلأ!</div>
      <div style={{ position: 'absolute', top: 1265, width: 1080, display: 'flex', justifyContent: 'center', opacity: Math.min(1, url * 2), transform: `translateY(${(1 - url) * 50}px)` }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 16, padding: '18px 38px', borderRadius: 50, background: '#fff', color: C.redDeep, font: `700 46px ${F.num}`, boxShadow: '0 18px 44px rgba(60,0,0,.4)', overflow: 'hidden' }}>
          <Globe size={44} /><span style={{ direction: 'ltr' }}>order.broasted3ltareeq.com</span><Sheen t={t} at={b(35) + .5} dur={.8} />
        </div>
      </div>
      <div style={{ position: 'absolute', top: 1410, width: 1080, textAlign: 'center', color: C.cream, font: `700 44px ${F.body}`, opacity: info, transform: `translateY(${(1 - info) * 24}px)` }}>توصيل أو استلام من الفرع</div>
      <Confetti t={t} at={END_AT} x={540} y={-80} spread={2.4} power={.4} seed="e" n={90} up={1} />
      <Confetti t={t} at={END_AT} x={60} y={1950} spread={.6} power={1.1} seed="el" n={40} />
      <Confetti t={t} at={END_AT} x={1020} y={1950} spread={.6} power={1.1} seed="er" n={40} />
    </AbsoluteFill>
  );
};
