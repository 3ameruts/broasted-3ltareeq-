import type { Branch } from './content';

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function directionsUrl(b: Branch) {
  return `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}`;
}

export type Located = { distances: Record<string, number>; nearestId: string };

export function locate(branches: Branch[]): Promise<Located> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('unsupported'));
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const distances: Record<string, number> = {};
        for (const b of branches) distances[b.id] = distanceKm(coords.latitude, coords.longitude, b.lat, b.lng);
        const nearestId = branches.reduce((best, b) => (distances[b.id] < distances[best.id] ? b : best)).id;
        resolve({ distances, nearestId });
      },
      err => reject(err),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  });
}
