import type { PlaceCategory } from "@/lib/domain";

/** A real-world place found through OpenStreetMap search, not yet saved. */
export type PlaceSearchResult = {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  category: PlaceCategory;
};

/** The subset of a Nominatim `format=jsonv2&addressdetails=1` result this app reads. */
export type NominatimResult = {
  place_id?: number;
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  category?: string;
  type?: string;
  address?: Record<string, string | undefined>;
};

const categoryByType: Record<string, PlaceCategory> = {
  cafe: "Cafe",
  restaurant: "Restaurant",
  fast_food: "Restaurant",
  food_court: "Restaurant",
  bar: "Restaurant",
  pub: "Restaurant",
  museum: "Museum",
  gallery: "Gallery",
  arts_centre: "Gallery",
  park: "Park",
  garden: "Park",
  nature_reserve: "Park",
  beach: "Park",
  viewpoint: "Park",
  monument: "Heritage",
  memorial: "Heritage",
  castle: "Heritage",
  ruins: "Heritage",
  place_of_worship: "Heritage",
};

export function categoryFor(category?: string, type?: string): PlaceCategory {
  if (type && categoryByType[type]) return categoryByType[type];
  if (category === "historic") return "Heritage";
  if (category === "leisure" || category === "natural") return "Park";
  return "District";
}

export function fromNominatim(result: NominatimResult): PlaceSearchResult | null {
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const address = result.address ?? {};
  const name = (result.name?.trim() || result.display_name.split(",")[0] || "").trim();
  const country = address.country?.trim() ?? "";
  if (!name || !country) return null;
  const city = address.city || address.town || address.village || address.municipality
    || address.city_district || address.county || address.state || name;
  return {
    id: String(result.place_id ?? `${latitude},${longitude}`),
    name: name.slice(0, 160),
    address: result.display_name.slice(0, 300),
    city: city.trim().slice(0, 120),
    country: country.slice(0, 80),
    latitude,
    longitude,
    category: categoryFor(result.category, result.type),
  };
}
