import { useEffect } from 'react';

import type { Tracking } from './types';
export type { Tracking };

// IDs come from the admin panel, so only well-formed ones are allowed into a script URL.
const valid = {
  googleTag: (v: string) => /^(G|GT|AW)-[A-Z0-9]{4,20}$/i.test(v),
  gtm: (v: string) => /^GTM-[A-Z0-9]{4,12}$/i.test(v),
  metaPixel: (v: string) => /^\d{8,20}$/.test(v),
};

type W = Window & {
  dataLayer?: unknown[];
  gtag?: (...a: unknown[]) => void;
  fbq?: ((...a: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
  _fbq?: unknown;
};
const w = window as W;
const loaded = new Set<string>();

function addScript(src: string) {
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

function loadGoogleTag(id: string) {
  w.dataLayer = w.dataLayer || [];
  w.gtag = function () { w.dataLayer!.push(arguments); }; // eslint-disable-line prefer-rest-params
  w.gtag('js', new Date());
  w.gtag('config', id);
  addScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id));
}

function loadGtm(id: string) {
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  addScript('https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(id));
}

function loadMetaPixel(id: string) {
  if (!w.fbq) {
    const q: unknown[] = [];
    const fbq = Object.assign(
      (...a: unknown[]) => { if (fbq.callMethod) (fbq.callMethod as (...x: unknown[]) => void)(...a); else q.push(a); },
      { queue: q, loaded: true, version: '2.0', push: undefined as unknown, callMethod: undefined as unknown }
    );
    fbq.push = fbq;
    w.fbq = w._fbq = fbq;
    addScript('https://connect.facebook.net/en_US/fbevents.js');
  }
  w.fbq!('init', id);
  w.fbq!('track', 'PageView');
}

// Records the actions that matter for the restaurant: calling, and opening a branch on the map.
function track(kind: 'call' | 'directions', label: string) {
  if (kind === 'call') {
    w.gtag?.('event', 'call_click', { link_text: label });
    w.dataLayer?.push({ event: 'call_click', link_text: label });
    w.fbq?.('track', 'Contact');
  } else {
    w.gtag?.('event', 'get_directions', { branch: label });
    w.dataLayer?.push({ event: 'get_directions', branch: label });
    w.fbq?.('track', 'FindLocation');
  }
}

export function useTracking(t: Partial<Tracking> | undefined) {
  useEffect(() => {
    if (!t) return;
    for (const key of ['googleTag', 'gtm', 'metaPixel'] as const) {
      const id = (t[key] ?? '').trim();
      if (!id || !valid[key](id) || loaded.has(key + id)) continue;
      loaded.add(key + id);
      if (key === 'googleTag') loadGoogleTag(id);
      else if (key === 'gtm') loadGtm(id);
      else loadMetaPixel(id);
    }
  }, [t?.googleTag, t?.gtm, t?.metaPixel]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a');
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (href.startsWith('tel:')) track('call', (a.textContent || '').trim());
      else if (/google\.[^/]+\/maps|maps\.app\.goo\.gl/.test(href)) track('directions', a.closest('.sign')?.querySelector('.sign__name')?.textContent || href);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);
}

export const trackingValid = valid;
