import { describe, expect, it } from "vitest";

import { categoryFor, fromNominatim } from "@/lib/place-search";
import { isSamePlace, newPlaceSchema, placeInitials, slugify, uniqueSlug } from "@/lib/place-input";

const sanFernando = {
  place_id: 1,
  lat: "15.0286",
  lon: "120.6898",
  name: "San Fernando",
  display_name: "San Fernando, Pampanga, Central Luzon, Philippines",
  category: "boundary",
  type: "administrative",
  address: { city: "San Fernando", state: "Central Luzon", country: "Philippines" },
};

describe("OpenStreetMap search results", () => {
  it("turns a city into a local place with a District category", () => {
    expect(fromNominatim(sanFernando)).toEqual({
      id: "1",
      name: "San Fernando",
      address: "San Fernando, Pampanga, Central Luzon, Philippines",
      city: "San Fernando",
      country: "Philippines",
      latitude: 15.0286,
      longitude: 120.6898,
      category: "District",
    });
  });

  it("maps cafes, museums, parks, and heritage sites to our categories", () => {
    expect(categoryFor("amenity", "cafe")).toBe("Cafe");
    expect(categoryFor("tourism", "museum")).toBe("Museum");
    expect(categoryFor("leisure", "park")).toBe("Park");
    expect(categoryFor("historic", "fort")).toBe("Heritage");
    expect(categoryFor("shop", "mall")).toBe("District");
  });

  it("falls back to the town when there is no city, and skips results without coordinates or a country", () => {
    const town = fromNominatim({ ...sanFernando, address: { town: "Pagsanjan", country: "Philippines" } });
    expect(town?.city).toBe("Pagsanjan");
    expect(fromNominatim({ ...sanFernando, lat: "not a number" })).toBeNull();
    expect(fromNominatim({ ...sanFernando, address: {} })).toBeNull();
  });
});

describe("saving a new place", () => {
  const place = { name: "Luna Café", category: "Cafe", city: "Makati", country: "Philippines", latitude: 14.55, longitude: 121.01 };

  it("accepts a found place and defaults to want to visit", () => {
    const parsed = newPlaceSchema.parse(place);
    expect(parsed).toMatchObject({ status: "want-to-visit", address: "" });
  });

  it("rejects impossible coordinates and unknown categories", () => {
    expect(newPlaceSchema.safeParse({ ...place, latitude: 120 }).success).toBe(false);
    expect(newPlaceSchema.safeParse({ ...place, category: "Bar" }).success).toBe(false);
  });

  it("builds readable, unique slugs and initials", () => {
    expect(slugify("Luna Café")).toBe("luna-cafe");
    expect(slugify("  San Fernando, Pampanga!  ")).toBe("san-fernando-pampanga");
    expect(uniqueSlug("luna-cafe", ["luna-cafe", "luna-cafe-2"])).toBe("luna-cafe-3");
    expect(uniqueSlug("", [])).toBe("place");
    expect(placeInitials("Luna Café")).toBe("LC");
    expect(placeInitials("Intramuros")).toBe("IN");
  });

  it("recognizes the same place saved twice", () => {
    expect(isSamePlace(place, { ...place, name: "luna café", latitude: 14.5502 })).toBe(true);
    expect(isSamePlace(place, { ...place, latitude: 14.56 })).toBe(false);
  });
});
