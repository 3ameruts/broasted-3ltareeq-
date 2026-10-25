import type { Offer } from './offers';

export type Tracking = { googleTag: string; gtm: string; metaPixel: string };

export type Item = { id: string; name: string; price: number; contents?: string; image?: string };
export type Category = { id: string; name: string; blurb: string; note?: string; image?: string; items: Item[] };
export type Branch = { id: string; name: string; maps: string; lat: number; lng: number };
// value null = counted automatically from the menu, branches and hours.
export type Stat = { key: 'branches' | 'hours' | 'sandwiches' | 'sauces'; label: string; value: number | null; show: boolean };
export type Content = {
  brand: {
    name: string; slogan: string; phone: string; hours: string; openHour: number; closeHour: number;
    instagram: string; facebook: string; logo: string;
    showStatus: boolean; statusOpen: string; statusClosed: string;
    footerNote: string;
  };
  hero: { eyebrow: string; title: string; subtitle: string; video: string };
  about: { title: string; lead: string; paragraphs: string[]; video: string; stats: Stat[] };
  branchesText: { title: string; lead: string; button: string };
  tracking: Tracking;
  offersText: { title: string; lead: string; tape: string };
  offers: Offer[];
  marquee: string[];
  categories: Category[];
  branches: Branch[];
  gallery: string[];
};
