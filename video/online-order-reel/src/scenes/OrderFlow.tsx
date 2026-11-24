import { Check, Flame, Send } from 'lucide-react';
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { Phone, PH, PW, SH, Shot, SW, Tap } from '../devices';
import { Cream, easeInOut, easeOut, expoOut, Pill, ramp, Sheen, useGsap, useT } from '../lib';
import { C, F } from '../theme';
import taps from '../../public/ui/taps.json';

// 0–12.5s. Intro (5.5 s): logo slam, the meals burst out, «وجبتك المفضلة... صارت أقرب!», the phone flies up with the three ways to order.
// Then the real ordering flow: menu → a 12-piece broasted meal → split 8 hot + 4 regular → cart → details → WhatsApp code → sent.
const X0 = (1080 - PW) / 2, Y0 = 330;
// the menu: a full-page capture 975 px wide, scrolled to the 12-piece meal
const FULL_W = 975, SCROLL_END = Math.round(taps.scrollY * 2.5 * SW / FULL_W), STICKY = Math.round(300 * SW / FULL_W);
// close: the sheet on top slides down and uncovers the next screen
// the intro takes 5.5 s; everything after it is shifted by O
export const O = 3;
type Screen = { at: number; src: string; how: 'cut' | 'fade' | 'sheet' | 'scroll' | 'close' };
const SCREENS: Screen[] = [
  { at: 0, src: 'ui/01-menu.png', how: 'cut' },
  { at: O + 2.6, src: 'menu-scroll', how: 'cut' },
  { at: O + 3.45, src: 'ui/03-sheet.png', how: 'sheet' },
  { at: O + 4.0, src: 'ui/04-sheet-spice.png', how: 'scroll' },
  { at: O + 4.6, src: 'ui/05-split.png', how: 'fade' },
  { at: O + 5.25, src: 'ui/06-added.png', how: 'close' },
  { at: O + 5.85, src: 'ui/07-cart.png', how: 'sheet' },
  { at: O + 6.45, src: 'ui/08-checkout.png', how: 'fade' },
  { at: O + 7.15, src: 'ui/10-code.png', how: 'sheet' },
  { at: O + 7.95, src: 'ui/11-code-typing.png', how: 'cut' },
  { at: O + 8.2, src: 'ui/12-code-done.png', how: 'cut' },
];
const TAPS: [number, { x: number; y: number }][] = ([[3.35, taps.item], [4.5, taps.split], [5.15, taps.add], [5.75, taps.cart], [6.35, taps.next], [7.05, taps.confirm]] as [number, { x: number; y: number }][]).map(([a, p]) => [O + a, p]);
const STEPS: [number, string][] = ([[2.6, 'تصفّح المنيو'], [3.45, 'اختار وجبتك'], [4.6, 'قسّم الحار والعادي'], [5.85, 'سلتك'], [6.45, 'اسمك وعنوانك'], [7.15, 'أكّد برمز الواتساب']] as [number, string][]).map(([a, n]) => [O + a, n]);
const WA = O + 7.4, SENT = O + 8.6;

export const OrderFlow: React.FC = () => {
  const t = useT();
  const ref = useGsap((tl, q) => {
    // ── intro (0–5.5 s) ──
    // 1) logo slam with a ring and a flash, the meals burst out from behind it
    tl.fromTo(q('.flash'), { opacity: 0 }, { opacity: .85, duration: .06 }, .32).to(q('.flash'), { opacity: 0, duration: .5 }, .38)
      .fromTo(q('.biglogo'), { scale: 2.8, opacity: 0, filter: 'blur(22px)' }, { scale: 1, opacity: 1, filter: 'blur(0px)', duration: .7, ease: 'expo.out' }, .1)
      .fromTo(q('.ring1'), { scale: .3, opacity: 1 }, { scale: 3.4, opacity: 0, duration: 1, ease: 'power2.out' }, .35)
      .fromTo(q('.fA'), { x: 380, y: 280, scale: .15, rotate: 0, opacity: 0 }, { x: 0, y: 0, scale: 1, rotate: 14, opacity: 1, duration: .9, ease: 'back.out(1.5)' }, .5)
      .fromTo(q('.fB'), { x: -420, y: -380, scale: .15, rotate: 0, opacity: 0 }, { x: 0, y: 0, scale: 1, rotate: -16, opacity: 1, duration: .9, ease: 'back.out(1.5)' }, .62)
      .fromTo(q('.fC'), { x: -60, y: -560, scale: .15, rotate: 0, opacity: 0 }, { x: 0, y: 0, scale: 1, rotate: 8, opacity: 1, duration: .9, ease: 'back.out(1.5)' }, .74)
      // 2) the logo goes up, the line arrives word by word
      .to(q('.biglogo'), { y: -610, scale: .46, duration: .6, ease: 'power3.inOut' }, 1.45)
      .fromTo(q('.h1'), { y: 70, opacity: 0, filter: 'blur(10px)' }, { y: 0, opacity: 1, filter: 'blur(0px)', duration: .6 }, 1.75)
      .fromTo(q('.h2'), { scale: .3, opacity: 0, rotate: -6 }, { scale: 1, opacity: 1, rotate: 0, duration: .75, ease: 'back.out(2.4)' }, 2.35)
      // 3) the phone flies up, the site lights up, the three ways to order pop around it
      .fromTo(q('.rig'), { rotateY: 30, rotateX: 38, rotateZ: -10, scale: .3, y: 1300, opacity: 0 }, { rotateY: -6, rotateX: 8, rotateZ: 3, scale: .58, y: 430, opacity: 1, duration: 1, ease: 'expo.out' }, 3.0)
      .to(q('.rig'), { rotateY: 4, rotateZ: -2, duration: 1.1, ease: 'sine.inOut' }, 4.0)
      .fromTo(q('.chip'), { scale: .2, opacity: 0, y: 40 }, { scale: 1, opacity: 1, y: 0, duration: .5, stagger: .2, ease: 'back.out(2.2)' }, 3.9)
      .to(q('.fA, .fB, .fC'), { y: (i: number) => (i === 1 ? 160 : -160), x: (i: number) => (i === 1 ? -200 : 220), rotate: (i: number) => (i === 1 ? -30 : 30), opacity: 0, duration: .5, ease: 'power2.in' }, 4.95)
      .to(q('.chip'), { scale: .6, opacity: 0, duration: .25, stagger: .05, ease: 'power2.in' }, 4.95)
      .to(q('.hook, .biglogo'), { y: '-=140', opacity: 0, filter: 'blur(8px)', duration: .35, ease: 'power2.in' }, 5.05)
      // 4) the phone settles where the ordering happens
      .to(q('.rig'), { rotateY: 0, rotateX: 0, rotateZ: 0, scale: .94, y: 0, duration: .55, ease: 'power3.inOut' }, 5.1)
      // the split, called out beside the phone
      .fromTo(q('.callout'), { scale: .3, opacity: 0, rotate: -8 }, { scale: 1, opacity: 1, rotate: 4, duration: .55, ease: 'back.out(2.4)' }, O + 4.7)
      .to(q('.callout'), { scale: .6, opacity: 0, duration: .25, ease: 'power2.in' }, O + 5.55)
      // WhatsApp code drops in
      .fromTo(q('.wa'), { y: -220, opacity: 0 }, { y: 0, opacity: 1, duration: .5, ease: 'back.out(1.6)' }, WA)
      .to(q('.wa'), { y: -220, opacity: 0, duration: .3, ease: 'power2.in' }, O + 8.3)
      // sent: the phone pulls back
      .to(q('.rig'), { scale: .8, y: 120, rotateX: 10, duration: .7, ease: 'power3.inOut' }, SENT + .2);
  });
  const on = ramp(t, 3.4, 3.8);
  const cur = SCREENS.reduce((a, s, i) => (t >= s.at ? i : a), 0);
  const scrollY = ramp(t, O + 2.65, O + 3.3, 0, SCROLL_END, easeInOut);
  const step = STEPS.reduce((a, s, i) => (t >= s[0] ? i : a), -1);
  const sent = ramp(t, SENT, SENT + .35);
  return (
    <AbsoluteFill ref={ref}>
      <Cream />
      {/* intro: the meals burst out from behind the logo and float */}
      <Img className="fA" src={staticFile('food/cut16.webp')} style={{ position: 'absolute', left: 600, top: 200 + Math.cos(t * 1.5) * 14, width: 560, opacity: 0, filter: 'drop-shadow(0 30px 40px rgba(80,30,10,.35))' }} />
      <Img className="fB" src={staticFile('food/cut-zinger.webp')} style={{ position: 'absolute', left: -150, top: 1160 + Math.sin(t * 1.7) * 14, width: 500, opacity: 0, filter: 'drop-shadow(0 30px 40px rgba(80,30,10,.35))' }} />
      <Img className="fC" src={staticFile('food/cut20.webp')} style={{ position: 'absolute', left: 640, top: 1330 + Math.sin(t * 1.3 + 1) * 14, width: 520, opacity: 0, filter: 'drop-shadow(0 30px 40px rgba(80,30,10,.35))' }} />
      <div className="ring1" style={{ position: 'absolute', left: 540 - 260, top: 900 - 260, width: 520, height: 520, borderRadius: 260, border: `10px solid ${C.mustard}`, opacity: 0 }} />
      <div className="biglogo" style={{ position: 'absolute', left: 540 - 380, top: 900 - 225, width: 760, opacity: 0, zIndex: 4 }}>
        <div style={{ position: 'relative' }}>
          <Img src={staticFile('logo.webp')} style={{ width: 760, filter: `drop-shadow(0 30px 50px rgba(120,40,10,.35))` }} />
        </div>
      </div>
      <div style={{ position: 'absolute', inset: 0, perspective: 2000 }}>
        <div className="rig" style={{ position: 'absolute', left: X0, top: Y0, width: PW, height: PH, transformOrigin: '50% 50%' }}>
          <Phone glow={sent * (1 - ramp(t, O + 9.1, O + 9.5))}>
            {SCREENS.map((s, i) => {
              if (i !== cur && i !== cur - 1) return null;
              const nxt = SCREENS[cur], p = easeOut(ramp(t, nxt.at, nxt.at + .28));
              let o = 1, y = 0;
              let z = i === cur ? 2 : 1;
              if (i === cur) { o = s.how === 'fade' || s.how === 'sheet' ? p : 1; y = s.how === 'scroll' ? (1 - p) * 100 : s.how === 'sheet' ? (1 - p) * 10 : 0; }
              else { y = nxt.how === 'scroll' ? -p * 100 : nxt.how === 'close' ? p * 100 : 0; if (nxt.how === 'close') z = 3; if (p >= 1) o = 0; }
              return (
                <div key={i} style={{ position: 'absolute', inset: 0, opacity: o, transform: `translateY(${y}%)`, zIndex: z, background: C.cream }}>
                  {s.src === 'menu-scroll' ? (
                    <>
                      <Img src={staticFile('ui/01-menu-full.png')} style={{ position: 'absolute', left: 0, top: -scrollY, width: SW, filter: `blur(${Math.sin(Math.PI * ramp(t, O + 2.65, O + 3.3)) * 5}px)` }} />
                      {scrollY > SCROLL_END * .8 && <div style={{ position: 'absolute', left: 0, top: 0, width: SW, height: STICKY, overflow: 'hidden' }}><Img src={staticFile('ui/02-menu-item.png')} style={{ width: SW }} /></div>}
                    </>
                  ) : <Shot src={s.src} />}
                </div>
              );
            })}
            <div style={{ position: 'absolute', inset: 0, background: '#000', opacity: 1 - on, zIndex: 9 }} />
            <div style={{ position: 'absolute', inset: 0, zIndex: 9, opacity: on * (1 - ramp(t, 3.9, 4.4)) }}><Sheen at={3.5} dur={.8} /></div>
            {TAPS.map(([at, p], i) => <Tap key={i} t={t} at={at} x={p.x * SW} y={p.y * SH} />)}
            {/* the WhatsApp code arrives (the real message text) */}
            <div className="wa" style={{ position: 'absolute', left: 18, right: 18, top: 78, zIndex: 26, opacity: 0, display: 'flex', gap: 16, alignItems: 'center', padding: '18px 20px', borderRadius: 30,
              background: 'rgba(250,250,250,.96)', boxShadow: '0 18px 40px rgba(0,0,0,.28)' }}>
              <span style={{ display: 'grid', placeItems: 'center', width: 64, height: 64, borderRadius: 18, background: C.wa, flex: 'none' }}>
                <svg width="38" height="38" viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20Z" /></svg>
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', font: `600 22px ${F.body}`, color: '#6b6b6b' }}><span>بروستد عالطريق</span><span>الآن</span></div>
                <div style={{ font: `700 26px ${F.body}`, color: '#111' }}><span style={{ font: `900 28px ${F.num}`, letterSpacing: 2 }}>482913</span> هو كود التحقق الخاص بك.</div>
              </div>
            </div>
            {/* sent */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 27, display: 'grid', placeItems: 'center', background: `rgba(178,16,23,${.9 * sent})`, opacity: sent }}>
              <div style={{ textAlign: 'center', color: '#fff', transform: `scale(${.6 + .4 * expoOut(sent)})` }}>
                <div style={{ width: 170, height: 170, margin: '0 auto 30px', borderRadius: 85, background: '#fff', color: C.red, display: 'grid', placeItems: 'center' }}><Send size={84} /></div>
                <div style={{ font: `900 60px ${F.head}` }}>انبعت الطلب</div>
                <div style={{ font: `700 40px ${F.num}`, opacity: .85 }}>#77</div>
              </div>
            </div>
          </Phone>
        </div>
      </div>
      {/* the split, big, beside the phone: 12 pieces → 8 hot + 4 regular */}
      <div className="callout" style={{ position: 'absolute', right: 40, top: 560, opacity: 0, zIndex: 5, padding: '20px 26px', borderRadius: 34, background: '#fff', boxShadow: '0 24px 60px rgba(120,30,10,.28)', textAlign: 'center' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 22px)', gap: 7, justifyContent: 'center', marginBottom: 12 }}>
          {Array.from({ length: 12 }, (_, i) => <span key={i} style={{ width: 22, height: 22, borderRadius: 11, background: i < 8 ? C.red : C.mustard }} />)}
        </div>
        <div style={{ font: `900 40px ${F.head}`, color: C.redDeep, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}><Flame size={32} /> <span style={{ font: `900 40px ${F.num}` }}>8</span> حار</div>
        <div style={{ font: `800 34px ${F.head}`, color: C.ink }}><span style={{ font: `900 34px ${F.num}` }}>4</span> عادي</div>
      </div>
      <div className="hook" style={{ position: 'absolute', top: 530, width: '100%', textAlign: 'center', zIndex: 4 }}>
        <div className="h1" style={{ font: `900 104px/1.15 ${F.head}`, color: C.ink, opacity: 0 }}>وجبتك المفضلة...</div>
        <div className="h2" style={{ position: 'relative', display: 'inline-block', font: `900 160px/1.1 ${F.head}`, color: C.red, opacity: 0, textShadow: '0 14px 40px rgba(224,38,58,.25)' }}>صارت أقرب!<Sheen at={2.95} /></div>
      </div>
      {/* the three ways to order, around the phone (all real options of the site) */}
      {([['🛵', 'توصيل لباب البيت', { left: 30, top: 1060 }], ['🏪', 'أو استلام من الفرع', { right: 30, top: 1230 }], ['💵', 'كاش أو كليك عند الاستلام', { left: 30, top: 1400 }]] as const).map(([e, l, pos], i) => (
        <div key={i} className="chip" style={{ position: 'absolute', ...pos, zIndex: 6, opacity: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '16px 26px', borderRadius: 50,
          background: 'rgba(255,255,255,.92)', boxShadow: '0 18px 40px rgba(120,40,10,.22)', font: `800 36px ${F.head}`, color: C.ink, whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: 40 }}>{e}</span>{l}
        </div>
      ))}
      <div className="flash" style={{ position: 'absolute', inset: 0, background: '#fff', opacity: 0, zIndex: 8, pointerEvents: 'none' }} />
      {step >= 0 && t < SENT && (
        <div style={{ position: 'absolute', top: 258, width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Pill style={{ transform: `translateY(${(1 - easeOut(ramp(t, STEPS[step][0], STEPS[step][0] + .3))) * -40}px)`, opacity: ramp(t, STEPS[step][0], STEPS[step][0] + .2) * (1 - ramp(t, SENT - .2, SENT)) }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 52, height: 52, borderRadius: 26, background: C.red, color: '#fff', font: `900 30px ${F.num}` }}>{step + 1}</span>
            {STEPS[step][1]}
            {step === STEPS.length - 1 && t > O + 8.2 && <Check size={40} color={C.ok} />}
          </Pill>
        </div>
      )}
    </AbsoluteFill>
  );
};
