import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { useContent, telHref, formatPrice } from '../lib/content';
import { gsap } from '../lib/motion';
import { liveOffers, daysLeft, type Offer } from '../lib/offers';
import { PhoneIcon, ClockIcon } from './Icons';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Offers() {
  const { content } = useContent();
  const offers = liveOffers(content.offers);
  const ref = useRef<HTMLElement>(null);

  // Cards rest in place; on first view they drop in, the old price gets struck through and the new one pops.
  // fromTo + clearProps hand the cards back to CSS (hover, tilts) once the entrance is done.
  useGSAP(
    () => {
      if (reduced() || !offers.length) return;
      const clear = { clearProps: 'transform,translate,rotate,scale' };
      gsap.utils.toArray<HTMLElement>('.offer-slot').forEach((slot, i) => {
        const tl = gsap.timeline({ scrollTrigger: { trigger: slot, start: 'top 88%', once: true } });
        tl.fromTo(slot, { y: 90, rotate: i % 2 ? 5 : -5 }, { y: 0, rotate: 0, duration: 0.9, ease: 'back.out(1.5)', delay: (i % 3) * 0.08, ...clear });
        const strike = slot.querySelector('.offer__strike');
        if (strike) tl.fromTo(strike, { scaleX: 0 }, { scaleX: 1, duration: 0.45, ease: 'power3.out', ...clear }, '-=0.35');
        tl.fromTo(slot.querySelector('.offer__now'), { scale: 0.4, rotate: -10 }, { scale: 1, rotate: 0, duration: 0.6, ease: 'back.out(3)', ...clear }, '-=0.15');
        const badge = slot.querySelector('.offer__badge');
        if (badge) tl.fromTo(badge, { scale: 0, rotate: -90 }, { scale: 1, rotate: 0, duration: 0.6, ease: 'back.out(2.5)', ...clear }, '<');
      });
      gsap.fromTo('.offers__title', { yPercent: 60, rotate: -4 }, { yPercent: 0, rotate: 0, duration: 0.9, ease: 'back.out(2)', ...clear, scrollTrigger: { trigger: '.offers__title', start: 'top 92%', once: true } });
    },
    { scope: ref, dependencies: [offers.map(o => o.id).join()], revertOnUpdate: true }
  );

  if (!offers.length) return null;
  const text = content.offersText;
  const tape = Array.from({ length: 8 }, () => text.tape).join('  •  ');

  return (
    <section ref={ref} id="offers" className={'offers' + (offers.length === 1 ? ' offers--single' : '')} aria-labelledby="offers-title">
      <div className="offers__tape" aria-hidden="true">
        <div className="offers__tape-track" dir="rtl"><span>{tape}  •  </span><span>{tape}  •  </span></div>
      </div>
      <div className="wrap">
        <div className="offers__head">
          <h2 id="offers-title" className="offers__title">{text.title}</h2>
          {text.lead.trim() && <p className="offers__lead">{text.lead}</p>}
        </div>
        <div className="offers__grid">
          {offers.map(o => <div className="offer-slot" key={o.id}><OfferCard offer={o} /></div>)}
        </div>
      </div>
    </section>
  );
}

function OfferCard({ offer }: { offer: Offer }) {
  const { content } = useContent();
  const left = daysLeft(offer);
  const parts = offer.contents.split('+').map(s => s.trim()).filter(Boolean);
  const saving = offer.oldPrice && offer.oldPrice > offer.price ? offer.oldPrice - offer.price : 0;
  return (
    <article className="offer">
      <div className="offer__media">
        {offer.image ? <img src={offer.image} alt={offer.title} loading="lazy" /> : <img className="offer__logo" src={content.brand.logo} alt="" />}
        {offer.badge.trim() && (
          <span className="offer__badge">
            <svg viewBox="0 0 100 100" aria-hidden="true" className="offer__burst">
              <polygon points={burst()} />
            </svg>
            <span>{offer.badge}</span>
          </span>
        )}
      </div>
      <div className="offer__body">
        <h3 className="offer__name">{offer.title}</h3>
        {parts.length > 0 && (
          <ul className="offer__parts">
            {parts.map(p => <li key={p}>{p}</li>)}
          </ul>
        )}
        <div className="offer__prices">
          <span className="offer__now"><span className="num">{formatPrice(offer.price)}</span> <small>د.أ</small></span>
          {saving > 0 && (
            <span className="offer__was">
              <span className="num">{formatPrice(offer.oldPrice!)}</span>
              <span className="offer__strike" aria-hidden="true" />
              <span className="sr-only">بدل</span>
            </span>
          )}
          {saving > 0 && <span className="offer__save">وفّر <span className="num">{formatPrice(saving)}</span> د.أ</span>}
        </div>
        {left !== null && (
          <p className={'offer__time' + (left <= 1 ? ' is-last' : '')}>
            <ClockIcon /> {left <= 1 ? 'آخر يوم للعرض!' : left === 2 ? 'باقي يومين بس' : `باقي ${left} أيام`}
          </p>
        )}
        <a className="btn btn--yellow offer__cta" href={telHref(content.brand.phone)}>
          <PhoneIcon size={18} /> اتصل واطلب العرض
        </a>
      </div>
    </article>
  );
}

function burst(points = 14, outer = 50, inner = 40) {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI * i) / points - Math.PI / 2;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}
