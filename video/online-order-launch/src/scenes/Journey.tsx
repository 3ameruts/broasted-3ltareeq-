import { Check, Flame, Send } from 'lucide-react';
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { PH, Phone, PW, SH, Shot, SW, Tap } from '../devices';
import { backOut, Confetti, io } from '../fx';
import { easeOut, expoOut, punch, ramp, RedWorld } from '../lib';
import { Cream } from '../reel/lib';
import { b, C, F } from '../theme';
import { Headline, Rays } from './Open';
import taps from '../../public/ui/taps.json';

// 2.6–15.7s. The drop («جديدنا!», «صار فيك تطلب أونلاين!») on red; the phone spins in, the world wipes to the cream studio
// and the phone walks through a REAL order, one step every bar, each step slapped on as a numbered sticker:
// menu → meal → split hot/regular → cart → details → code → «انبعت الطلب».
const DROP = b(0), WIPE = b(8), SENT = b(22) + .05;
const FULL_W = 975, SCROLL_END = Math.round(taps.scrollY * 2.5 * SW / FULL_W), STICKY = Math.round(300 * SW / FULL_W);
type Scr = { at: number; src: string; how: 'cut' | 'fade' | 'sheet' | 'scroll' | 'close' };
const SCREENS: Scr[] = [
  { at: 0, src: 'ui/01-menu.png', how: 'cut' },
  { at: b(8.4), src: 'menu-scroll', how: 'cut' },
  { at: b(10) + .1, src: 'ui/03-sheet.png', how: 'sheet' },
  { at: b(11) + .1, src: 'ui/04-sheet-spice.png', how: 'scroll' },
  { at: b(12) + .1, src: 'ui/05-split.png', how: 'fade' },
  { at: b(16) + .1, src: 'ui/06-added.png', how: 'close' },
  { at: b(17) + .1, src: 'ui/07-cart.png', how: 'sheet' },
  { at: b(18) + .1, src: 'ui/08-checkout.png', how: 'fade' },
  { at: b(20) + .1, src: 'ui/10-code.png', how: 'sheet' },
  { at: b(21) + .1, src: 'ui/11-code-typing.png', how: 'cut' },
  { at: b(21.5), src: 'ui/12-code-done.png', how: 'cut' },
];
export const TAPS: [number, { x: number; y: number }][] = [[b(10), taps.item], [b(12), taps.split], [b(16), taps.add], [b(17), taps.cart], [b(18), taps.next], [b(20), taps.confirm], [b(22) - .1, taps.code]];
export const STEPS: [number, string][] = [[b(8), 'تصفّح المنيو'], [b(10), 'اختار وجبتك'], [b(12), 'حار ولا عادي؟ أو قسّمها!'], [b(16), 'ضيفها للسلة'], [b(18), 'اسمك وعنوانك'], [b(20), 'أكّد طلبك بالكود']];
export const J = { DROP, WIPE, SENT, flip0: b(13), flipStep: .136, counters: b(15), wa: b(20.5) };

export const Journey: React.FC<{ t: number }> = ({ t }) => {
  const wipe = expoOut(ramp(t, WIPE, WIPE + .5));
  return (
    <AbsoluteFill style={{ transform: `scale(${punch(t, [DROP, b(2), b(4), b(4.5)], .035)})` }}>
      <RedWorld t={t} />
      <Rays t={t} />
      {wipe > 0 && <AbsoluteFill style={{ clipPath: `circle(${wipe * 1500}px at 540px 980px)` }}><Cream /></AbsoluteFill>}
      <Headline t={t} />
      <PhoneRig t={t} />
      <Steps t={t} />
      <SplitCallout t={t} />
      <Chips t={t} />
      <Confetti t={t} at={DROP} x={80} y={1950} spread={.7} power={1.25} seed="l" n={70} />
      <Confetti t={t} at={DROP} x={1000} y={1950} spread={.7} power={1.25} seed="r" n={70} />
      <Confetti t={t} at={b(4.5)} x={540} y={-80} spread={2.2} power={.35} seed="t" n={60} up={1} />
      <Confetti t={t} at={SENT} x={540} y={900} spread={2.6} power={.75} seed="s" n={80} />
    </AbsoluteFill>
  );
};

// the phone: spins in on the drop world, grows into the studio, walks the order, pulls back when it's sent
const PhoneRig: React.FC<{ t: number }> = ({ t }) => {
  if (t < b(6)) return null;
  const k = expoOut(ramp(t, b(6), b(8))), g = io(ramp(t, WIPE, WIPE + .65)), back = io(ramp(t, SENT + .2, SENT + .9));
  const top = 560 + (1 - k) * 1300 + (345 - 560) * g + back * 110, sc = (.62 + .16 * k) + (.94 - .78) * g - back * .14;
  const ry = (1 - k) * 360 + Math.sin(t * 1.4) * 2 * (1 - g * .6), rx = (1 - k) * 30 + 4 - g * 4 + back * 10;
  const glow = ramp(t, SENT, SENT + .3) * (1 - ramp(t, SENT + .9, SENT + 1.3));
  return (
    <div style={{ position: 'absolute', inset: 0, perspective: 2400 }}>
      <div style={{ position: 'absolute', left: (1080 - PW) / 2, top, width: PW, height: PH, transformOrigin: '50% 30%', transform: `scale(${sc}) rotateY(${ry}deg) rotateX(${rx}deg) rotateZ(${(1 - k) * -20}deg)` }}>
        <div style={{ position: 'absolute', left: 40, top: 60, width: PW - 80, height: PH - 40, borderRadius: 90, background: `rgba(${g > .5 ? '120,40,10,.35' : '60,0,0,.55'})`, filter: 'blur(40px)', transform: 'translate(30px, 50px)' }} />
        <Phone glow={glow}><Screens t={t} /></Phone>
      </div>
    </div>
  );
};

const Screens: React.FC<{ t: number }> = ({ t }) => {
  const cur = SCREENS.reduce((a, s, i) => (t >= s.at ? i : a), 0);
  const scrollP = ramp(t, b(8.4) + .05, b(9.8)), scrollY = io(scrollP) * SCROLL_END;
  const sent = ramp(t, SENT, SENT + .35);
  return (
    <>
      {SCREENS.map((s, i) => {
        if (i !== cur && i !== cur - 1) return null;
        const nxt = SCREENS[cur], p = easeOut(ramp(t, nxt.at, nxt.at + .28));
        let o = 1, y = 0, z = i === cur ? 2 : 1;
        if (i === cur) { o = s.how === 'fade' || s.how === 'sheet' ? p : 1; y = s.how === 'scroll' ? (1 - p) * 100 : s.how === 'sheet' ? (1 - p) * 10 : 0; }
        else { y = nxt.how === 'scroll' ? -p * 100 : nxt.how === 'close' ? p * 100 : 0; if (nxt.how === 'close') z = 3; if (p >= 1) o = 0; }
        return (
          <div key={i} style={{ position: 'absolute', inset: 0, opacity: o, transform: `translateY(${y}%)`, zIndex: z, background: C.cream }}>
            {s.src === 'menu-scroll' ? (
              <>
                <Img src={staticFile('ui/01-menu-full.png')} style={{ position: 'absolute', left: 0, top: -scrollY, width: SW, filter: `blur(${Math.sin(Math.PI * scrollP) * 5}px)` }} />
                {scrollY > SCROLL_END * .8 && <div style={{ position: 'absolute', left: 0, top: 0, width: SW, height: STICKY, overflow: 'hidden' }}><Img src={staticFile('ui/02-menu-item.png')} style={{ width: SW }} /></div>}
              </>
            ) : <Shot src={s.src} />}
          </div>
        );
      })}
      {TAPS.map(([at, q], i) => <Tap key={i} t={t} at={at} x={q.x * SW} y={q.y * SH} />)}
      <WaCode t={t} />
      {/* sent */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 27, display: 'grid', placeItems: 'center', background: `rgba(178,16,23,${.92 * sent})`, opacity: sent }}>
        <div style={{ textAlign: 'center', color: '#fff', transform: `scale(${.6 + .4 * expoOut(sent)})` }}>
          <div style={{ width: 170, height: 170, margin: '0 auto 30px', borderRadius: 85, background: '#fff', color: C.red, display: 'grid', placeItems: 'center' }}><Send size={84} /></div>
          <div style={{ font: `900 64px ${F.head}` }}>انبعت الطلب</div>
          <div style={{ font: `700 42px ${F.num}`, opacity: .85 }}>#77</div>
        </div>
      </div>
    </>
  );
};

// the verification code arrives (the real message text)
const WaCode: React.FC<{ t: number }> = ({ t }) => {
  const k = backOut(ramp(t, J.wa, J.wa + .45), 1.6), out = easeOut(ramp(t, b(21.7), b(21.7) + .3));
  if (k <= 0 || out >= 1) return null;
  return (
    <div style={{ position: 'absolute', left: 18, right: 18, top: 78, zIndex: 26, display: 'flex', gap: 16, alignItems: 'center', padding: '18px 20px', borderRadius: 30,
      background: 'rgba(250,250,250,.97)', boxShadow: '0 18px 40px rgba(0,0,0,.28)', transform: `translateY(${(1 - k) * -220 - out * 220}px)`, opacity: Math.min(1, k * 2) * (1 - out) }}>
      <span style={{ display: 'grid', placeItems: 'center', width: 64, height: 64, borderRadius: 18, background: '#25d366', flex: 'none' }}>
        <svg width="38" height="38" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20Z" /></svg>
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', font: `600 22px ${F.body}`, color: '#6b6b6b' }}><span>بروستد عالطريق</span><span>الآن</span></div>
        <div style={{ font: `700 26px ${F.body}`, color: '#111' }}><span style={{ font: `900 28px ${F.num}`, letterSpacing: 2 }}>482913</span> هو كود التحقق الخاص بك.</div>
      </div>
    </div>
  );
};

// numbered step stickers: slap on with each step, peel off at the next
const Steps: React.FC<{ t: number }> = ({ t }) => <>{STEPS.map(([at, label], i) => {
  const end = i < STEPS.length - 1 ? STEPS[i + 1][0] - .04 : SENT;
  if (t < at || t > end + .25) return null;
  const k = ramp(t, at, at + .32), s = backOut(k, 2.4), off = ramp(t, end - .02, end + .2), rot = i % 2 ? 2.5 : -2.5;
  const done = i === STEPS.length - 1 && t > b(21.5);
  return (
    <div key={i} style={{ position: 'absolute', top: 236, left: 0, width: 1080, display: 'flex', justifyContent: 'center', zIndex: 6 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 18, padding: '12px 30px 12px 22px', borderRadius: 34, background: '#fff', border: '7px solid #fff',
        boxShadow: '0 20px 44px rgba(120,30,10,.28)', font: `900 52px/1.2 ${F.head}`, color: C.ink, whiteSpace: 'nowrap', opacity: Math.min(1, k * 4) * (1 - off),
        transform: `translate(${off * -480}px, ${off * -200}px) scale(${(1.7 - .7 * Math.min(s, 1.15)) * (1 - off * .3)}) rotate(${rot + (1 - k) * 12 - off * 30}deg)` }}>
        <span style={{ display: 'grid', placeItems: 'center', width: 70, height: 70, borderRadius: 35, background: done ? C.ok : C.red, color: '#fff', font: `900 42px/1 ${F.num}`, flex: 'none' }}>
          {done ? <Check size={44} strokeWidth={3.2} /> : i + 1}</span>
        {label}
      </div>
    </div>
  );
})}</>;

// the split, called out big beside the phone: 12 pieces, 8 turn hot one by one
const SplitCallout: React.FC<{ t: number }> = ({ t }) => {
  const a = b(12) + .25, e = b(16) - .15;
  if (t < a || t > e + .3) return null;
  const k = backOut(ramp(t, a, a + .45), 2), out = ramp(t, e, e + .25), hot = Array.from({ length: 8 }, (_, i) => t >= J.flip0 + i * J.flipStep).filter(Boolean).length;
  return (
    <div style={{ position: 'absolute', right: 26, top: 560, zIndex: 7, padding: '24px 26px', borderRadius: 38, background: '#fff', boxShadow: '0 28px 70px rgba(120,30,10,.32)', textAlign: 'center',
      opacity: Math.min(1, k * 2) * (1 - out), transform: `scale(${(.3 + .7 * k) * (1 - out * .4)}) rotate(${4 - (1 - Math.min(k, 1)) * 12}deg)`, transformOrigin: '80% 20%' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 58px)', gap: 12, justifyContent: 'center' }}>
        {Array.from({ length: 12 }, (_, i) => {
          const at = J.flip0 + i * J.flipStep, on = i < 8 && t >= at, pop = i < 8 ? punch(t, [at], .4, 10) : 1;
          return <span key={i} style={{ display: 'grid', placeItems: 'center', width: 58, height: 58, borderRadius: 29, background: on ? C.red : '#fde7a6', color: on ? '#fff' : '#b07a00',
            boxShadow: on ? `0 6px 14px ${C.red}66` : 'inset 0 0 0 3px #f6c64a', transform: `scale(${pop})` }}>{on ? <Flame size={32} strokeWidth={2.6} /> : null}</span>;
        })}
      </div>
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 18, transform: `scale(${punch(t, [J.counters], .16, 7)})` }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 20px', borderRadius: 30, background: C.red, color: '#fff', font: `900 44px ${F.head}` }}>
          <span style={{ font: `900 48px/1 ${F.num}` }}>{hot}</span> حار</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 20px', borderRadius: 30, background: C.mustard, color: C.redDeep, font: `900 44px ${F.head}` }}>
          <span style={{ font: `900 48px/1 ${F.num}` }}>{12 - hot}</span> عادي</span>
      </div>
    </div>
  );
};

// the real options of the checkout, popping around the phone
const CHIPS = [['🛵', 'توصيل لباب البيت', { left: 24, top: 900 }, b(18.5)], ['🏪', 'أو استلام من الفرع', { right: 24, top: 1060 }, b(19)], ['💵', 'كاش أو كليك عند الاستلام', { left: 24, top: 1220 }, b(19.5)]] as const;
const Chips: React.FC<{ t: number }> = ({ t }) => <>{CHIPS.map(([e, l, pos, at], i) => {
  const k = backOut(ramp(t, at, at + .4), 2.2), out = ramp(t, b(20) - .1, b(20) + .15);
  if (k <= 0 || out >= 1) return null;
  return <div key={i} style={{ position: 'absolute', ...pos, zIndex: 6, display: 'flex', alignItems: 'center', gap: 12, padding: '16px 28px', borderRadius: 50, background: 'rgba(255,255,255,.96)',
    boxShadow: '0 18px 40px rgba(120,40,10,.25)', font: `800 40px ${F.head}`, color: C.ink, whiteSpace: 'nowrap', opacity: Math.min(1, k * 2) * (1 - out), transform: `scale(${(.3 + .7 * k) * (1 - out * .5)})` }}>
    <span style={{ fontSize: 44 }}>{e}</span>{l}</div>;
})}</>;
