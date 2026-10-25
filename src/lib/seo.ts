// Search-engine data built from the site content: the schema.org JSON-LD and a plain-HTML
// version of the page that ships inside #root, so crawlers read the menu before any script runs.
// Used at build time (vite.config.ts) and again in the browser when live content arrives.
import type { Content } from './types';

export const SITE_URL = 'https://www.broasted3ltareeq.com/';
const CITY = 'إربد';

const intl = (phone: string) => '+962' + phone.replace(/\D/g, '').replace(/^0/, '');
const price = (n: number) => n.toFixed(2);
const pad = (n: number) => String(n).padStart(2, '0') + ':00';
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function address(street: string) {
  return { '@type': 'PostalAddress', streetAddress: street, addressLocality: CITY, addressRegion: CITY, addressCountry: 'JO' };
}

export function buildSchema(c: Content) {
  const tel = intl(c.brand.phone);
  const hours = [{
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    opens: pad(c.brand.openHour),
    closes: pad(c.brand.closeHour),
  }];
  const abs = (src?: string) => (!src ? undefined : /^https?:/.test(src) ? src : SITE_URL + src.replace(/^\//, ''));
  const menu = {
    '@type': 'Menu',
    name: 'منيو ' + c.brand.name,
    inLanguage: 'ar',
    hasMenuSection: c.categories.map(cat => ({
      '@type': 'MenuSection',
      name: cat.name,
      description: cat.blurb,
      hasMenuItem: cat.items.map(it => ({
        '@type': 'MenuItem',
        name: it.name,
        ...(it.contents ? { description: it.contents } : {}),
        ...(it.image ? { image: abs(it.image) } : {}),
        offers: { '@type': 'Offer', price: price(it.price), priceCurrency: 'JOD' },
      })),
    })),
  };
  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': SITE_URL + '#restaurant',
    name: c.brand.name,
    alternateName: 'Broasted 3al Tareeq',
    description: `${c.brand.name}: بروستد مقرمش، تندر وساندويشات في ${CITY}. ${c.branches.length} فروع، ${c.brand.hours}.`,
    url: SITE_URL,
    image: SITE_URL + 'og.jpg',
    logo: SITE_URL + 'img/logo-sm.png',
    telephone: tel,
    servesCuisine: ['بروستد', 'دجاج مقلي', 'ساندويشات', 'Fried chicken'],
    priceRange: '$',
    currenciesAccepted: 'JOD',
    address: address(c.branches.map(b => b.name.replace('فرع ', '')).join('، ')),
    areaServed: { '@type': 'City', name: CITY },
    openingHoursSpecification: hours,
    sameAs: [c.brand.instagram, c.brand.facebook].filter(Boolean),
    hasMenu: menu,
    department: c.branches.map(b => ({
      '@type': 'Restaurant',
      name: `${c.brand.name} - ${b.name.replace('فرع ', '')}`,
      telephone: tel,
      address: address(b.name.replace('فرع ', '')),
      geo: { '@type': 'GeoCoordinates', latitude: b.lat, longitude: b.lng },
      hasMap: b.maps,
      openingHoursSpecification: hours,
      servesCuisine: 'بروستد',
      priceRange: '$',
    })),
  };
}

// Plain, readable page content. React replaces it as soon as the app mounts.
export function buildFallbackHtml(c: Content) {
  const sections = c.categories.map(cat => `
    <section><h2>${esc(cat.name)}</h2>${cat.note ? `<p>${esc(cat.note)}</p>` : ''}<ul>
      ${cat.items.map(it => `<li><strong>${esc(it.name)}</strong> – ${price(it.price)} د.أ${it.contents ? `<br><small>${esc(it.contents)}</small>` : ''}</li>`).join('')}
    </ul></section>`).join('');
  const branches = c.branches.map(b => `<li><a href="${esc(b.maps)}">${esc(b.name)}، ${CITY}</a></li>`).join('');
  return `<div class="seo-fallback">
    <h1>${esc(c.brand.name)} – بروستد وتندر وساندويشات في ${CITY}</h1>
    <p>${esc(c.hero.subtitle)}</p>
    <p>اتصل واطلب: <a href="tel:${intl(c.brand.phone)}">${esc(c.brand.phone)}</a> · ${esc(c.brand.hours)}</p>
    <h2>المنيو</h2>${sections}
    <h2>فروعنا في ${CITY}</h2><ul>${branches}</ul>
    <h2>${esc(c.about.title)}</h2>${c.about.paragraphs.map(p => `<p>${esc(p)}</p>`).join('')}
  </div>`;
}
