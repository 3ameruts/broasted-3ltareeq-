import { CameraMotionBlur } from '@remotion/motion-blur';
import { Bike, CheckCircle2, Drumstick, Flame, Store } from 'lucide-react';
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { PH, Phone, PW, SH, Shot, SW, Tap } from '../devices';
import { easeOut, expoOut, punch, ramp, RedWorld, shake, Sheen, useAbs } from '../lib';
import { b, C, F } from '../theme';
import taps from '../../public/ui/taps.json';

// 2.2–20.2s: the drop (food bursts out, «ولا يهمّك!», «اطلب أونلاين»), then the phone in 3D walks through the steps.
const backOut = (x: number, s = 1.8) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
const p = (t: number, a: number, d: number, e: (x: number) => number = expoOut) => e(ramp(t, a, a + d));

export const STEPS = [
  { at: b(8), end: b(12), n: '1', title: 'اختار وجبتك', sub: 'كل المنيو قدّامك بالصور والأسعار' },
  { at: b(12), end: b(16), n: '2', title: 'حار ولا عادي؟', sub: 'إنت اللي بتختار' },
  { at: b(16), end: b(20), n: '2', title: 'أو قسّمها على كيفك!', sub: '' },
  { at: b(20), end: b(24), n: '3', title: 'أكّد طلبك', sub: 'بكود بيوصلك على جوالك' },
  { at: b(24), end: 99, n: '✓', title: 'وتابع طلبك لحظة بلحظة', sub: 'من الفرع لحد ما يوصلك' },
];
export const T = {
  scroll: [7.75, 8.85] as const, item: 9.1, sheet: 9.3, spice: 10.25, split: b(14), splitScreen: b(14) + .16,
  flip0: b(16) + .32, flipStep: .158, counters: b(18.5), confirm: b(20) + .42, code: b(20) + .6, typing: b(20) + .93, done: b(22), codeTap: b(22) + .33,
  ok: b(23), notes: [b(24) + .32, b(25) + .32, b(26) + .32],
};

export const Main: React.FC<{ start: number }> = ({ start }) => {
  const t = useAbs(start);
  const s = shake(t, [b(0), b(2), b(3.5)], 18);
  return (
    <AbsoluteFill style={{ background: C.redDeep }}>
      <AbsoluteFill style={{ transform: `translate(${s.x}px, ${s.y}px) rotate(${s.r}deg) scale(${punch(t, [b(0), b(2)], .04)})` }}>
        <RedWorld t={t} />
        {t < b(4) + 1 && <CameraMotionBlur samples={6} shutterAngle={200}><FoodBurst start={start} /></CameraMotionBlur>}
        <Titles t={t} />
        <PhoneRig t={t} />
        <Headers t={t} />
        <SplitCard t={t} />
        <Toast t={t} />
        <Notes t={t} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- the drop: the menu bursts out of the centre ----------
const FOOD = [
  { src: 'cut16', x: 230, y: 430, w: 560, r: -14 }, { src: 'cut20', x: 850, y: 400, w: 560, r: 12 }, { src: 'cut-zinger', x: 140, y: 1270, w: 430, r: -10 },
  { src: 'cut11', x: 935, y: 1300, w: 520, r: 10 }, { src: 'cut15', x: 540, y: 1650, w: 780, r: -4 },
];
const FoodBurst: React.FC<{ start: number }> = ({ start }) => {
  const t = useAbs(start);
  return <AbsoluteFill>{FOOD.map((f, i) => {
    const k = p(t, b(0) + i * .04, .75), out = p(t, b(4) + i * .03, .55, x => x * x);
    const cx = 540 + (f.x - 540) * (k + out * .9), cy = 900 + (f.y - 900) * (k + out * .9);
    const fl = Math.sin(t * 2.2 + i) * 12;
    return <Img key={f.src} src={staticFile(`food/${f.src}.webp`)} style={{ position: 'absolute', left: cx - f.w / 2, top: cy - f.w * .34 + fl, width: f.w,
      transform: `scale(${(.1 + .9 * k) * (1 + out * .35)}) rotate(${f.r * k + Math.sin(t * 1.7 + i) * 2}deg)`, opacity: Math.min(k * 3, 1) * (1 - out),
      filter: 'drop-shadow(0 30px 40px rgba(80,0,0,.45))' }} />;
  })}</AbsoluteFill>;
};

const Titles: React.FC<{ t: number }> = ({ t }) => {
  if (t > b(8) + .2) return null;
  const a = p(t, b(0), .35), aOut = p(t, b(2) - .14, .14, x => x);
  const l1 = p(t, b(2), .4, x => backOut(x, 2)), l2 = p(t, b(2.5), .4, x => backOut(x, 2));
  const up = p(t, b(4), .62, x => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2));
  const pill = p(t, b(5), .45, x => backOut(x, 1.8)), gone = p(t, b(8) - .2, .2, x => x);
  const big = { color: '#fff', textShadow: `0 10px 0 ${C.redDark}, 0 26px 50px rgba(60,0,0,.45)` };
  return (
    <AbsoluteFill>
      {t < b(2) + .05 && <div style={{ position: 'absolute', top: 760, width: 1080, textAlign: 'center', font: `900 176px/1.2 ${F.head}`, ...big,
        opacity: a * (1 - aOut), transform: `scale(${(1.9 - .9 * a) * (1 - aOut * .15)})`, filter: `blur(${(1 - a) * 14 + aOut * 10}px)` }}>ولا يهمّك!</div>}
      {t >= b(2) && <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, opacity: 1 - gone, filter: `blur(${gone * 12}px)`,
        transform: `translateY(${-470 * up - gone * 80}px) scale(${1 - .45 * up})`, transformOrigin: '50% 870px' }}>
        <div style={{ position: 'absolute', top: 650, width: 1080, textAlign: 'center', font: `900 200px/1.15 ${F.head}`, ...big, opacity: Math.min(1, l1 * 2), transform: `translateY(${(1 - l1) * -120}px) scale(${.6 + .4 * l1})` }}>اطلب</div>
        <div style={{ position: 'absolute', top: 880, width: 1080, display: 'flex', justifyContent: 'center', opacity: Math.min(1, l2 * 2), transform: `scale(${.4 + .6 * l2}) rotate(${(1 - l2) * -6}deg)` }}>
          <div style={{ position: 'relative', padding: '0 46px', borderRadius: 40, background: C.mustard, color: C.redDeep, font: `900 196px/1.25 ${F.head}`, boxShadow: `0 14px 0 ${C.brown}, 0 30px 60px rgba(60,0,0,.4)`, overflow: 'hidden' }}>
            أونلاين<Sheen t={t} at={b(3)} />
          </div>
        </div>
      </div>}
      {t >= b(5) && <div style={{ position: 'absolute', top: 545, width: 1080, display: 'flex', justifyContent: 'center', opacity: Math.min(1, pill * 2) * (1 - gone), transform: `scale(${.5 + .5 * pill})` }}>
        <div style={{ padding: '14px 40px', borderRadius: 60, background: 'rgba(255,255,255,.16)', border: '2px solid rgba(255,255,255,.45)', color: '#fff', font: `800 50px ${F.head}`, backdropFilter: 'blur(14px)' }}>
          بـ <span style={{ font: `900 54px ${F.num}`, color: C.mustard }}>3</span> خطوات بس
        </div>
      </div>}
    </AbsoluteFill>
  );
};

// ---------- the phone, in 3D, through the steps ----------
type Pose = { y: number; s: number; rx: number; ry: number; rz: number };
const OFF: Pose = { y: 1980, s: .6, rx: 55, ry: 0, rz: -12 };
const A: Pose = { y: 740, s: .74, rx: 8, ry: -12, rz: 0 };
const S1: Pose = { y: 575, s: .78, rx: 3, ry: -9, rz: 0 }, S2: Pose = { y: 575, s: .78, rx: 3, ry: 9, rz: 0 };
const S2b: Pose = { y: 905, s: .66, rx: 6, ry: 14, rz: 0 }, S3: Pose = { y: 575, s: .78, rx: 3, ry: -9, rz: 0 }, S4: Pose = { y: 600, s: .78, rx: 3, ry: 8, rz: 0 };
const io = (x: number) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const KEYS: [number, number, Pose, (x: number) => number][] = [
  [b(4), .95, A, expoOut], [b(8) - .15, .5, S1, io], [b(12) - .12, .5, S2, io], [b(16) - .1, .55, S2b, io], [b(20) - .08, .5, S3, io], [b(24) - .1, .5, S4, io],
];
function pose(t: number): Pose {
  let cur = OFF;
  for (const [at, d, to, e] of KEYS) {
    if (t < at) break;
    const k = e(ramp(t, at, at + d));
    cur = { y: cur.y + (to.y - cur.y) * k, s: cur.s + (to.s - cur.s) * k, rx: cur.rx + (to.rx - cur.rx) * k, ry: cur.ry + (to.ry - cur.ry) * k, rz: cur.rz + (to.rz - cur.rz) * k };
  }
  return cur;
}
const PhoneRig: React.FC<{ t: number }> = ({ t }) => {
  if (t < b(4)) return null;
  const q = pose(t);
  return (
    <div style={{ position: 'absolute', inset: 0, perspective: 2200 }}>
      <div style={{ position: 'absolute', left: (1080 - PW) / 2, top: q.y + Math.sin(t * 1.1) * 8, width: PW, height: PH, transformOrigin: '50% 0',
        transform: `scale(${q.s}) rotateX(${q.rx}deg) rotateY(${q.ry + Math.sin(t * 1.3) * 2}deg) rotateZ(${q.rz}deg)` }}>
        <div style={{ position: 'absolute', left: 40, top: 60, width: PW - 80, height: PH - 40, borderRadius: 90, background: 'rgba(60,0,0,.55)', filter: 'blur(40px)', transform: 'translate(30px, 50px)' }} />
        <Phone><Screen t={t} /></Phone>
      </div>
    </div>
  );
};
const Fade: React.FC<{ show: number; src: string; dy?: number }> = ({ show, src, dy = 0 }) =>
  show <= 0 ? null : <div style={{ position: 'absolute', inset: 0, opacity: show, transform: `translateY(${dy}px)` }}><Shot src={src} /></div>;
const Screen: React.FC<{ t: number }> = ({ t }) => {
  const scrollPx = 363 * 2.5 * SW / 975;
  const sc = io(ramp(t, T.scroll[0], T.scroll[1])) * scrollPx;
  const slideIn = (at: number) => (1 - easeOut(ramp(t, at, at + .3))) * -SW; // RTL: the next page pushes in from the left
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, transform: `translateY(${-sc}px)` }}><Shot src="ui/01-menu-full.png" /></div>
      <Fade show={ramp(t, T.scroll[1], T.scroll[1] + .05)} src="ui/02-menu-item.png" />
      <Fade show={ramp(t, T.sheet, T.sheet + .15)} src="ui/03-sheet.png" dy={(1 - easeOut(ramp(t, T.sheet, T.sheet + .3))) * 60} />
      <Fade show={ramp(t, T.spice, T.spice + .15)} src="ui/04-sheet-spice.png" />
      <Fade show={ramp(t, T.splitScreen, T.splitScreen + .12)} src="ui/05-split.png" />
      {t >= b(20) - .05 && <div style={{ position: 'absolute', inset: 0, transform: `translateX(${slideIn(b(20) - .05)}px)` }}>
        <Shot src="ui/09-confirm.png" />
        <Fade show={ramp(t, T.code, T.code + .12)} src="ui/10-code.png" />
        <Fade show={ramp(t, T.typing, T.typing + .06)} src="ui/11-code-typing.png" />
        <Fade show={ramp(t, T.done, T.done + .06)} src="ui/12-code-done.png" />
      </div>}
      {t >= b(24) - .05 && <div style={{ position: 'absolute', inset: 0, transform: `translateX(${slideIn(b(24) - .05)}px)` }}><Shot src="ui/13-tracking.png" /></div>}
      <Tap t={t} at={T.item} x={taps.item.x * SW} y={taps.item.y * SH} />
      <Tap t={t} at={T.split} x={taps.split.x * SW} y={taps.split.y * SH} />
      <Tap t={t} at={T.confirm} x={taps.confirm.x * SW} y={taps.confirm.y * SH} />
      <Tap t={t} at={T.codeTap} x={taps.code.x * SW} y={taps.code.y * SH} />
    </>
  );
};

// ---------- step headers ----------
const Headers: React.FC<{ t: number }> = ({ t }) => <>{STEPS.map((h, i) => {
  if (t < h.at - .02 || t > h.end + .02) return null;
  const k = p(t, h.at, .42), out = i < STEPS.length - 1 ? p(t, h.end - .16, .16, x => x) : 0;
  const sameBadge = i > 0 && STEPS[i - 1].n === h.n, badgeOut = i < STEPS.length - 1 && STEPS[i + 1].n === h.n ? 0 : out;
  const bk = sameBadge ? 1 : backOut(ramp(t, h.at, h.at + .4), 2.4), sub = p(t, h.at + .2, .4);
  return (
    <div key={i} style={{ position: 'absolute', top: 276, left: 50, right: 50 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 26 }}>
        <div style={{ flex: 'none', width: 108, height: 108, borderRadius: 54, background: C.mustard, color: C.redDeep, display: 'grid', placeItems: 'center',
          font: `900 66px/1 ${F.num}`, boxShadow: `0 8px 0 ${C.brown}, 0 16px 30px rgba(60,0,0,.35)`, transform: `scale(${bk * (1 - badgeOut)}) rotate(${(1 - bk) * -40}deg)` }}>{h.n}</div>
        <div style={{ color: '#fff', font: `900 ${h.title.length > 14 ? 70 : 84}px/1.15 ${F.head}`, whiteSpace: 'nowrap', textShadow: `0 6px 0 ${C.redDark}, 0 16px 36px rgba(60,0,0,.4)`,
          opacity: k * (1 - out), transform: `translateX(${(1 - k) * 90 - out * -60}px)`, filter: `blur(${(1 - k) * 10 + out * 8}px)` }}>{h.title}</div>
      </div>
      {h.sub && <div style={{ marginTop: 14, textAlign: 'center', color: C.cream, font: `600 42px ${F.body}`, opacity: sub * (1 - out) * .95, transform: `translateY(${(1 - sub) * 20}px)` }}>{h.sub}</div>}
    </div>
  );
})}</>;

// ---------- the split: 12 pieces, 8 turn hot ----------
const SplitCard: React.FC<{ t: number }> = ({ t }) => {
  if (t < b(16) || t > b(20) + .1) return null;
  const k = p(t, b(16) + .05, .45, x => backOut(x, 1.6)), out = p(t, b(20) - .2, .2, x => x);
  const hot = Array.from({ length: 12 }, (_, i) => t >= T.flip0 + i * T.flipStep && i < 8).filter(Boolean).length;
  const slam = punch(t, [T.counters], .14, 7);
  return (
    <div style={{ position: 'absolute', top: 545, left: 50, right: 50, opacity: Math.min(1, k * 2) * (1 - out), transform: `translateY(${(1 - k) * -50 - out * 40}px) scale(${.9 + .1 * k})` }}>
      <div style={{ padding: '30px 32px 28px', borderRadius: 44, background: 'linear-gradient(160deg, rgba(255,255,255,.97), rgba(251,245,234,.94))', boxShadow: '0 40px 80px rgba(60,0,0,.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>{Array.from({ length: 12 }, (_, i) => {
          const at = T.flip0 + i * T.flipStep, on = i < 8 && t >= at, pop = i < 8 ? punch(t, [at], .35, 10) : 1;
          return <div key={i} style={{ width: 62, height: 62, borderRadius: 31, display: 'grid', placeItems: 'center', background: on ? C.red : '#fde7a6',
            color: on ? '#fff' : '#b07a00', boxShadow: on ? `0 0 0 4px ${C.red}33, 0 6px 14px ${C.red}66` : 'inset 0 0 0 3px #f6c64a', transform: `scale(${pop})` }}>
            {on ? <Flame size={34} strokeWidth={2.6} /> : <Drumstick size={32} strokeWidth={2.4} />}</div>;
        })}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, marginTop: 26, transform: `scale(${slam})` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 30px', borderRadius: 40, background: C.red, color: '#fff', font: `900 54px ${F.head}` }}>
            <Flame size={44} /><span style={{ font: `900 60px/1 ${F.num}` }}>{hot}</span> حار</div>
          <div style={{ font: `900 56px ${F.num}`, color: C.ink }}>+</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 30px', borderRadius: 40, background: C.mustard, color: C.redDeep, font: `900 54px ${F.head}` }}>
            <Drumstick size={42} /><span style={{ font: `900 60px/1 ${F.num}` }}>{12 - hot}</span> عادي</div>
        </div>
        <div style={{ marginTop: 14, textAlign: 'center', color: '#6b5f5a', font: `600 36px ${F.body}`, opacity: ramp(t, T.counters, T.counters + .3) }}>بنفس الوجبة</div>
      </div>
    </div>
  );
};

const Toast: React.FC<{ t: number }> = ({ t }) => {
  if (t < T.ok || t > b(24) + .1) return null;
  const k = p(t, T.ok, .45, x => backOut(x, 2)), out = p(t, b(24) - .2, .2, x => x);
  return (
    <div style={{ position: 'absolute', top: 1330, width: 1080, display: 'flex', justifyContent: 'center', opacity: Math.min(1, k * 2) * (1 - out), transform: `scale(${.5 + .5 * k})` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '22px 44px', borderRadius: 60, background: C.ok, color: '#fff', font: `900 58px ${F.head}`, boxShadow: '0 24px 60px rgba(0,60,20,.45)' }}>
        <CheckCircle2 size={56} /> تم تأكيد طلبك</div>
    </div>
  );
};

const NOTES = [
  { icon: Store, title: 'الفرع استلم طلبك', sub: 'فرع دوار العيادات' },
  { icon: Flame, title: 'عم بنحضّر طلبك', sub: 'فريش من المقلى لإلك' },
  { icon: Bike, title: 'طلبك بالطريق لعندك', sub: 'صحتين وعافية' },
];
const Notes: React.FC<{ t: number }> = ({ t }) => <>{NOTES.map((n, i) => {
  const at = T.notes[i]; if (t < at) return null;
  const k = p(t, at, .5, x => backOut(x, 1.5)), I = n.icon;
  return (
    <div key={i} style={{ position: 'absolute', left: 60, right: 60, top: 1010 + i * 158, opacity: Math.min(1, k * 2), transform: `translateY(${(1 - k) * -70}px) scale(${.92 + .08 * k})` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22, padding: '20px 26px', borderRadius: 38, background: 'linear-gradient(160deg, rgba(255,255,255,.97), rgba(251,245,234,.94))', boxShadow: '0 26px 60px rgba(60,0,0,.38)' }}>
        <div style={{ flex: 'none', width: 92, height: 92, borderRadius: 26, background: i === 2 ? C.ok : C.red, color: '#fff', display: 'grid', placeItems: 'center' }}><I size={50} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ color: C.ink, font: `900 44px ${F.head}` }}>{n.title}</span><span style={{ color: '#8a7f7a', font: `600 26px ${F.body}` }}>الآن</span></div>
          <div style={{ color: '#5d5450', font: `600 32px ${F.body}` }}>{n.sub}</div>
        </div>
      </div>
    </div>
  );
})}</>;
