import type { Place, VisitPost, VisitStatus } from "@/lib/domain";
import { combinedOverallScore, reviewProgressFor } from "@/lib/rating";

export const HOME_COUNTRY = "Philippines";

export type PlaceScope = "all" | "local" | "international";

/** Places saved before countries existed have none; they count as local. */
export function isLocalPlace(place: Pick<Place, "country">): boolean {
  return (place.country?.trim() || HOME_COUNTRY).toLowerCase() === HOME_COUNTRY.toLowerCase();
}

export function filterByScope<T extends Pick<Place, "country">>(places: T[], scope: PlaceScope): T[] {
  if (scope === "all") return places;
  return places.filter((place) => isLocalPlace(place) === (scope === "local"));
}

/** "Makati" at home, "Tokyo, Japan" abroad, and just "Singapore" for a city-state. */
export function placeLocation(place: Pick<Place, "city" | "country">): string {
  if (isLocalPlace(place)) return place.city;
  const country = place.country.trim();
  return place.city.trim().toLowerCase() === country.toLowerCase() ? country : `${place.city}, ${country}`;
}

/** The map frames home first; a pin abroad would otherwise zoom it out to the whole region. */
export function framingPlaces<T extends Pick<Place, "country">>(places: T[]): T[] {
  const local = places.filter(isLocalPlace);
  return local.length ? local : places;
}

export function pickNextPlace(places: Place[]): Place | undefined {
  return places.find((place) => place.status === "planned")
    ?? places.find((place) => place.status === "want-to-visit");
}

/** Un-planning returns a place we have been to back to visited, never to want-to-visit. */
export function togglePlannedStatus(place: Pick<Place, "status" | "visitCount">): VisitStatus {
  if (place.status !== "planned") return "planned";
  return place.visitCount > 0 ? "visited" : "want-to-visit";
}

export function sharedScoreLabel(place: Pick<Place, "combinedScore" | "visitCount">): string {
  if (place.combinedScore != null) return place.combinedScore.toFixed(1);
  return place.visitCount > 0 ? "Waiting" : "No reviews yet";
}

export type LatLngBounds = [[number, number], [number, number]];

/** South-west and north-east corners around every place with usable coordinates; null when there are none. */
export function placesBounds(places: Pick<Place, "latitude" | "longitude">[]): LatLngBounds | null {
  const points = places.filter((place) =>
    Number.isFinite(place.latitude) && Number.isFinite(place.longitude)
    && Math.abs(place.latitude) <= 90 && Math.abs(place.longitude) <= 180);
  if (!points.length) return null;
  const latitudes = points.map((place) => place.latitude);
  const longitudes = points.map((place) => place.longitude);
  return [[Math.min(...latitudes), Math.min(...longitudes)], [Math.max(...latitudes), Math.max(...longitudes)]];
}

function fold(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Accent-insensitive, so "cafe" finds "Luna Café". */
export function matchesPlaceQuery(place: Pick<Place, "name" | "city" | "category">, query: string): boolean {
  const needle = fold(query.trim());
  if (!needle) return true;
  return [place.name, place.city, place.category].some((field) => fold(field).includes(needle));
}

/** The latest visit decides a place's shared score and review progress, as the server does. */
export function withDerivedReviewState(places: Place[], posts: VisitPost[], viewerId: string): Place[] {
  const latestByPlace = new Map<string, VisitPost>();
  for (const post of posts) {
    const current = latestByPlace.get(post.place.id);
    if (!current || post.createdAt > current.createdAt) latestByPlace.set(post.place.id, post);
  }
  return places.map((place) => {
    const latest = latestByPlace.get(place.id);
    return {
      ...place,
      combinedScore: latest ? combinedOverallScore(latest.reviews) : null,
      reviewProgress: reviewProgressFor(latest, viewerId),
    };
  });
}

/** Visited places, most recent visit first; places marked visited without a logged visit come last. */
export function archiveTimeline(places: Place[], posts: VisitPost[], limit = 3): Place[] {
  const lastVisit = new Map<string, string>();
  for (const post of posts) {
    const seen = lastVisit.get(post.place.id);
    if (!seen || post.visitedOn > seen) lastVisit.set(post.place.id, post.visitedOn);
  }
  return places
    .filter((place) => place.status === "visited")
    .sort((a, b) => (lastVisit.get(b.id) ?? "").localeCompare(lastVisit.get(a.id) ?? ""))
    .slice(0, limit);
}
