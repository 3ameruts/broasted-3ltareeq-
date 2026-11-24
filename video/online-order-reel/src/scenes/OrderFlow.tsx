import { Check, Flame, Send } from 'lucide-react';
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { Phone, PH, PW, SH, Shot, SW, Tap } from '../devices';
import { Cream, easeInOut, easeOut, expoOut, Pill, ramp, Sheen, useGsap, useT } from '../lib';
import { C, F } from '../theme';
import taps from '../../public/ui/taps.json';

// 0–9.5s. Hook: the phone flies in and the real site lights up — «وجبتك المفضلة... صارت أقرب!».
// Then the real ordering flow: menu → a 12-piece broasted meal → split 8 hot + 4 regular → cart → details → WhatsApp code → sent.
const X0 = (1080 - PW) / 2, Y0 = 330;
// the menu: a full-page capture 975 px wide, scrolled to the 12-piece meal
const FULL_W = 975, SCROLL_END = Math.round(taps.scrollY * 2.5 * SW / FULL_W), STICKY = Math.round(300 * SW / FULL_W);
// close: the sheet on top slides down and uncovers the next screen
type Screen = { at: number; src: string; how: 'cut' | 'fade' | 'sheet' | 'scroll' | 'close' };
const SCREENS: Screen[] = [
  { at: 0, src: 'ui/01-menu.png', how: 'cut' },
  { at: 2.6, src: 'menu-scroll', how: 'cut' },
  { at: 3.45, src: 'ui/03-sheet.png', how: 'sheet' },
  { at: 4.0, src: 'ui/04-sheet-spice.png', how: 'scroll' },
  { at: 4.6, src: 'ui/05-split.png', how: 'fade' },
  { at: 5.25, src: 'ui/06-added.png', how: 'close' },
  { at: 5.85, src: 'ui/07-cart.png', how: 'sheet' },
  { at: 6.45, src: 'ui/08-checkout.png', how: 'fade' },
  { at: 7.15, src: 'ui/10-code.png', how: 'sheet' },
  { at: 7.95, src: 'ui/11-code-typing.png', how: 'cut' },
  { at: 8.2, src: 'ui/12-code-done.png', how: 'cut' },
];
const TAPS: [number, { x: number; y: number }][] = [[3.35, taps.item], [4.5, taps.split], [5.15, taps.add], [5.75, taps.cart], [6.35, taps.next], [7.05, taps.confirm]];
const STEPS: [number, string][] = [[2.6, 'تصفّح المنيو'], [3.45, 'اختار وجبتك'], [4.6, 'قسّم الحار والعادي'], [5.85, 'سلتك'], [6.45, 'اسمك وعنوانك'], [7.15, 'أكّد برمز الواتساب']];
const WA = 7.4, SENT = 8.6;

export const OrderFlow: React.FC = () => {
  const t = useT();
  const ref = useGsap((tl, q) => {
    tl.fromTo(q('.rig'), { rotateY: 38, rotateX: 22, rotateZ: -8, scale: .42, y: 380, filter: 'blur(16px)' },
      { rotateY: -8, rotateX: 6, rotateZ: 2, scale: .72, y: 250, filter: 'blur(0px)', duration: 1.4, ease: 'expo.out' }, 0)
      .to(q('.rig'), { rotateY: 0, rotateX: 0, rotateZ: 0, scale: .94, y: 0, duration: .55, ease: 'power3.inOut' }, 2.15)
      .fromTo(q('.h1'), { y: 70, opacity: 0, filter: 'blur(10px)' }, { y: 0, opacity: 1, filter: 'blur(0px)', duration: .6 }, .35)
      .fromTo(q('.h2'), { scale: .4, opacity: 0, rotate: -4 }, { scale: 1, opacity: 1, rotate: 0, duration: .7, ease: 'back.out(2.2)' }, .85)
      .to(q('.hook'), { y: -140, opacity: 0, filter: 'blur(8px)', duration: .35, ease: 'power2.in' }, 2.15)
      .fromTo(q('.fl'), { x: -500, rotate: -40, opacity: 0 }, { x: 0, rotate: -14, opacity: 1, duration: 1.1, ease: 'expo.out' }, .15)
      .fromTo(q('.fr'), { x: 500, rotate: 40, opacity: 0 }, { x: 0, rotate: 12, opacity: 1, duration: 1.1, ease: 'expo.out' }, .3)
      .to(q('.fl'), { x: -260, y: 300, rotate: -30, duration: .6, ease: 'power2.in' }, 2.1)
      .to(q('.fr'), { x: 260, y: -200, rotate: 30, duration: .6, ease: 'power2.in' }, 2.1)
      // the split, called out beside the phone
      .fromTo(q('.callout'), { scale: .3, opacity: 0, rotate: -8 }, { scale: 1, opacity: 1, rotate: 4, duration: .55, ease: 'back.out(2.4)' }, 4.7)
      .to(q('.callout'), { scale: .6, opacity: 0, duration: .25, ease: 'power2.in' }, 5.55)
      // WhatsApp code drops in
      .fromTo(q('.wa'), { y: -220, opacity: 0 }, { y: 0, opacity: 1, duration: .5, ease: 'back.out(1.6)' }, WA)
      .to(q('.wa'), { y: -220, opacity: 0, duration: .3, ease: 'power2.in' }, 8.3)
      // sent: the phone pulls back
      .to(q('.rig'), { scale: .8, y: 120, rotateX: 10, duration: .7, ease: 'power3.inOut' }, SENT + .2);
  });
  const on = ramp(t, .6, 1.0);
  const cur = SCREENS.reduce((a, s, i) => (t >= s.at ? i : a), 0);
  const scrollY = ramp(t, 2.65, 3.3, 0, SCROLL_END, easeInOut);
  const step = STEPS.reduce((a, s, i) => (t >= s[0] ? i : a), -1);
  const sent = ramp(t, SENT, SENT + .35);
  return (
    <AbsoluteFill ref={ref}>
      <Cream />
      <Img className="fl" src={staticFile('food/cut-zinger.webp')} style={{ position: 'absolute', left: -150, top: 1210 + Math.sin(t * 1.7) * 14, width: 470, filter: 'drop-shadow(0 30px 40px rgba(80,30,10,.35))' }} />
      <Img className="fr" src={staticFile('food/cut16.webp')} style={{ position: 'absolute', right: -190, top: 420 + Math.cos(t * 1.5) * 14, width: 560, filter: 'drop-shadow(0 30px 40px rgba(80,30,10,.35))' }} />
      <div style={{ position: 'absolute', inset: 0, perspective: 2000 }}>
        <div className="rig" style={{ position: 'absolute', left: X0, top: Y0, width: PW, height: PH, transformOrigin: '50% 50%' }}>
          <Phone glow={sent * (1 - ramp(t, 9.1, 9.5))}>
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
                      <Img src={staticFile('ui/01-menu-full.png')} style={{ position: 'absolute', left: 0, top: -scrollY, width: SW, filter: `blur(${Math.sin(Math.PI * ramp(t, 2.65, 3.3)) * 5}px)` }} />
                      {scrollY > SCROLL_END * .8 && <div style={{ position: 'absolute', left: 0, top: 0, width: SW, height: STICKY, overflow: 'hidden' }}><Img src={staticFile('ui/02-menu-item.png')} style={{ width: SW }} /></div>}
                    </>
                  ) : <Shot src={s.src} />}
                </div>
              );
            })}
            <div style={{ position: 'absolute', inset: 0, background: '#000', opacity: 1 - on, zIndex: 9 }} />
            <div style={{ position: 'absolute', inset: 0, zIndex: 9, opacity: on * (1 - ramp(t, 1.0, 1.5)) }}><Sheen at={.7} dur={.8} /></div>
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
      <div className="hook" style={{ position: 'absolute', top: 270, width: '100%', textAlign: 'center' }}>
        <div className="h1" style={{ font: `900 104px/1.15 ${F.head}`, color: C.ink }}>وجبتك المفضلة...</div>
        <div className="h2" style={{ position: 'relative', display: 'inline-block', font: `900 150px/1.1 ${F.head}`, color: C.red }}>صارت أقرب!<Sheen at={1.5} /></div>
      </div>
      {step >= 0 && t < SENT && (
        <div style={{ position: 'absolute', top: 258, width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Pill style={{ transform: `translateY(${(1 - easeOut(ramp(t, STEPS[step][0], STEPS[step][0] + .3))) * -40}px)`, opacity: ramp(t, STEPS[step][0], STEPS[step][0] + .2) * (1 - ramp(t, SENT - .2, SENT)) }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 52, height: 52, borderRadius: 26, background: C.red, color: '#fff', font: `900 30px ${F.num}` }}>{step + 1}</span>
            {STEPS[step][1]}
            {step === STEPS.length - 1 && t > 8.2 && <Check size={40} color={C.ok} />}
          </Pill>
        </div>
      )}
    </AbsoluteFill>
  );
};
