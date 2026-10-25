// endsAt is a calendar day (YYYY-MM-DD) in Jordan; the offer runs through the end of that day.
export type Offer = {
  id: string;
  title: string;
  contents: string;
  price: number;
  oldPrice: number | null;
  badge: string;
  image?: string;
  active: boolean;
  endsAt: string;
};

export const todayInJordan = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Amman', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

export type OfferState = 'live' | 'off' | 'ended';

export function offerState(o: Offer, today = todayInJordan()): OfferState {
  if (!o.active) return 'off';
  if (o.endsAt && o.endsAt < today) return 'ended';
  return 'live';
}

export const liveOffers = (offers: Offer[] | undefined) => (offers ?? []).filter(o => offerState(o) === 'live');

// Whole days left including today: 1 means "last day".
export function daysLeft(o: Offer, today = todayInJordan()) {
  if (!o.endsAt) return null;
  const ms = Date.parse(o.endsAt + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z');
  return Math.floor(ms / 86400000) + 1;
}
