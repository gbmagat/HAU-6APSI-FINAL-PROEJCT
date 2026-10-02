import { distanceKm } from "@/lib/geo";
import type { NominatimResult } from "@/lib/place-search";

/** Public details about a real place, gathered from OpenStreetMap and Wikipedia. */
export type PlaceAbout = {
  website?: string;
  phone?: string;
  openingHours?: string;
  osmUrl?: string;
  wikipedia?: { title: string; extract: string; url: string };
};

/** OpenStreetMap data is public and editable, so only plain http(s) links are ever shown. */
export function safeWebUrl(value?: string): string | undefined {
  const candidate = value?.split(";")[0]?.trim();
  if (!candidate) return undefined;
  try {
    const url = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".") ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function safePhone(value?: string): string | undefined {
  const phone = value?.split(";")[0]?.trim();
  return phone && /^[+\d][\d\s().-]{5,24}$/.test(phone) ? phone : undefined;
}

/** The result closest to our saved coordinates, if it is within maxKm. */
export function nearestMatch(results: NominatimResult[], latitude: number, longitude: number, maxKm = 0.6): NominatimResult | undefined {
  let best: { result: NominatimResult; km: number } | undefined;
  for (const result of results) {
    const km = distanceKm({ latitude, longitude }, { latitude: Number(result.lat), longitude: Number(result.lon) });
    if (Number.isFinite(km) && km <= maxKm && (!best || km < best.km)) best = { result, km };
  }
  return best?.result;
}

/** "en:Intramuros" → { lang: "en", title: "Intramuros" }; the language code is checked before it becomes part of a hostname. */
export function parseWikipediaTag(tag?: string): { lang: string; title: string } | null {
  const value = tag?.trim();
  if (!value) return null;
  const match = /^([a-z]{2,3}(?:-[a-z]{2,8})?):(.+)$/.exec(value);
  return match ? { lang: match[1], title: match[2].trim() } : { lang: "en", title: value };
}

export function aboutFromNominatim(result: NominatimResult): PlaceAbout & { wikipediaTag?: string } {
  const tags = result.extratags ?? {};
  return {
    website: safeWebUrl(tags.website || tags["contact:website"] || tags.url),
    phone: safePhone(tags.phone || tags["contact:phone"]),
    openingHours: tags.opening_hours?.trim() || undefined,
    osmUrl: result.osm_type && result.osm_id ? `https://www.openstreetmap.org/${result.osm_type}/${result.osm_id}` : undefined,
    wikipediaTag: tags.wikipedia,
  };
}

const dayNames: Record<string, string> = { Mo: "Mon", Tu: "Tue", We: "Wed", Th: "Thu", Fr: "Fri", Sa: "Sat", Su: "Sun", PH: "holidays" };

/** OpenStreetMap's "Mo-Fr 09:00-18:00; Sa 10:00-16:00" as "Mon–Fri 09:00–18:00 · Sat 10:00–16:00". */
export function formatOpeningHours(value: string): string {
  const hours = value.trim();
  if (hours === "24/7") return "Open 24 hours";
  return hours
    .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, (day) => dayNames[day])
    .replace(/([A-Za-z]{3})-([A-Za-z]{3})/g, "$1–$2")
    .replace(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/g, "$1–$2")
    .replace(/\s*;\s*/g, " · ");
}

/** Google Maps URLs need no key: this opens the place there, where its reviews and photos live. */
export function googleMapsSearchUrl(name: string, city: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${city}`.trim())}`;
}
