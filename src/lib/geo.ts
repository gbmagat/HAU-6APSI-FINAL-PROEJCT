export type LatLng = { latitude: number; longitude: number };

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * Great-circle distance with the Haversine formula:
 * a = sin²(Δφ/2) + cos φ1 · cos φ2 · sin²(Δλ/2),  d = 2R · atan2(√a, √(1−a)).
 */
export function distanceKm(from: LatLng, to: LatLng): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** "650 m", "2.3 km", "48 km". */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString("en-US")} km`;
}

/** Nearest first; without an origin the original order is kept. Ties keep their original order. */
export function sortByDistance<T extends LatLng>(items: T[], origin: LatLng | null): (T & { distanceKm?: number })[] {
  if (!origin) return items;
  return items
    .map((item) => ({ ...item, distanceKm: distanceKm(origin, item) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
