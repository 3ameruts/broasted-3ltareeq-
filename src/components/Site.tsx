import { useEffect, useMemo, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import { useContent, isOpenNow, telHref, formatPrice, type Category, type Item, type Branch, type Stat } from '../lib/content';
import { useSmoothScroll, scrollToId, gsap, ScrollTrigger } from '../lib/motion';
import { locate, directionsUrl, type Located } from '../lib/geo';
import { useTracking } from '../lib/tracking';
import { buildSchema } from '../lib/seo';
import { liveOffers } from '../lib/offers';
import Offers from './Offers';
import ScrollVelocity from './bits/ScrollVelocity';
import Magnet from './bits/Magnet/Magnet';
import ClickSpark from './bits/ClickSpark/ClickSpark';
import { PhoneIcon, PinIcon, RouteIcon, ClockIcon, InstagramIcon, FacebookIcon, CheckIcon, BagIcon } from './Icons';
import { useOrdering } from '../lib/ordering';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Site() {
  useSmoothScroll(true);
  const { content } = useContent();
  useTracking(content.tracking);
  // Keep the search-engine schema in step with live edits from the admin panel.
  useEffect(() => {
    const el = document.getElementById('ld-schema');
    if (el) el.textContent = JSON.stringify(buildSchema(content));
  }, [content]);
  const root = useRef<HTMLDivElement>(null);

  // Scroll motion uses transforms only, so every section stays readable without scrolling.
  useGSAP(
    () => {
      if (reduced()) return;
      gsap.utils.toArray<HTMLElement>('[data-rise]').forEach(el => {
        // clearProps hands the element back to its CSS tilt and hover once it lands.
        gsap.fromTo(el, { y: 70, rotate: Number(el.dataset.rise) || 0 }, { y: 0, rotate: 0, duration: 1, ease: 'back.out(1.4)', clearProps: 'transform,translate,rotate,scale', scrollTrigger: { trigger: el, start: 'top 92%', once: true } });
      });
      gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach(el => {
        gsap.fromTo(el, { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: el, scrub: true } });
      });
    },
    { scope: root }
  );

  return (
    <ClickSpark sparkColor={['#FCB712', '#FFFFFF', '#E0263A']} sparkCount={9} sparkRadius={22} duration={480}>
      <div ref={root} className="site">
        <Header />
        <main>
          <Hero />
          <Offers />
          <Marquee />
          <Menu />
          <Gallery />
          <About />
          <Branches />
        </main>
        <Footer />
        <CallFab />
      </div>
    </ClickSpark>
  );
}

function Header() {
  const { content } = useContent();
  const ordering = useOrdering();
  const offerCount = liveOffers(content.offers).length;
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(scrollY > 40);
    on();
    addEventListener('scroll', on, { passive: true });
    return () => removeEventListener('scroll', on);
  }, []);
  return (
    <header className={'header' + (scrolled ? ' is-scrolled' : '')}>
      <div className="header__inner">
        <button className="header__logo" onClick={() => scrollTo({ top: 0, behavior: 'smooth' })} aria-label="الرجوع لأول الصفحة">
          <img src={content.brand.logo} alt={content.brand.name} width={132} height={78} />
        </button>
        <nav className="header__nav" aria-label="أقسام الموقع">
          {offerCount > 0 && (
            <button className="header__offers" onClick={() => scrollToId('offers')}>
              العروض <span className="header__count num">{offerCount}</span>
            </button>
          )}
          <button onClick={() => scrollToId('menu')}>المنيو</button>
          <button onClick={() => scrollToId('about')}>من نحن</button>
          <button onClick={() => scrollToId('branches')}>الفروع</button>
        </nav>
        {ordering.visible && (
          <a className="btn btn--white header__order" href={ordering.url}>
            <BagIcon size={18} /> اطلب أونلاين
          </a>
        )}
        <a className="btn btn--yellow header__call" href={telHref(content.brand.phone)}>
          <PhoneIcon size={18} /> <span className="num">{content.brand.phone}</span>
        </a>
      </div>
      {ordering.visible && (
        <a className={'order-fab' + (scrolled ? ' is-on' : '')} href={ordering.url}>
          <BagIcon size={22} /> اطلب أونلاين
          <small>الدفع عند الاستلام</small>
        </a>
      )}
    </header>
  );
}

function OpenStatus() {
  const { content } = useContent();
  const { openHour, closeHour, showStatus, statusOpen, statusClosed } = content.brand;
  const [open, setOpen] = useState(() => isOpenNow(openHour, closeHour));
  useEffect(() => {
    const t = setInterval(() => setOpen(isOpenNow(openHour, closeHour)), 60000);
    return () => clearInterval(t);
  }, [openHour, closeHour]);
  if (!showStatus) return null;
  return (
    <span className={'status' + (open ? ' is-open' : '')}>
      <span className="status__dot" aria-hidden="true" />
      {open ? statusOpen : statusClosed}
    </span>
  );
}

function Hero() {
  const { content } = useContent();
  const { hero, brand } = content;
  const ordering = useOrdering();
  const ref = useRef<HTMLElement>(null);
  const words = hero.title.split(/\s+/).filter(Boolean);

  useGSAP(
    () => {
      if (reduced()) return;
      const tl = gsap.timeline({ defaults: { ease: 'back.out(1.8)' } });
      tl.from('.hero__eyebrow', { y: -20, duration: 0.6 })
        .from('.hero__word', { yPercent: 110, rotate: i => (i % 2 ? 6 : -6), duration: 0.9, stagger: 0.12 }, '<0.1')
        .from('.hero__sub, .hero__actions, .hero__meta', { y: 24, duration: 0.7, stagger: 0.08, ease: 'power3.out' }, '-=0.5')
        .from('.hero__screen', { scale: 0.86, rotate: 6, duration: 1.1, ease: 'elastic.out(1, 0.6)' }, 0.15);
      gsap.to('.hero__road-dash', { strokeDashoffset: -80, duration: 2.2, ease: 'none', repeat: -1 });
    },
    { scope: ref }
  );

  return (
    <section ref={ref} className="hero" aria-labelledby="hero-title">
      <svg className="hero__road" viewBox="0 0 1440 520" preserveAspectRatio="none" aria-hidden="true">
        <path d="M-40 420 C 260 300, 420 520, 760 390 S 1260 220, 1500 330" className="hero__road-band" />
        <path d="M-40 420 C 260 300, 420 520, 760 390 S 1260 220, 1500 330" className="hero__road-dash" />
      </svg>
      <div className="hero__inner">
        <div className="hero__copy">
          <p className="hero__eyebrow">{hero.eyebrow}</p>
          <h1 id="hero-title" className="hero__title">
            {words.map((w, i) => (
              <span className="hero__word-wrap" key={i}>
                <span className="hero__word">{w}</span>
              </span>
            ))}
          </h1>
          <p className="hero__sub">{hero.subtitle}</p>
          {ordering.visible && <p className="hero__new"><span>جديد</span> صار فيك تطلب من الموقع: استلام أو توصيل، والدفع عند الاستلام</p>}
          <div className="hero__actions">
            {ordering.visible ? (
              <>
                <Magnet padding={60} magnetStrength={3}>
                  <a className="btn btn--yellow btn--big" href={ordering.url}><BagIcon size={22} /> اطلب أونلاين</a>
                </Magnet>
                <button className="btn btn--ghost btn--big" onClick={() => scrollToId('menu')}>شوف المنيو</button>
              </>
            ) : (
              <>
                <Magnet padding={60} magnetStrength={3}>
                  <button className="btn btn--yellow btn--big" onClick={() => scrollToId('menu')}>شوف المنيو</button>
                </Magnet>
                <a className="btn btn--ghost btn--big" href={telHref(brand.phone)}>
                  <PhoneIcon size={20} /> اتصل واطلب
                </a>
              </>
            )}
          </div>
          <div className="hero__meta">
            <OpenStatus />
            <span className="hero__hours"><ClockIcon /> {brand.hours}</span>
          </div>
        </div>
        <div className="hero__screen">
          <div className="hero__frame">
            <video className="hero__video" autoPlay muted loop playsInline poster={hero.video + '-poster.webp'} aria-label="فيديو تعريفي ببروستد عالطريق">
              <source src={hero.video + '.mp4'} type="video/mp4" />
              <source src={hero.video + '.webm'} type="video/webm" />
            </video>
          </div>
          <span className="hero__sticker" aria-hidden="true">فريش<br />كل يوم</span>
        </div>
      </div>
      <div className="checker checker--bottom" aria-hidden="true" />
    </section>
  );
}

function Marquee() {
  const { content } = useContent();
  const line = content.marquee.join('  •  ') + '  •  ';
  return (
    <section className="marquee" aria-label="أصنافنا">
      <div dir="ltr">
        <ScrollVelocity
          texts={[<span dir="rtl" key="a">{line}</span>, <span dir="rtl" key="b">{content.brand.slogan + '  •  ' + content.brand.hours + '  •  '}</span>]}
          velocity={-55}
          numCopies={6}
          className="marquee__text"
          fadeEdges={false}
        />
      </div>
    </section>
  );
}

function Menu() {
  const { content } = useContent();
  const [active, setActive] = useState(content.categories[0]?.id);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const triggers = content.categories.map(c =>
      ScrollTrigger.create({ trigger: '#cat-' + c.id, start: 'top 45%', end: 'bottom 45%', onToggle: s => s.isActive && setActive(c.id) })
    );
    return () => triggers.forEach(t => t.kill());
  }, [content.categories]);

  useEffect(() => {
    // Scroll only the tab strip; scrollIntoView would also move the page.
    const strip = tabsRef.current;
    const tab = strip?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    if (!strip || !tab) return;
    const s = strip.getBoundingClientRect();
    const t = tab.getBoundingClientRect();
    strip.scrollBy({ left: t.left + t.width / 2 - (s.left + s.width / 2), behavior: 'smooth' });
  }, [active]);

  const sharebox = content.categories.find(c => c.id === 'sharebox');
  const rest = content.categories.filter(c => c.id !== 'sharebox');

  return (
    <section id="menu" className="menu" aria-labelledby="menu-title">
      <div className="wrap">
        <div className="menu__head">
          <h2 id="menu-title" className="section-title">المنيو</h2>
          <p className="section-lead">كل الأسعار بالدينار الأردني. اختار، واتصل، وجاجك بستناك.</p>
        </div>
      </div>
      <div className="tabs" ref={tabsRef} role="tablist" aria-label="أقسام المنيو">
        {content.categories.map(c => (
          <button key={c.id} data-tab={c.id} role="tab" aria-selected={active === c.id} className={'tab' + (active === c.id ? ' is-active' : '')} onClick={() => scrollToId('cat-' + c.id, -140)}>
            {c.name}
          </button>
        ))}
      </div>
      <div className="wrap menu__body">
        {rest.map(c => (
          <CategoryBlock key={c.id} cat={c} />
        ))}
      </div>
      {sharebox && <ShareBox cat={sharebox} />}
    </section>
  );
}

function CategoryHead({ cat }: { cat: Category }) {
  return (
    <div className="cat__head">
      <h3 className="cat__title">{cat.name}</h3>
      <p className="cat__blurb">{cat.blurb}</p>
      {cat.note && <span className="chip chip--yellow">{cat.note}</span>}
    </div>
  );
}

function CategoryBlock({ cat }: { cat: Category }) {
  if (cat.id === 'sandwiches') {
    return (
      <div id={'cat-' + cat.id} className="cat cat--grid">
        <CategoryHead cat={cat} />
        <div className="sandwiches">
          {cat.items.map((it, i) => (
            <SandwichCard key={it.id} item={it} tilt={i % 2 ? 2 : -2} />
          ))}
        </div>
      </div>
    );
  }
  const compact = cat.id === 'sides' || cat.id === 'sauces';
  return (
    <div id={'cat-' + cat.id} className={'cat' + (cat.image ? ' cat--photo' : '') + (compact ? ' cat--compact' : '')}>
      <div className="cat__text">
        <CategoryHead cat={cat} />
        <ul className={'rows' + (compact ? ' rows--two' : '')}>
          {cat.items.map(it => (
            <Row key={it.id} item={it} />
          ))}
        </ul>
      </div>
      {cat.image && (
        <figure className="cat__photo" data-rise="-3">
          <img src={cat.image} alt={cat.name} loading="lazy" data-parallax />
        </figure>
      )}
    </div>
  );
}

function Price({ value, big }: { value: number; big?: boolean }) {
  return (
    <span className={'price' + (big ? ' price--big' : '')}>
      <span className="num">{formatPrice(value)}</span> <small>د.أ</small>
    </span>
  );
}

function Row({ item }: { item: Item }) {
  return (
    <li className={'row' + (item.image ? ' row--img' : '')}>
      {item.image && <img className="row__img" src={item.image} alt="" loading="lazy" />}
      <div className="row__main">
        <div className="row__line">
          <span className="row__name">{item.name}</span>
          <span className="row__dots" aria-hidden="true" />
          <Price value={item.price} />
        </div>
        {item.contents && <p className="row__contents">{item.contents}</p>}
      </div>
    </li>
  );
}

function SandwichCard({ item, tilt }: { item: Item; tilt: number }) {
  const parts = (item.contents ?? '').split('+').map(s => s.trim()).filter(Boolean);
  return (
    <article className="card" data-rise={tilt}>
      <div className="card__img">{item.image ? <img src={item.image} alt={item.name} loading="lazy" /> : <span className="card__noimg">بروستد عالطريق</span>}</div>
      <div className="card__body">
        <div className="card__top">
          <h4 className="card__name">{item.name}</h4>
          <Price value={item.price} />
        </div>
        <ul className="tags" aria-label="المكوّنات">
          {parts.map(p => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function ShareBox({ cat }: { cat: Category }) {
  const item = cat.items[0];
  const parts = (item?.contents ?? '').split('+').map(s => s.trim()).filter(Boolean);
  return (
    <div id="sharebox" className="sharebox">
      <div id={'cat-' + cat.id} className="wrap sharebox__inner">
        <div className="sharebox__copy">
          <span className="chip chip--red">للّمّة</span>
          <h3 className="sharebox__title">{cat.name}</h3>
          <p className="sharebox__blurb">{cat.blurb}</p>
          <ul className="checks">
            {parts.map(p => (
              <li key={p}><CheckIcon /> {p}</li>
            ))}
          </ul>
          {item && <Price value={item.price} big />}
        </div>
        {cat.image && (
          <figure className="sharebox__photo" data-rise="3">
            <img src={cat.image} alt={cat.name} loading="lazy" />
          </figure>
        )}
      </div>
    </div>
  );
}

function Gallery() {
  const { content } = useContent();
  const ref = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);

  // Desktop: pin the section and drive the strip sideways with scroll. Phones keep a native swipe strip.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
        const el = track.current!;
        const dist = () => Math.max(0, el.scrollWidth - el.clientWidth);
        gsap.to(el, {
          x: () => dist(),
          ease: 'none',
          scrollTrigger: { trigger: ref.current, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 0.6, invalidateOnRefresh: true },
        });
      });
      return () => mm.revert();
    },
    { scope: ref, dependencies: [content.gallery.length] }
  );

  if (!content.gallery.length) return null;
  return (
    <section ref={ref} className="gallery" aria-labelledby="gallery-title">
      <div className="wrap gallery__head">
        <h2 id="gallery-title" className="section-title">شوف بعينك</h2>
        <p className="section-lead">قرمشة بتبيّن من الصورة.</p>
      </div>
      <div className="gallery__track" ref={track}>
        {content.gallery.map((src, i) => (
          <figure key={i} className="gallery__item" style={{ rotate: `${i % 2 ? 1.5 : -1.5}deg` }}>
            <img src={src} alt="" loading="lazy" />
          </figure>
        ))}
      </div>
    </section>
  );
}

function About() {
  const { content } = useContent();
  const { about, brand, branches, categories } = content;
  const ref = useRef<HTMLElement>(null);
  const count = (id: string) => categories.find(c => c.id === id)?.items.length ?? 0;
  const hoursOpen = (brand.closeHour - brand.openHour + 24) % 24 || 24;
  // Automatic figures come from the live content; the admin can override any of them.
  const auto: Record<Stat['key'], number> = { branches: branches.length, hours: hoursOpen, sandwiches: count('sandwiches'), sauces: count('sauces') };
  const stats = (about.stats ?? [])
    .filter(s => s.show)
    .map(s => ({ label: s.label, value: s.value ?? auto[s.key] }))
    .filter(s => s.value > 0);

  // Numbers rest at their real value; on first view they count up to it.
  useGSAP(
    () => {
      if (reduced()) return;
      gsap.utils.toArray<HTMLElement>('.stat__num').forEach(el => {
        const end = Number(el.dataset.value);
        const o = { v: 0 };
        ScrollTrigger.create({
          trigger: el, start: 'top 90%', once: true,
          onEnter: () => gsap.fromTo(o, { v: 0 }, { v: end, duration: 1.4, ease: 'power3.out', onUpdate: () => { el.textContent = String(Math.round(o.v)); } }),
        });
      });
    },
    { scope: ref, dependencies: [stats.map(s => s.value).join()] }
  );

  return (
    <section ref={ref} id="about" className="about" aria-labelledby="about-title">
      <div className="wrap about__inner">
        <div className="about__copy">
          <h2 id="about-title" className="section-title">{about.title}</h2>
          <p className="about__lead">{about.lead}</p>
          {about.paragraphs.map((p, i) => (
            <p key={i} className="about__p">{p}</p>
          ))}
          <ul className="stats">
            {stats.map(s => (
              <li key={s.label} className="stat">
                <span className="stat__num num" data-value={s.value}>{s.value}</span>
                <span className="stat__label">{s.label}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="about__screen" data-rise="3">
          <video className="about__video" autoPlay muted loop playsInline preload="metadata" poster={about.video + '-poster.webp'} aria-label="فيديو قصة بروستد عالطريق">
            <source src={about.video + '.mp4'} type="video/mp4" />
            <source src={about.video + '.webm'} type="video/webm" />
          </video>
        </div>
      </div>
    </section>
  );
}

type LocState = { kind: 'idle' } | { kind: 'busy' } | { kind: 'done'; data: Located } | { kind: 'error'; denied: boolean };

function Branches() {
  const { content } = useContent();
  const [loc, setLoc] = useState<LocState>({ kind: 'idle' });
  const ref = useRef<HTMLElement>(null);
  const nearest = loc.kind === 'done' ? content.branches.find(b => b.id === loc.data.nearestId) : undefined;
  const ordered = useMemo(
    () => (loc.kind === 'done' ? [...content.branches].sort((a, b) => loc.data.distances[a.id] - loc.data.distances[b.id]) : content.branches),
    [loc, content.branches]
  );

  const find = () => {
    setLoc({ kind: 'busy' });
    locate(content.branches)
      .then(data => setLoc({ kind: 'done', data }))
      .catch((e: GeolocationPositionError | Error) => setLoc({ kind: 'error', denied: 'code' in e && e.code === 1 }));
  };

  useGSAP(
    () => {
      if (reduced()) return;
      gsap.to('.branches__dash', { strokeDashoffset: -60, duration: 1.6, ease: 'none', repeat: -1 });
    },
    { scope: ref }
  );

  return (
    <section ref={ref} id="branches" className="branches" aria-labelledby="branches-title">
      <svg className="branches__road" viewBox="0 0 400 1200" preserveAspectRatio="none" aria-hidden="true">
        <path className="branches__band" d="M200 -20 C 380 200, 20 380, 200 600 S 30 1000, 200 1220" />
        <path className="branches__dash" d="M200 -20 C 380 200, 20 380, 200 600 S 30 1000, 200 1220" />
      </svg>
      <div className="wrap branches__inner">
        <div className="branches__head">
          <h2 id="branches-title" className="section-title section-title--light">{content.branchesText.title}</h2>
          {content.branchesText.lead.trim() && <p className="section-lead section-lead--light">{content.branchesText.lead}</p>}
          <Magnet padding={50} magnetStrength={4}>
            <button className="btn btn--yellow btn--big" onClick={find} disabled={loc.kind === 'busy'} aria-live="polite">
              <RouteIcon /> {loc.kind === 'busy' ? 'بندوّر على موقعك…' : content.branchesText.button}
            </button>
          </Magnet>
          <div className="branches__msg" role="status">
            {nearest && loc.kind === 'done' && (
              <p>
                أقرب فرع إلك: <strong>{nearest.name}</strong>، على بُعد <span className="num">{loc.data.distances[nearest.id].toFixed(1)}</span> كم.{' '}
                <a className="link" href={directionsUrl(nearest)} target="_blank" rel="noopener">افتح الطريق</a>
              </p>
            )}
            {loc.kind === 'error' && (
              <p>{loc.denied ? 'ما سمحت للموقع يعرف مكانك. بتقدر تسمحله من إعدادات المتصفح، أو اختار الفرع من تحت.' : 'ما قدرنا نعرف موقعك هسّا. اختار الفرع الأقرب إلك من تحت.'}</p>
            )}
          </div>
        </div>
        <ol className="signs">
          {ordered.map((b, i) => (
            <BranchSign key={b.id} branch={b} index={i} km={loc.kind === 'done' ? loc.data.distances[b.id] : undefined} nearest={nearest?.id === b.id} />
          ))}
        </ol>
      </div>
    </section>
  );
}

function BranchSign({ branch, km, nearest, index }: { branch: Branch; km?: number; nearest: boolean; index: number }) {
  const { content } = useContent();
  return (
    <li className={'sign' + (nearest ? ' is-nearest' : '')} data-rise={index % 2 ? 2 : -2}>
      {nearest && <span className="sign__badge">الأقرب إلك</span>}
      <div className="sign__plate">
        <PinIcon size={26} />
        <h3 className="sign__name">{branch.name}</h3>
        {km !== undefined && <span className="sign__km"><span className="num">{km.toFixed(1)}</span> كم</span>}
      </div>
      <p className="sign__hours"><ClockIcon /> {content.brand.hours}</p>
      <div className="sign__actions">
        <a className="btn btn--white" href={branch.maps} target="_blank" rel="noopener"><PinIcon size={18} /> افتح بالخريطة</a>
        <a className="btn btn--outline" href={directionsUrl(branch)} target="_blank" rel="noopener"><RouteIcon size={18} /> خوذ الطريق</a>
      </div>
      <span className="sign__pole" aria-hidden="true" />
    </li>
  );
}

function Footer() {
  const { content } = useContent();
  const { brand } = content;
  return (
    <footer className="footer">
      <div className="checker" aria-hidden="true" />
      <div className="wrap footer__inner">
        <img className="footer__logo" src={brand.logo} alt={brand.name} width={190} height={112} loading="lazy" />
        <p className="footer__slogan">{brand.slogan}</p>
        <div className="footer__cols">
          <div>
            <h4>اتصل واطلب</h4>
            <a className="footer__phone num" href={telHref(brand.phone)}>{brand.phone}</a>
          </div>
          <div>
            <h4>أوقات الدوام</h4>
            <p>{brand.hours}</p>
          </div>
          <div>
            <h4>تابعنا</h4>
            <div className="footer__social">
              <a href={brand.instagram} target="_blank" rel="noopener" aria-label="إنستغرام"><InstagramIcon /></a>
              <a href={brand.facebook} target="_blank" rel="noopener" aria-label="فيسبوك"><FacebookIcon /></a>
            </div>
          </div>
        </div>
        <p className="footer__legal">
          © {new Date().getFullYear()} {brand.name}.
        </p>
        {brand.footerNote?.trim() && <p className="footer__legal footer__note" dir="auto">{brand.footerNote}</p>}
      </div>
    </footer>
  );
}

function CallFab() {
  const { content } = useContent();
  // with online ordering on, phones show a compact call button next to the "order online" bar
  const ordering = useOrdering();
  return (
    <a className={'fab' + (ordering.visible ? ' fab--compact' : '')} href={telHref(content.brand.phone)} aria-label={'اتصل على ' + content.brand.phone}>
      <span className="fab__ring" aria-hidden="true" />
      <span className="fab__icon"><PhoneIcon size={26} /></span>
      <span className="fab__label">
        <small>اتصل واطلب</small>
        <span className="num">{content.brand.phone}</span>
      </span>
    </a>
  );
}
